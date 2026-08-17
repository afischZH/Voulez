-- Das Ticket bekommt eine eigene Adresse.
--
-- Bisher lebte es nur im Browser des Besuchs: eine Zusage, ein Bildschirm --
-- und mit dem Tab war die Karte weg. Jede Zusage bekommt jetzt einen eigenen,
-- unratbaren Link (/t/<token>), der dieselbe Karte jederzeit wieder zeigt.
--
-- Gespeichert wird nur der Hash, wie schon bei edit_token_hash und
-- confirm_token_hash: wer die Datenbank sieht, haelt damit keinen
-- funktionierenden Link in der Hand.

alter table public.responses
  add column if not exists ticket_token_hash text;

-- Unique, damit ein Link nie auf zwei Zusagen zeigen kann. Mehrere NULL sind
-- in Postgres erlaubt -- Absagen und Altbestand stoeren also nicht.
create unique index if not exists responses_ticket_token_hash_idx
  on public.responses (ticket_token_hash);

comment on column public.responses.ticket_token_hash is
  'SHA-256 des Ticket-Links. Faellt mit dem Tresor nach 90 Tagen weg.';
