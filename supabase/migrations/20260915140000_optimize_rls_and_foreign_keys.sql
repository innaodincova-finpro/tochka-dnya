-- Stage 15 audit: preserve access semantics while avoiding per-row auth calls.

alter policy p1 on public.app_data
  to authenticated
  using ((select auth.uid()) = user_id);
alter policy p2 on public.app_data
  to authenticated
  with check ((select auth.uid()) = user_id);
alter policy p3 on public.app_data
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy p4 on public.app_data
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy tochka_access on public.user_app_data
  to authenticated
  using (exists (
    select 1 from public.tochka_members m
    where m.user_id = (select auth.uid()) and m.revoked_at is null
  ))
  with check (exists (
    select 1 from public.tochka_members m
    where m.user_id = (select auth.uid()) and m.revoked_at is null
  ));

create index if not exists push_deliveries_subscription_id_idx on public.push_deliveries (subscription_id);
create index if not exists studkab_gen_recoveries_job_id_ordinal_idx on public.studkab_gen_recoveries (job_id, ordinal);
create index if not exists studkab_push_deliveries_subscription_id_idx on public.studkab_push_deliveries (subscription_id);
create index if not exists studkab_requirement_passports_approved_by_idx on public.studkab_requirement_passports (approved_by);
create index if not exists studkab_requirement_passports_created_by_idx on public.studkab_requirement_passports (created_by);
create index if not exists studkab_result_reviews_reviewer_id_idx on public.studkab_result_reviews (reviewer_id);
create index if not exists studkab_result_reviews_version_id_idx on public.studkab_result_reviews (version_id);
create index if not exists studkab_result_versions_recipient_id_idx on public.studkab_result_versions (recipient_id);
create index if not exists studkab_results_review_id_idx on public.studkab_results (review_id);
create index if not exists studkab_results_version_id_idx on public.studkab_results (version_id);
create index if not exists tochka_assistant_deliveries_user_id_idx on public.tochka_assistant_deliveries (user_id);
create index if not exists tochka_telegram_reminder_config_owner_id_idx on public.tochka_telegram_reminder_config (owner_id);
