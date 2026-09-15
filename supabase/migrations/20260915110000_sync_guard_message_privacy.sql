-- Keep the protocol gate, but do not tell people to install an old version.
create or replace function public.tochka_sync_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
begin
  if coalesce(headers->>'x-client-info', '') not like '%tochka-dnya/5.6.1%' then
    raise exception 'Эта копия приложения больше не поддерживает облачную синхронизацию. Закройте её и откройте актуальную «Точку дня»' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
