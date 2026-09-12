-- Install only after the worker has been deployed. Starts disabled via config.
select cron.schedule('tochka-telegram-every-minute','* * * * *',$job$
 select net.http_post(
  url:='https://dcpthwmuiodrjepifzsd.supabase.co/functions/v1/tochka-telegram-reminders',
  headers:=jsonb_build_object('Content-Type','application/json','x-job-key',c.cron_token),
  body:='{}'::jsonb,timeout_milliseconds:=55000)
 from public.tochka_telegram_reminder_config c where c.id=1 and c.enabled;
$job$);
select cron.schedule('tochka-telegram-cleanup','23 3 * * *',$job$
 delete from public.tochka_telegram_reminder_deliveries where created_at<now()-interval '30 days';
$job$);
