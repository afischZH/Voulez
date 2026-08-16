-- Atomarer Rate-Limit-Zaehler. Gibt true zurueck, wenn der Versuch erlaubt ist.
create or replace function public.hit_rate_limit(
  p_bucket  text,
  p_limit   integer,
  p_window  interval
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits (bucket, hits, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update
    set hits = case
          when public.rate_limits.window_start < now() - p_window then 1
          else public.rate_limits.hits + 1
        end,
        window_start = case
          when public.rate_limits.window_start < now() - p_window then now()
          else public.rate_limits.window_start
        end
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

-- Fehlversuch zaehlen und ab 10 Versuchen fuer 15 Minuten sperren.
create or replace function public.register_failed_unlock(p_vault_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locked_until timestamptz;
begin
  update public.vaults
     set failed_attempts = failed_attempts + 1,
         locked_until = case
           when failed_attempts + 1 >= 10 then now() + interval '15 minutes'
           else locked_until
         end
   where id = p_vault_id
  returning locked_until into v_locked_until;

  return v_locked_until;
end;
$$;

revoke all on function public.hit_rate_limit(text, integer, interval) from public, anon, authenticated;
revoke all on function public.register_failed_unlock(uuid) from public, anon, authenticated;
