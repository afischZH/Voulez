#!/usr/bin/env bash
#
# Baut aus dem heruntergeladenen Pass-Zertifikat die drei Base64-Werte für
# .env.local. Einmal von Hand auszuführen, nachdem `pass.cer` von
# developer.apple.com im Ordner `certs/` liegt.
#
#   ./scripts/apple-pass-env.sh
#
# Der private Schlüssel und die CSR liegen bereits dort — erzeugt beim Aufsetzen
# des Passes. Wer neu anfängt, macht beides so:
#
#   openssl req -newkey rsa:2048 -nodes -keyout certs/pass-key.pem \
#     -out certs/pass.csr -subj "/CN=Voulez Pass Type ID/C=CH"
#
set -euo pipefail

cd "$(dirname "$0")/.."
DIR=${CERTS_DIR:-certs}

fehlt() {
  echo "Fehlt: $1" >&2
  echo "$2" >&2
  exit 1
}

[ -f "$DIR/pass.cer" ] || fehlt "$DIR/pass.cer" \
  "developer.apple.com → Certificates, IDs & Profiles → Identifiers → Pass Type IDs.
Dort die Kennung anlegen, Zertifikat erzeugen, $DIR/pass.csr hochladen und die
heruntergeladene Datei als $DIR/pass.cer ablegen."

[ -f "$DIR/pass-key.pem" ] || fehlt "$DIR/pass-key.pem" \
  "Der private Schlüssel zur CSR. Ohne ihn ist das Zertifikat wertlos — dann
neuen Schlüssel und neue CSR erzeugen (siehe Kopf dieser Datei) und das
Zertifikat bei Apple neu ausstellen lassen."

[ -f "$DIR/wwdr-g4.pem" ] || fehlt "$DIR/wwdr-g4.pem" \
  "Apples Zwischenstelle. Holen mit:
  curl -sSo $DIR/AppleWWDRCAG4.cer https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
  openssl x509 -inform der -in $DIR/AppleWWDRCAG4.cer -out $DIR/wwdr-g4.pem"

# Apple liefert DER, gelegentlich aber auch schon PEM. Beides annehmen.
if grep -q "BEGIN CERTIFICATE" "$DIR/pass.cer" 2>/dev/null; then
  cp "$DIR/pass.cer" "$DIR/pass-cert.pem"
else
  openssl x509 -inform der -in "$DIR/pass.cer" -out "$DIR/pass-cert.pem"
fi

# Passt der Schlüssel zum Zertifikat? Sonst signiert der Pass fehlerfrei und
# wird auf dem Gerät kommentarlos abgelehnt.
cert_mod=$(openssl x509 -noout -modulus -in "$DIR/pass-cert.pem" | openssl md5)
key_mod=$(openssl rsa -noout -modulus -in "$DIR/pass-key.pem" | openssl md5)
if [ "$cert_mod" != "$key_mod" ]; then
  echo "Zertifikat und privater Schlüssel gehören nicht zusammen." >&2
  echo "Das Zertifikat wurde zu einer anderen CSR ausgestellt." >&2
  exit 1
fi

# Wallet akzeptiert nur G4.
openssl x509 -in "$DIR/wwdr-g4.pem" -noout -subject | grep -q "OU=G4" || {
  echo "Die Zwischenstelle ist nicht G4. Wallet lehnt den Pass damit ab." >&2
  exit 1
}

subject=$(openssl x509 -in "$DIR/pass-cert.pem" -noout -subject)
ablauf=$(openssl x509 -in "$DIR/pass-cert.pem" -noout -enddate | cut -d= -f2)

# Die Pass Type ID steht im UID-Feld des Zertifikats, die Team ID in OU.
pass_type_id=$(echo "$subject" | sed -n 's/.*UID=\([^,/]*\).*/\1/p')
team_id=$(echo "$subject" | sed -n 's/.*OU=\([^,/]*\).*/\1/p')

echo "Zertifikat in Ordnung. Läuft ab: $ablauf"
echo "(Danach signierte Pässe lehnt Wallet ab — Kalendereintrag setzen.)"
echo
echo "# ---- nach .env.local kopieren, und dieselben Werte zu Vercel ----"
[ -n "$pass_type_id" ] && echo "APPLE_PASS_TYPE_ID=$pass_type_id"
[ -n "$team_id" ] && echo "APPLE_TEAM_ID=$team_id"
echo "APPLE_PASS_CERT_PEM_BASE64=$(base64 < "$DIR/pass-cert.pem" | tr -d '\n')"
echo "APPLE_PASS_KEY_PEM_BASE64=$(base64 < "$DIR/pass-key.pem" | tr -d '\n')"
echo "APPLE_WWDR_CERT_PEM_BASE64=$(base64 < "$DIR/wwdr-g4.pem" | tr -d '\n')"
echo "# -----------------------------------------------------------------"
echo
echo "Danach: 'rm -rf certs' — die Werte stehen dann in der Umgebung, und"
echo "der unverschlüsselte Schlüssel muss nicht auf der Platte liegen bleiben."
