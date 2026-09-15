const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const manifest=fs.readFileSync('supabase/rebuild.sql','utf8');
const includes=[...manifest.matchAll(/^\\ir\s+(.+)$/gm)].map(m=>m[1].trim());
assert.ok(includes.length>=14,'rebuild manifest is incomplete');
for(const relative of includes){
  const absolute=path.resolve('supabase',relative);
  assert.ok(fs.existsSync(absolute),`missing rebuild source: ${relative}`);
}
const combined=includes.map(relative=>fs.readFileSync(path.resolve('supabase',relative),'utf8')).join('\n');
for(const table of [
  'user_app_data','push_subscriptions','tochka_members','tochka_documents',
  'tochka_assistant_links','tochka_assistant_pilot','tochka_assistant_deliveries',
  'tochka_assistant_actions','tochka_assistant_confirmed','tochka_assistant_sandbox',
  'tochka_telegram_reminder_config','tochka_telegram_reminder_deliveries'
]) assert.match(combined,new RegExp(`(?:create table(?: if not exists)? public\\.${table}|create table(?: if not exists)? ${table})\\b`,'i'),`table not reproducible: ${table}`);
for(const fn of ['tochka_sync_guard','tochka_manage_access','tochka_assistant_reserve','tochka_assistant_confirm','tochka_claim_telegram_reminder'])
  assert.match(combined,new RegExp(`create(?: or replace)? function public\\.${fn}\\b`,'i'),`function not reproducible: ${fn}`);
assert.match(manifest,/\\set ON_ERROR_STOP on/);
console.log(`PASS: rebuild manifest covers ${includes.length} ordered schema sources`);
