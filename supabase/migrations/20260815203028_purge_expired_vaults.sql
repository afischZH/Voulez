create extension if not exists pg_cron with schema pg_catalog;

/*
 * Aufräumen. Die Datenschutzerklärung verspricht Löschung — ohne diesen Job
 * wäre das Versprechen unwahr. Die Fremdschlüssel räumen Rätsel, Optionen,
 * Zeitfenster, Antworten und Ereignisse per ON DELETE CASCADE mit ab.
 */
create or replace function public.purge_expired_vaults()
returns table (deleted_vaults integer, deleted_limits integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vaults integer;
  v_limits integer;
begin
  with gone as (
    delete from public.vaults
     where expires_at < now()
        -- Nie bestätigte Entwürfe braucht niemand länger als eine Woche.
        or (status = 'draft' and created_at < now() - interval '7 days')
    returning 1
  )
  select count(*) into v_vaults from gone;

  with stale as (
    delete from public.rate_limits
     where window_start < now() - interval '2 days'
    returning 1
  )
  select count(*) into v_limits from stale;

  return query select v_vaults, v_limits;
end;
$$;

revoke all on function public.purge_expired_vaults() from public, anon, authenticated;

select cron.schedule(
  'purge-expired-vaults',
  '17 3 * * *',
  $$select public.purge_expired_vaults()$$
);
