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
assert.doesNotMatch(deployment, /^\s*workflow_dispatch\s*:/m);
assert.match(deployment, /workflow_run:[\s\S]*?workflows:\s*\["Проверка приложения"\]/);
assert.match(deployment, /github\.event\.workflow_run\.event\s*==\s*'push'/);
assert.match(deployment, /github\.event\.workflow_run\.head_branch\s*==\s*'main'/);
assert.match(deployment, /github\.event\.workflow_run\.head_repository\.full_name\s*==\s*github\.repository/);
assert.match(deployment, /github\.event\.workflow_run\.conclusion\s*==\s*'success'/);
assert.match(deployment, /ref:\s*\$\{\{\s*github\.event\.workflow_run\.head_sha\s*\}\}/);
assert.doesNotMatch(deployment, /version:\s*latest/);
assert.match(deployment, /environment:\s*production/);

console.log('PASS рабочая выкладка принимает только успешно проверенный код основной линии');
