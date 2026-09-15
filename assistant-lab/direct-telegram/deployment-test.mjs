import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync('.github/workflows/kalendar.yml','utf8');
const config=readFileSync('supabase/config.toml','utf8');
const entrypoint=readFileSync('assistant-lab/direct-telegram/index.ts','utf8');

assert.match(workflow,/assistant-lab\/direct-telegram/);
assert.match(workflow,/tochka-assistant-receiver/);
assert.match(workflow,/GITHUB_SHA/);
assert.match(workflow,/functions deploy "\$name"/);
assert.match(workflow,/curl[\s\S]*?tochka-assistant-receiver/);
assert.match(workflow,/workflow_run:[\s\S]*?workflows: \["Проверка приложения"\]/);
assert.match(workflow,/workflow_run\.conclusion == 'success'/);
assert.match(workflow,/tochka-assistant-control/);
assert.match(workflow,/assistant-lab\/pilot\/control-index\.ts/);
assert.match(workflow,/tochka-telegram-reminders/);
assert.match(workflow,/assistant-lab\/reminders/);
assert.match(config,/\[functions\.tochka-assistant-receiver\][\s\S]*?verify_jwt\s*=\s*false/);
assert.match(config,/\[functions\.tochka-assistant-control\][\s\S]*?verify_jwt\s*=\s*true/);
assert.match(config,/\[functions\.tochka-telegram-reminders\][\s\S]*?verify_jwt\s*=\s*false/);
assert.match(entrypoint,/BUILD_VERSION/);

console.log('PASS Telegram receiver is assembled, configured and version-checked for deployment');
