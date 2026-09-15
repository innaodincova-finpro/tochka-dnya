const assert = require('node:assert/strict');
const fs = require('node:fs');

const migration = fs.readFileSync('supabase/migrations/20260915133000_reaffirm_server_only_table_access.sql', 'utf8');
const report = fs.readFileSync('SUPABASE_SERVER_TABLES.md', 'utf8');
const tables = [...migration.matchAll(/(?:public\.)?((?:push|studkab|tochka)_[a-z0-9_]+)[,\n]/g)].map(match => match[1]);

assert.equal(new Set(tables).size, 30, 'the server-only inventory must contain exactly 30 unique tables');
assert.match(migration, /from public, anon, authenticated;/i);
for (const table of new Set(tables)) {
  assert(report.includes('`' + table + '`'), `${table} is missing from the audit report`);
}
assert(report.includes('HTTP 401'), 'live public-API verification is not recorded');
assert(report.includes('фиктивные разрешающие политики'), 'accepted RLS warning is not documented');

console.log('PASS: 30 server-only tables are explicitly closed and documented');
