-- Wallet-Paesse (Apple und Google).
--
-- Der Pass selbst braucht keine Tabelle: er wird bei jedem Abruf aus
-- `responses` und `vaults` abgeleitet und nirgends gespeichert. Damit bleibt
-- auch die 90-Tage-Loeschung unveraendert.
--
-- Was fehlt, ist nur der Eintrag in der Liste der Ereignis-Arten. Ohne ihn
-- liefe jedes logEvent(..., 'wallet_added') in den Check und landete bloss
-- als Fehlerzeile im Log -- genau wie seinerzeit `ticket_mailed`.
alter table public.vault_events
  drop constraint if exists vault_events_kind_check;
alter table public.vault_events
  add constraint vault_events_kind_check
  check (kind in ('opened','puzzle_solved','unlock_failed','unlocked','answered',
                  'ticket_mailed','invitation_mailed','wallet_added'));
