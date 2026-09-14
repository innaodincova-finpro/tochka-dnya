alter table public.tochka_assistant_sandbox
 add column calendar_event jsonb check(calendar_event is null or (jsonb_typeof(calendar_event)='object' and octet_length(calendar_event::text)<12000)),
 add column calendar_revision integer not null default 0 check(calendar_revision>=0);
grant update(calendar_event,calendar_revision) on public.tochka_assistant_sandbox to service_role;
