const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');

const manifest=fs.readFileSync('supabase/rebuild.sql','utf8');
const includes=[...manifest.matchAll(/^\\ir\s+(.+)$/gm)].map(m=>m[1].trim());
const expectedIncludes=[
  'DATABASE_SETUP.sql',
  'DATABASE_SYNC_GUARD.sql',
  'migrations/20260907110737_direct_push.sql',
  'migrations/20260909163029_atomic_pending_invitation_delete.sql',
  'migrations/20260909170917_tochka_app_scoped_access.sql',
  '../assistant-lab/link-schema.sql',
  '../assistant-lab/pilot/pilot.sql',
  '../assistant-lab/pilot/dialog.sql',
  '../assistant-lab/direct-telegram/actions.sql',
  '../assistant-lab/direct-telegram/direct-save.sql',
  '../assistant-lab/sandbox/schema.sql',
  '../assistant-lab/calendar/schema.sql',
  '../assistant-lab/reminders/schema.sql',
  '../assistant-lab/reminders/cron.sql',
  'migrations/20260913150000_documents_storage_v1.sql',
  'migrations/20260915090000_audit_stage_5_access_and_unlink.sql',
  'migrations/20260915100000_telegram_reminder_recovery.sql',
  'migrations/20260915110000_sync_guard_message_privacy.sql',
  'migrations/20260915120000_harden_privileged_tochka_functions.sql',
  'recovery/20260915133000_reaffirm_server_only_table_access_tochka_only.sql',
  'recovery/20260915140000_optimize_rls_and_foreign_keys_tochka_only.sql',
  'migrations/20260917110000_minimize_tochka_client_grants.sql'
];
assert.deepEqual(includes,expectedIncludes,'rebuild sources or dependency order changed');
for(const relative of includes){
  const absolute=path.resolve('supabase',relative);
  assert.ok(fs.existsSync(absolute),`missing rebuild source: ${relative}`);
}
const combined=includes.map(relative=>fs.readFileSync(path.resolve('supabase',relative),'utf8')).join('\n');
for(const table of [
  'user_app_data','push_configuration','push_subscriptions','push_deliveries',
  'tochka_members','tochka_documents',
  'tochka_assistant_links','tochka_assistant_pilot','tochka_assistant_deliveries',
  'tochka_assistant_actions','tochka_assistant_confirmed','tochka_assistant_sandbox',
  'tochka_telegram_reminder_config','tochka_telegram_reminder_deliveries'
]) assert.match(combined,new RegExp(`(?:create table(?: if not exists)? public\\.${table}|create table(?: if not exists)? ${table})\\b`,'i'),`table not reproducible: ${table}`);
assert.match(combined,/create policy\s+tochka_access\s+on\s+public\.user_app_data/i,'policy altered by recovery source is not created first');
for(const fn of ['tochka_sync_guard','tochka_manage_access','tochka_assistant_reserve','tochka_assistant_confirm','tochka_claim_telegram_reminder'])
  assert.match(combined,new RegExp(`create(?: or replace)? function public\\.${fn}\\b`,'i'),`function not reproducible: ${fn}`);
for(const migration of [
  '20260915100000_telegram_reminder_recovery.sql',
  '20260915110000_sync_guard_message_privacy.sql',
  '20260915120000_harden_privileged_tochka_functions.sql',
  '20260917110000_minimize_tochka_client_grants.sql'
]) assert.ok(includes.some(relative=>relative.endsWith(migration)),`missing post-audit rebuild source: ${migration}`);
assert.equal(
  includes.at(-1),
  'migrations/20260917110000_minimize_tochka_client_grants.sql',
  'client grants migration must be the final rebuild source'
);
for(const mixedMigration of [
  'migrations/20260915133000_reaffirm_server_only_table_access.sql',
  'migrations/20260915140000_optimize_rls_and_foreign_keys.sql'
]) assert.equal(includes.includes(mixedMigration),false,`mixed-project migration included directly: ${mixedMigration}`);
for(const recoverySource of expectedIncludes.filter(relative=>relative.startsWith('recovery/'))){
  const sql=fs.readFileSync(path.resolve('supabase',recoverySource),'utf8');
  const executableSql=sql.replace(/--[^\n]*/g,'');
  const provenance=sql.match(/Provenance: (supabase\/migrations\/[^\s]+)/);
  const recordedHash=sql.match(/Source SHA-256: ([a-f0-9]{64})/);
  assert.ok(provenance,`missing provenance: ${recoverySource}`);
  assert.ok(recordedHash,`missing source hash: ${recoverySource}`);
  const actualSourceHash=crypto.createHash('sha256').update(fs.readFileSync(provenance[1])).digest('hex');
  assert.equal(recordedHash[1],actualSourceHash,`stale provenance hash: ${recoverySource}`);
  assert.doesNotMatch(executableSql,/studkab|public\.app_data/i,`non-Tochka dependency in recovery source: ${recoverySource}`);
  const createdTables=new Set([...combined.matchAll(/create table(?: if not exists)?(?: public\.)?([a-z0-9_]+)/gi)].map(match=>match[1]));
  for(const [,referencedTable] of executableSql.matchAll(/public\.([a-z0-9_]+)/gi))
    assert.ok(createdTables.has(referencedTable),`unresolved table ${referencedTable} in ${recoverySource}`);
}

const recoveryFunctions={
  'kalendar':['index.ts'],
  'kabinet':['index.ts'],
  'push':['index.ts'],
  'tochka-assistant-setup':['index.ts','handler.mjs'],
  'tochka-assistant-link':['index.ts','handler.mjs'],
  'tochka-assistant-control':['index.ts','control.mjs','common.mjs'],
  'tochka-assistant-receiver':['index.ts','receiver.mjs','common.mjs','actions.mjs','documents.mjs','voice.mjs'],
  'tochka-assistant-sandbox':['index.ts','handler.mjs','common.mjs','proposal.mjs'],
  'tochka-assistant-calendar':['index.ts','handler.mjs','common.mjs','proposal.mjs'],
  'tochka-telegram-reminders':['index.ts','worker.mjs','common.mjs','schedule.mjs']
};
for(const [slug,files] of Object.entries(recoveryFunctions)){
  const directory=path.resolve('supabase/functions',slug);
  for(const file of files)
    assert.ok(fs.existsSync(path.join(directory,file)),`missing recovery function source: ${slug}/${file}`);
}
const recoveryInventory=fs.readFileSync('RECOVERY_OBJECT_MANIFEST_2026-09-17.md','utf8');
const finalMigration='supabase/migrations/20260917110000_minimize_tochka_client_grants.sql';
const finalMigrationHash=crypto.createHash('sha256').update(fs.readFileSync(finalMigration)).digest('hex');
assert.match(
  recoveryInventory,
  new RegExp('\\\\| `20260917110000_minimize_tochka_client_grants\\.sql` \\\\| `'+finalMigrationHash+'` \\\\|'),
  'stale final migration hash in recovery manifest'
);
for(const slug of Object.keys(recoveryFunctions)){
  const directory=path.resolve('supabase/functions',slug);
  const fileList=fs.readdirSync(directory).filter(file=>fs.statSync(path.join(directory,file)).isFile()).sort();
  const checksumList=fileList.map(file=>{
    const digest=crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex');
    return `${digest}  ${file}\n`;
  }).join('');
  const treeHash=crypto.createHash('sha256').update(checksumList).digest('hex');
  assert.match(
    recoveryInventory,
    new RegExp('\\\\| `'+slug+'` \\\\| \\\\d+ \\\\| `'+treeHash+'` \\\\|'),
    `stale recovery hash: ${slug}`
  );
}

const functionSources=Object.keys(recoveryFunctions).flatMap(slug=>
  fs.readdirSync(path.resolve('supabase/functions',slug))
    .filter(file=>/\.(?:ts|mjs)$/.test(file))
    .map(file=>fs.readFileSync(path.resolve('supabase/functions',slug,file),'utf8'))
).join('\n');
for(const variable of [
  'SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY',
  'TOCHKA_ASSISTANT_BOT_TOKEN','TOCHKA_ASSISTANT_OWNER_EMAIL',
  'TOCHKA_ASSISTANT_DEEPSEEK_API_KEY','TOCHKA_ASSISTANT_TRANSCRIBE_URL',
  'TOCHKA_ASSISTANT_TRANSCRIBE_SECRET'
]) assert.match(functionSources,new RegExp(`['\"]${variable}['\"]`),`secret manifest source missing: ${variable}`);
for(const cronTemplate of [
  'supabase/migrations/20260907110737_direct_push.sql',
  'assistant-lab/reminders/cron.sql'
]){
  const sql=fs.readFileSync(cronTemplate,'utf8');
  assert.doesNotMatch(sql,/dcpthwmuiodrjepifzsd/,`production project URL in portable cron template: ${cronTemplate}`);
  assert.match(sql,/app\.settings\.tochka_functions_base_url/,`missing recovery URL setting: ${cronTemplate}`);
}
const functionConfig=fs.readFileSync('supabase/config.toml','utf8');
for(const [slug,verifyJwt] of Object.entries({
  kalendar:false,
  kabinet:false,
  push:false,
  'tochka-assistant-setup':true,
  'tochka-assistant-link':true,
  'tochka-assistant-control':true,
  'tochka-assistant-receiver':false,
  'tochka-assistant-sandbox':true,
  'tochka-assistant-calendar':true,
  'tochka-telegram-reminders':false
})){
  const escaped=slug.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  assert.match(
    functionConfig,
    new RegExp(`\\[functions\\.${escaped}\\]\\s+(?:#[^\\n]*\\s+)*verify_jwt\\s*=\\s*${verifyJwt}`),
    `missing verify_jwt recovery config: ${slug}`
  );
}
assert.match(manifest,/\\set ON_ERROR_STOP on/);
console.log(`PASS: rebuild manifest covers ${includes.length} ordered schema sources`);
