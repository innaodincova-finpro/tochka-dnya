const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('index.html','utf8');
const worker=fs.readFileSync('sw.js','utf8');
const registry=fs.readFileSync('reestr.html','utf8');
assert.match(app,/href="\.\/reestr\.html"/,'application must open the working registry');
assert.doesNotMatch(app,/href="\/reestr-tochki\/"/,'application must not point to the incomplete registry site');
const shell=worker.slice(worker.indexOf('const APP_SHELL'),worker.indexOf('];',worker.indexOf('const APP_SHELL')));
for(const asset of ['reestr.html','registry.js','registry.webmanifest','registry-icon-180.png','registry-icon-192.png','registry-icon-512.png'])
  assert.ok(!shell.includes(asset),`registry must not be preloaded: ${asset}`);
assert.doesNotMatch(registry,/Установить отдельный Реестр/);
assert.ok(!fs.existsSync('assistant-lab/integration/pilot/index.html'),'generated pilot application must not be published');
console.log('PASS: working registry is on demand; incomplete registry link and public pilot snapshot are absent');
