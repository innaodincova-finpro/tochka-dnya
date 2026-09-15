const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = file => fs.readFileSync(file, 'utf8');
const publicFiles = [
  'index.html',
  'registry.js',
  'assistant-lab/integration/acceptance/visual/index.html',
  'supabase/functions/kabinet/index.ts',
  'supabase/functions/push/index.ts',
];
for (const file of publicFiles) {
  assert(!read(file).includes('inna_odincova@mail.ru'), `${file}: personal admin email leaked`);
}

const app = read('index.html');
assert(app.includes('tochka-dnya/5.6.1'), 'protocol marker changed unexpectedly');
assert(!app.includes('const ADMIN_EMAIL'), 'browser still contains an admin email rule');

const registry = read('registry.js');
assert(registry.includes('p.eto_vladelets'), 'registry does not use the server owner flag');

const kabinet = read('supabase/functions/kabinet/index.ts');
assert(kabinet.includes("Deno.env.get('ADMIN_EMAIL') || ''"), 'server has an admin fallback');
assert(kabinet.includes('if (!ADMIN)'), 'server accepts an empty admin configuration');
assert(kabinet.includes('eto_vladelets: owner'), 'server does not return the owner flag');

const push = read('supabase/functions/push/index.ts');
assert(push.includes("subject:'https://"), 'VAPID subject is not a public HTTPS contact');

for (const file of ['DATABASE_SETUP.sql', 'supabase/DATABASE_SETUP.sql', 'supabase/DATABASE_SYNC_GUARD.sql']) {
  const sql = read(file);
  assert(sql.includes('tochka-dnya/5.6.1'), `${file}: protocol gate changed`);
  assert(!sql.includes('Обновите Точку дня до версии 5.6.1'), `${file}: obsolete upgrade instruction remains`);
  assert(sql.includes('откройте актуальную «Точку дня»'), `${file}: neutral recovery message missing`);
}

console.log('PASS: admin identity stays server-side; protocol gate remains; obsolete instruction removed');
