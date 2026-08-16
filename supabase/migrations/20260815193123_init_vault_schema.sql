-- Voulez: Tresor-Einladungen
-- Kein direkter Client-Zugriff. Alle Zugriffe laufen ueber Next.js Route
-- Handlers mit dem Service-Role-Key. RLS ist aktiviert, es gibt bewusst
-- KEINE Policies -> anon und authenticated sehen nichts.

create extension if not exists pgcrypto;

-- Haupttabelle -------------------------------------------------------------

create table public.vaults (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,

  -- Geheimnisse: verlassen die DB nie Richtung Browser
  pin_hash           text not null,
  pin_length         smallint not null default 4,
  edit_token_hash    text not null,
  confirm_token_hash text,

  -- Inhalt
  creator_email      text not null,
  creator_name       text,
  recipient_name     text not null,
  intro_text         text,
  reveal_text        text not null,
  closing_text       text,

  -- Praesentation
  theme              text not null default 'brass',
  timezone           text not null default 'Europe/Zurich',

  -- Lebenszyklus
  status             text not null default 'draft'
                     check (status in ('draft','live','answered','declined','expired','disabled')),

  -- Brute-Force-Schutz
  failed_attempts    integer not null default 0,
  locked_until       timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  confirmed_at       timestamptz,
  expires_at         timestamptz not null default (now() + interval '90 days'),

  constraint vaults_slug_format check (slug ~ '^[a-z0-9-]{4,32}$'),
  constraint vaults_pin_length  check (pin_length between 2 and 8)
);

comment on column public.vaults.pin_hash is
  'scrypt-Hash der PIN. Darf niemals an einen Client ausgeliefert werden.';

-- Raetsel ------------------------------------------------------------------

create table public.vault_puzzles (
  id           uuid primary key default gen_random_uuid(),
  vault_id     uuid not null references public.vaults(id) on delete cascade,
  type         text not null check (type in ('quiz','memory','numberlock','wordle')),
  position     smallint not null,
  title        text,
  hint_text    text,

  -- ENTHAELT DIE LOESUNG. Nur serverseitig lesen, nie serialisieren.
  config       jsonb not null default '{}'::jsonb,

  -- PIN-Ziffer, die dieses Raetsel freigibt
  reveal_digit char(1) not null check (reveal_digit ~ '^[0-9]$'),

  created_at   timestamptz not null default now(),

  unique (vault_id, position)
);

comment on column public.vault_puzzles.config is
  'Raetsel-Konfiguration inklusive Loesung. Nur ueber toPlayerConfig() filtern.';

-- Auswahl: Art der Unternehmung -------------------------------------------

create table public.date_options (
  id          uuid primary key default gen_random_uuid(),
  vault_id    uuid not null references public.vaults(id) on delete cascade,
  label       text not null,
  icon        text not null default 'sparkles',
  description text,
  position    smallint not null,

  unique (vault_id, position)
);

-- Auswahl: freigegebene Zeitfenster ---------------------------------------

create table public.date_slots (
  id        uuid primary key default gen_random_uuid(),
  vault_id  uuid not null references public.vaults(id) on delete cascade,
  day       date not null,
  time_from time not null,
  time_to   time not null,

  constraint date_slots_order check (time_to > time_from),
  unique (vault_id, day, time_from)
);

-- Die Antwort --------------------------------------------------------------

create table public.responses (
  id           uuid primary key default gen_random_uuid(),
  vault_id     uuid not null unique references public.vaults(id) on delete cascade,
  accepted     boolean not null default true,
  option_id    uuid references public.date_options(id) on delete set null,
  starts_at    timestamptz,
  duration_min integer not null default 120,
  message      text,
  created_at   timestamptz not null default now(),

  -- Bei Zusage muessen Option und Zeitpunkt gesetzt sein, bei Absage nicht.
  constraint responses_accepted_complete check (
    not accepted or (option_id is not null and starts_at is not null)
  )
);

-- Ereignis-Log fuer den Fortschritts-Ping an den Ersteller ------------------

create table public.vault_events (
  id         uuid primary key default gen_random_uuid(),
  vault_id   uuid not null references public.vaults(id) on delete cascade,
  kind       text not null check (kind in
               ('opened','puzzle_solved','unlock_failed','unlocked','answered')),
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Rate-Limiting (serverless -> kein gemeinsamer Speicher, also DB) ---------

create table public.rate_limits (
  bucket       text primary key,
  hits         integer not null default 0,
  window_start timestamptz not null default now()
);

-- Indizes ------------------------------------------------------------------

create index vault_puzzles_vault_idx on public.vault_puzzles (vault_id, position);
create index date_options_vault_idx  on public.date_options  (vault_id, position);
create index date_slots_vault_idx    on public.date_slots    (vault_id, day, time_from);
create index vault_events_vault_idx  on public.vault_events  (vault_id, created_at desc);
create index vaults_status_idx       on public.vaults        (status, expires_at);

-- updated_at ---------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger vaults_touch_updated_at
  before update on public.vaults
  for each row execute function public.touch_updated_at();

-- RLS: alles zu. Keine Policies = kein Zugriff fuer anon/authenticated. -----

alter table public.vaults        enable row level security;
alter table public.vault_puzzles enable row level security;
alter table public.date_options  enable row level security;
alter table public.date_slots    enable row level security;
alter table public.responses     enable row level security;
alter table public.vault_events  enable row level security;
alter table public.rate_limits   enable row level security;

revoke all on all tables in schema public from anon, authenticated;
