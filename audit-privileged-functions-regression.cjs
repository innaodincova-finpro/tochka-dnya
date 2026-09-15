const assert = require('node:assert/strict');
const fs = require('node:fs');

const migration = fs.readFileSync('supabase/migrations/20260915120000_harden_privileged_tochka_functions.sql', 'utf8');
const kabinet = fs.readFileSync('supabase/functions/kabinet/index.ts', 'utf8');

assert(!migration.includes('inna_odincova@mail.ru'), 'owner email remains in the database function');
assert.match(migration, /revoke all on function public\.tochka_manage_access\(uuid,text,text\) from public, anon, authenticated/i);
assert.match(migration, /grant execute on function public\.tochka_manage_access\(uuid,text,text\) to service_role/i);
assert.match(migration, /create or replace function public\.tochka_visit\(\)[\s\S]*security invoker/i);
assert.match(migration, /grant update\(last_seen_at\) on public\.tochka_members to authenticated/i);
assert.match(migration, /user_id = \(select auth\.uid\(\)\) and revoked_at is null/i);
assert(kabinet.includes("Authorization:'Bearer '+SERVICE_KEY"), 'privileged RPC does not use the server role');
assert(!kabinet.includes("Authorization:req.headers.get('authorization')"), 'user token still reaches privileged RPC');

console.log('PASS: privileged access is server-only; visit updates only the caller last_seen_at');
