const assert = require('node:assert/strict');
const fs = require('node:fs');
const sql = fs.readFileSync('supabase/migrations/20260915140000_optimize_rls_and_foreign_keys.sql', 'utf8');

for (const policy of ['p1', 'p2', 'p3', 'p4', 'tochka_access']) {
  assert(new RegExp(`alter policy ${policy}[^;]+\\(select auth\\.uid\\(\\)\\)`, 's').test(sql),
    `${policy}: auth.uid() must be initialized once per query`);
}
for (const index of [
  'push_deliveries_subscription_id_idx',
  'studkab_gen_recoveries_job_id_ordinal_idx',
  'studkab_push_deliveries_subscription_id_idx',
  'studkab_requirement_passports_approved_by_idx',
  'studkab_requirement_passports_created_by_idx',
  'studkab_result_reviews_reviewer_id_idx',
  'studkab_result_reviews_version_id_idx',
  'studkab_result_versions_recipient_id_idx',
  'studkab_results_review_id_idx',
  'studkab_results_version_id_idx',
  'tochka_assistant_deliveries_user_id_idx',
  'tochka_telegram_reminder_config_owner_id_idx'
]) assert(sql.includes(`create index if not exists ${index}`), `${index}: missing`);

assert(!/drop\s+index/i.test(sql), 'stage 15 must not remove low-sample indexes');
assert(!/before_561_20260907/i.test(sql), 'immutable release backup must stay unchanged');
console.log('PASS: five RLS policies optimized; twelve FK indexes added; uncertain indexes and archive preserved');
