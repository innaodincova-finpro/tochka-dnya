const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const workflowsDir = join(__dirname, '.github', 'workflows');
const workflowFiles = readdirSync(workflowsDir)
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();
const actionReference = /^\s*-?\s*uses:\s*([^\s#]+)\s*$/gm;
const immutableReference = /^[^@]+@[0-9a-f]{40}$/;

for (const file of workflowFiles) {
  const source = readFileSync(join(workflowsDir, file), 'utf8');
  assert.doesNotMatch(source, /^\s*pull_request_target\s*:/m);
  for (const match of source.matchAll(actionReference)) {
    assert.match(
      match[1],
      immutableReference,
      `${file}: стороннее действие ${match[1]} должно быть закреплено полным неизменяемым идентификатором`,
    );
  }
}

const deployment = readFileSync(join(workflowsDir, 'kalendar.yml'), 'utf8');
assert.match(deployment, /^\s*workflow_dispatch\s*:/m);
assert.doesNotMatch(deployment, /workflow_run:/);
assert.match(deployment, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
assert.match(deployment, /test "\$CONFIRMATION" = "DEPLOY"/);
assert.match(deployment, /ref:\s*\$\{\{\s*github\.sha\s*\}\}/);
assert.match(deployment, /DEPLOY_SHA:\s*\$\{\{\s*github\.sha\s*\}\}/);
assert.match(deployment, /npm test/);
assert.match(deployment, /npm run test:recovery/);
assert.doesNotMatch(deployment, /version:\s*latest/);
assert.match(deployment, /environment:\s*production/);
assert.match(deployment, /! -name '\*-test\.mjs'/);
assert.match(deployment, /! -name '\*\.test\.mjs'/);
assert.match(deployment, /find supabase\/functions -type f[\s\S]*?Тестовый файл попал в runtime bundle/);

const allowlistMatch = deployment.match(/deploy_functions=\(\s*([\s\S]*?)\s*\)/);
assert.ok(allowlistMatch, 'должен быть явный список разрешённых к выкладке функций');
const allowlist = allowlistMatch[1].trim().split(/\s+/).sort();
assert.deepEqual(allowlist, [
  'kabinet',
  'kalendar',
  'push',
  'tochka-assistant-calendar',
  'tochka-assistant-control',
  'tochka-assistant-link',
  'tochka-assistant-receiver',
  'tochka-assistant-sandbox',
  'tochka-assistant-setup',
  'tochka-telegram-reminders',
].sort());
assert.doesNotMatch(deployment, /supabase\/functions\/\*\//);
assert.match(deployment, /find supabase\/functions[\s\S]*?-mindepth 1[\s\S]*?-maxdepth 1[\s\S]*?LC_ALL=C sort/);
assert.match(deployment, /diff -u[\s\S]*?expected_functions[\s\S]*?actual_functions/);
assert.match(deployment, /test -f "supabase\/functions\/\$name\/index\.ts"/);
assert.match(deployment, /tochka-deploy-functions\.txt/);

for (const [method, name, status] of [
  ['GET', 'tochka-assistant-receiver', '200'],
  ['GET', 'kalendar', '400'],
  ['GET', 'push', '405'],
  ['GET', 'kabinet', '"401 503"'],
  ['OPTIONS', 'tochka-assistant-link', '"200 401"'],
  ['OPTIONS', 'tochka-assistant-setup', '"200 401"'],
  ['OPTIONS', 'tochka-assistant-calendar', '"200 401"'],
  ['OPTIONS', 'tochka-assistant-sandbox', '"200 401"'],
  ['GET', 'tochka-assistant-control', '401'],
  ['GET', 'tochka-telegram-reminders', '405'],
]) {
  assert.match(deployment, new RegExp(`request_status ${method} ${name} ${status}`));
}
assert.match(deployment, /grep -Fq "\\"version\\":\\"\$\{DEPLOY_SHA\}\\""/);
assert.match(deployment, /\{error: 'Кабинет временно не настроен'\}/);
assert.match(deployment, /\[\[ " \$expected " != \*" \$code "\* \]\]/);
assert.match(deployment, /Выкладка не атомарна/);
assert.match(deployment, /Автоматический откат не выполнялся/);
assert.match(deployment, /deployed\+=\("\$name"\)/);

assert.ok(
  !workflowFiles.includes('production-database-migration.yml'),
  'production-миграция не должна быть исполняемой до отдельной Supabase-репетиции',
);

console.log('PASS production-выпуск требует ручного подтверждения и повторных тестов; неподтверждённая DB-миграция заблокирована');
