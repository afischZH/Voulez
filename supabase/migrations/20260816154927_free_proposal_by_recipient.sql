-- Der Ersteller darf dem Besuch erlauben, Unternehmung und Zeitpunkt selbst
-- vorzuschlagen, statt nur aus seinen Vorgaben zu wählen.
alter table public.vaults
  add column if not exists allow_custom_proposal boolean not null default false;

alter table public.responses
  add column if not exists custom_label text,
  -- Ob der Zeitpunkt ausserhalb der freigegebenen Fenster liegt. Steht so in
  -- der Mail an den Ersteller: er hat diesen Termin nie angeboten.
  add column if not exists custom_time boolean not null default false;

alter table public.responses
  drop constraint if exists responses_custom_label_len;
alter table public.responses
  add constraint responses_custom_label_len
  check (custom_label is null or char_length(custom_label) between 1 and 60);

-- Bisher verlangte eine Zusage zwingend eine der vorgegebenen Optionen.
-- Jetzt genuegt alternativ ein frei getippter Vorschlag.
alter table public.responses
  drop constraint if exists responses_accepted_complete;
alter table public.responses
  add constraint responses_accepted_complete
  check (
    (not accepted)
    or (starts_at is not null and (option_id is not null or custom_label is not null))
  );
