import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {basename,dirname,join,normalize} from 'node:path';

const workflow=readFileSync('.github/workflows/kalendar.yml','utf8');
const config=readFileSync('supabase/config.toml','utf8');
const entrypoint=readFileSync('assistant-lab/direct-telegram/index.ts','utf8');

assert.match(workflow,/assistant-lab\/direct-telegram/);
assert.match(workflow,/! -name 'semantic-corpus\.mjs'/);
assert.match(workflow,/tochka-assistant-receiver/);
assert.match(workflow,/DEPLOY_SHA/);
assert.match(workflow,/deploy_functions=\(/);
assert.match(workflow,/functions deploy "\$name"/);
assert.doesNotMatch(workflow,/supabase\/functions\/\*\//);
assert.match(workflow,/curl[\s\S]*?tochka-assistant-receiver/);
assert.match(workflow,/grep -Fq "\\"version\\":\\"\$\{DEPLOY_SHA\}\\""/);
assert.match(workflow,/workflow_dispatch:/);
assert.doesNotMatch(workflow,/workflow_run:/);
assert.match(workflow,/test "\$GITHUB_REF" = "refs\/heads\/main"/);
assert.match(workflow,/test "\$CONFIRMATION" = "DEPLOY"/);
assert.match(workflow,/DEPLOY_SHA: \$\{\{ github\.sha \}\}/);
assert.match(workflow,/tochka-assistant-control/);
assert.match(workflow,/assistant-lab\/pilot\/control-index\.ts/);
assert.match(workflow,/request_status OPTIONS tochka-assistant-calendar "200 401"/);
assert.match(workflow,/request_status OPTIONS tochka-assistant-sandbox "200 401"/);
assert.match(workflow,/tochka-telegram-reminders/);
assert.match(workflow,/assistant-lab\/reminders/);
assert.match(config,/\[functions\.tochka-assistant-receiver\][\s\S]*?verify_jwt\s*=\s*false/);
assert.match(config,/\[functions\.tochka-assistant-control\][\s\S]*?verify_jwt\s*=\s*true/);
assert.match(config,/\[functions\.tochka-assistant-calendar\][\s\S]*?verify_jwt\s*=\s*true/);
assert.match(config,/\[functions\.tochka-assistant-sandbox\][\s\S]*?verify_jwt\s*=\s*true/);
assert.match(config,/\[functions\.tochka-telegram-reminders\][\s\S]*?verify_jwt\s*=\s*false/);
assert.match(entrypoint,/BUILD_VERSION/);

// Build the static runtime dependency closure from the real Edge Function
// entrypoint. Every dependency must be present in the canonical recovery
// snapshot, while test-only semantic-corpus.mjs must be absent from both the
// runtime graph and the deploy bundle.
const sourceDir='assistant-lab/direct-telegram';
const snapshotDir='supabase/functions/tochka-assistant-receiver';
const pending=['index.ts'];
const runtime=new Set();
while(pending.length){
 const relative=pending.pop();
 if(runtime.has(relative))continue;
 runtime.add(relative);
 const source=readFileSync(join(sourceDir,relative),'utf8');
 for(const match of source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)){
  const dependency=normalize(join(dirname(relative),match[1])).replaceAll('\\','/');
  assert.ok(!dependency.startsWith('../'),`runtime import escapes receiver bundle: ${dependency}`);
  pending.push(dependency);
 }
}
assert.ok(!runtime.has('semantic-corpus.mjs'));
const deployCopyCandidates=readdirSync(sourceDir)
 .filter(name=>name==='index.ts'||(name.endsWith('.mjs')&&!name.endsWith('-test.mjs')&&!name.endsWith('.test.mjs')&&name!=='semantic-corpus.mjs'))
 .sort();
assert.deepEqual([...runtime].sort(),deployCopyCandidates,'deploy copy must equal the receiver runtime dependency closure');
const snapshotFiles=readdirSync(snapshotDir).sort();
for(const dependency of runtime)assert.ok(snapshotFiles.includes(basename(dependency)),`recovery snapshot misses ${dependency}`);
assert.ok(!snapshotFiles.includes('semantic-corpus.mjs'));

console.log('PASS Telegram receiver is assembled, configured and version-checked for deployment');
