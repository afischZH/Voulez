-- Die Einladung geht direkt an den Empfaenger.
--
-- Bisher bekam nur der Ersteller Post; den Link musste er selbst weiterreichen.
-- Optional darf er jetzt die Adresse des Empfaengers hinterlegen — Voulez
-- schickt die Einladung dann selbst, aber erst nach dem Doppel-Opt-In des
-- Erstellers. Ohne diese Reihenfolge waere die Seite ein Versandwerkzeug fuer
-- fremde Adressen.

alter table public.vaults
  add column if not exists recipient_email   text,
  -- Zeitstempel statt boolean: er beantwortet zugleich die Frage, wann die
  -- Einladung rausging, und dient als Sperre gegen einen zweiten Versand.
  add column if not exists invitation_sent_at timestamptz;

alter table public.vaults
  drop constraint if exists vaults_recipient_email_format;
alter table public.vaults
  add constraint vaults_recipient_email_format
  check (
    recipient_email is null
    or (recipient_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        and char_length(recipient_email) <= 200)
  );

comment on column public.vaults.recipient_email is
  'Freiwillig. Wird mit dem Tresor nach 90 Tagen geloescht und nie an Dritte gegeben.';

-- Die Liste der Ereignis-Arten war seit dem Anfang zu kurz: `ticket_mailed`
-- wird laengst geschrieben, lief aber jedes Mal in diesen Check und landete
-- nur als Fehlerzeile im Log. Jetzt beide zusaetzlichen Arten aufnehmen.
alter table public.vault_events
  drop constraint if exists vault_events_kind_check;
alter table public.vault_events
  add constraint vault_events_kind_check
  check (kind in ('opened','puzzle_solved','unlock_failed','unlocked','answered',
                  'ticket_mailed','invitation_mailed'));
