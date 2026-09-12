import {JSDOM,ResourceLoader,VirtualConsole} from 'jsdom';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';import {close} from './server.mjs';
const origin='http://127.0.0.1:8767',errors=[];
class LocalOnly extends ResourceLoader{fetch(url,options){if(!url.startsWith(origin+'/'))return null;return super.fetch(url,options);}}
const tabs=[];
async function until(check,label){const deadline=Date.now()+15000;while(Date.now()<deadline){if(await check())return;await new Promise(r=>setTimeout(r,40));}throw Error('Timeout: '+label);}
async function tab(name){
const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/Could not load link|Could not load img|Not implemented: window.scrollTo/.test(e.message))errors.push(e.message);});
const d=await JSDOM.fromURL(origin+'/index.html?device='+name,{runScripts:'dangerously',resources:new LocalOnly(),pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
w.fetch=(url,opts)=>{assert.ok(String(url).startsWith(origin+'/'),'external request denied');return fetch(url,opts);};Object.assign(w,{Headers,Request,Response,AbortController,AbortSignal,TextEncoder,TextDecoder,structuredClone});
Object.defineProperty(w,'crypto',{value:webcrypto});w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};}});
tabs.push(d);await until(()=>d.window.document.getElementById('saved')?.textContent.includes('сохранено в облаке'),'initial sync '+name);return d.window;
}
const report=()=>fetch(origin+'/test-report').then(r=>r.json());
try{
const a=await tab('a'),b=await tab('b');
a.document.querySelector('button[onclick="openAssistantImport()"]').click();
await until(()=>a.document.querySelector('#assistant-list button'),'assistant list');
assert.equal((await report()).rows[0].payload.ev.length,1);
a.document.querySelector('#assistant-list button').click();
assert.equal((await report()).rows[0].payload.ev.length,1);
a.document.getElementById('assistant-confirm').click();
await until(()=>a.document.getElementById('assistant-message')?.textContent.includes('сохранена в облаке'),'confirm cloud save');
let data=await report();assert.equal(data.rows[0].payload.ev.length,2);
const event=data.rows[0].payload.ev.find(x=>x.title==='Пробная встреча помощника');assert.equal(event.time,'17:00');
a.document.getElementById('assistant-close').click();
// Real UI manual synchronization action in second independent device.
b.document.querySelector('[onclick="toggleFold(\'more-cloud\')"]').click();
b.document.querySelector('button[onclick="pushCloud()"]').click();
await until(()=>b.document.getElementById('saved').textContent.includes('сохранено в облаке'),'second sync');
b.openAssistantImport();await until(()=>b.document.querySelector('#assistant-list button'),'second list');
b.document.querySelector('#assistant-list button').click();b.document.getElementById('assistant-confirm').click();
await until(()=>b.document.getElementById('assistant-message').textContent.includes('уже добавлялась'),'duplicate stopped');
assert.equal((await report()).rows[0].payload.ev.length,2);b.document.getElementById('assistant-close').click();
// Read id from server fixture, then locate the app's rendered edit control.
a.document.querySelector('[onclick="goScreen(\'s-cal\')"]')?.click();
const edit=[...a.document.querySelectorAll('[onclick]')].find(el=>el.getAttribute('onclick')==="editEv('"+event.id+"')");
assert.ok(edit,'event edit control rendered');edit.click();
a.document.getElementById('f-time').value='18:00';a.document.getElementById('f-time').dispatchEvent(new a.Event('input',{bubbles:true}));
a.document.querySelector('[onclick="saveEvEdit()"]').click();
await until(async()=>(await report()).rows[0].payload.ev.find(x=>x.id===event.id)?.time==='18:00','edited persisted');
const reopened=await tab('fresh');assert.ok(reopened.document.body.textContent.includes('Пробная встреча помощника'));assert.ok(reopened.document.body.textContent.includes('18:00'));
data=await report();assert.equal(data.rows[0].payload.ev.length,2);assert.equal(data.rows[0].payload.ev.find(x=>x.id==='existing').title,'Пробная исходная встреча');
assert.equal(errors.length,0,errors.join('\n'));
console.log(JSON.stringify({result:'PASS',database:'isolated PGlite',transport:'HTTP + actual Supabase browser SDK',requests:data.requests.length,records:data.rows[0].payload.ev.length,checks:['no write before confirmation','new event cloud round-trip','second device duplicate protection','edit persistence','fresh device reload','existing event preserved'],limitations:['jsdom, not visual browser acceptance','synthetic Auth/session and API server, not Supabase deployment']}));
}finally{for(const d of tabs)d.window.close();await close();}
