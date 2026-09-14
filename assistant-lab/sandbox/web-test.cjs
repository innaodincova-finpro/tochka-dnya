const {JSDOM}=require('jsdom');const fs=require('node:fs'),assert=require('node:assert/strict');
let version=new Date().toISOString(),proposal={kind:'note',title:'<img src=x onerror=alert(1)> проверка'},records=[],confirmCalls=0;
const wait=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};
function tab(){const dom=new JSDOM(fs.readFileSync(__dirname+'/web/sandbox.html','utf8'),{url:'https://innaodincova-finpro.github.io/tochka-assistant/sandbox.html',runScripts:'outside-only'}),w=dom.window;
w.AbortSignal=AbortSignal;w.structuredClone=structuredClone;
w.fetch=async(url,opt)=>{if(url.includes('/auth/'))return Response.json({access_token:'fake'});const body=JSON.parse(opt.body);
if(body.action==='status')return Response.json({draft:{version,proposal,complete:true},records});
confirmCalls++;if(body.version!==version)return Response.json({error:'draft_changed'},{status:409});const duplicate=records.some(x=>x.source_version===body.version);if(!duplicate)records.push({source_version:version,proposal,created_at:version});return Response.json({saved:true,duplicate});};
w.eval(fs.readFileSync(__dirname+'/web/sandbox.js','utf8'));
return {w,$:id=>w.document.getElementById(id),async login(){this.$('email').value='owner@example.test';this.$('password').value='test-password';this.$('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait();}};}
(async()=>{const a=tab(),b=tab();await a.login();await b.login();assert.equal(a.$('password').value,'');assert.equal(a.$('preview').querySelector('img'),null);
a.$('save').click();a.$('save').click();await wait();assert.equal(confirmCalls,1);assert.equal(records.length,1);
b.$('save').click();await wait();assert.equal(records.length,1);assert.match(b.$('status').textContent,/Второй записи не создано/);assert.equal(b.$('save').disabled,true);
version=new Date(Date.now()+1000).toISOString();proposal={kind:'note',title:'Новый черновик'};a.$('refresh').click();await wait();version=new Date(Date.now()+2000).toISOString();a.$('save').click();await wait();assert.match(a.$('status').textContent,/Черновик изменился/);assert.equal(records.length,1);
a.$('logout').click();assert.equal(a.$('records').children.length,0);assert.equal(a.$('workspace').hidden,true);a.w.close();b.w.close();console.log('UI: two tabs, double click, stale draft, safe text, logout passed (mock server).');})().catch(e=>{console.error(e);process.exit(1)});
