const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const file=n=>fs.readFileSync(__dirname+'/'+n,'utf8'),copy=x=>JSON.parse(JSON.stringify(x));
let remote=null,stamp=0,failWrite=false;
function client(){return {from(table){assert.equal(table,'user_app_data');let mode='read',body=null,filters={};const q={select(){return q},eq(k,v){filters[k]=v;return q},maybeSingle(){return q},update(b){mode='update';body=b;return q},insert(b){mode='insert';body=b;return q},then(resolve){let answer;if(mode==='read')answer={data:copy(remote),error:null};else if(failWrite)answer={data:null,error:{message:'network test'}};else if(mode==='update'&&filters.updated_at!==remote?.updated_at)answer={data:[],error:null};else if(mode==='insert'&&remote)answer={data:null,error:{code:'23505'}};else{remote={payload:copy(body.payload),updated_at:body.updated_at};stamp++;answer={data:[{updated_at:remote.updated_at}],error:null};}return Promise.resolve(answer).then(resolve);}};return q;}};}
let source={source_version:'2026-09-12T18:00:00Z',calendar_revision:2,calendar_event:{title:'Марина',date:'2026-09-13',time:'17:00',address:'Кафе'}};
function tab(){
const dom=new JSDOM(file('index.html'),{url:'https://test.invalid/index.html',runScripts:'dangerously',beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};w.TextEncoder=TextEncoder;Object.defineProperty(w,'crypto',{value:webcrypto});}});
const w=dom.window;w.eval(file('assistant-import.js'));w.testClient=client();
w.eval("S=blank();S.settings.cloudOwner='owner';S.settings.onboarded=1;cloudUser={id:'owner'};cloudEpoch=1;cloudReady=true;cloudClient=testClient;cloudBase=blank();cloudBase.settings.cloudOwner='owner';cloudState='synced';");
const ctx=()=>w.eval("({user:cloudUser?.id,epoch:cloudEpoch,ready:cloudReady,blocked:loadBlocked||!!cloudConflict,synced:cloudState==='synced'})");
const app={context:ctx,state:()=>w.eval('S'),list:async()=>[copy(source)],flush:()=>w.pushCloud(),commit(next){w.next=next;w.eval("S=next;save();clearTimeout(cloudTimer);");},confirmed:id=>w.eval('cloudState')==='synced'&&w.eval('cloudBase').ev.some(x=>x.id===id)};
return {w,app,importer:w.TochkaAssistantImport.createImporter(app),close:()=>dom.window.close()};}
(async()=>{
const ui=tab();await ui.w.pushCloud();
ui.w.TextEncoder=TextEncoder;ui.w.AbortSignal=AbortSignal;ui.w.structuredClone=structuredClone;
ui.w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
ui.w.eval("cloudClient.auth={getSession:async()=>({data:{session:{access_token:'fake'}}})}");
ui.w.fetch=async(url,opt)=>{assert.ok(url.endsWith('/tochka-assistant-calendar'));assert.deepEqual(JSON.parse(opt.body),{action:'list'});return Response.json({records:[copy(source)]});};
ui.w.eval(file('assistant-panel.js'));ui.w.openAssistantImport();
const settle=async()=>{for(let i=0;i<40;i++)await new Promise(r=>setImmediate(r));};await settle();
assert.equal(remote.payload.ev.length,0);ui.w.document.querySelector('#assistant-list button').click();assert.equal(remote.payload.ev.length,0);
ui.w.document.getElementById('assistant-confirm').click();await settle();assert.equal(remote.payload.ev.length,1);assert.match(ui.w.document.getElementById('assistant-message').textContent,/сохранена в облаке/);ui.close();
remote=null;
const a=tab();await a.w.pushCloud();const b=tab();await b.w.pushCloud();
let result=await a.importer.confirm(copy(source));assert.equal(result.status,'saved');assert.equal(remote.payload.ev.length,1);assert.equal(remote.payload.ev[0].time,'17:00');const id=result.id;
result=await b.importer.confirm(copy(source));assert.equal(result.status,'duplicate');assert.equal(remote.payload.ev.length,1);
a.w.eval("S.ev[0].time='18:00';save();clearTimeout(cloudTimer);");await a.w.pushCloud();
await b.w.pushCloud();assert.equal(b.app.state().ev[0].time,'18:00');assert.equal((await b.importer.confirm(copy(source))).status,'duplicate');assert.equal(remote.payload.ev[0].time,'18:00');
a.w.eval("killed(S.ev[0].id);S.ev=[];save();clearTimeout(cloudTimer);");await a.w.pushCloud();await b.w.pushCloud();assert.equal(remote.payload.ev.length,0);assert.equal((await b.importer.confirm(copy(source))).status,'duplicate');
// Ledger survives deletion-mark expiry and legacy same-browser merging.
const left=copy(b.app.state()),right=copy(left);left.del=[];right.del=[];right.assistantImports={};right.savedAt=new Date(Date.now()+5000).toISOString();b.w.left=left;b.w.right=right;assert.equal(b.w.eval('mergeStates(left,right)').assistantImports[id],true);
const old=copy(source);source.calendar_revision++;await assert.rejects(a.importer.confirm(old),/изменилась/);
source={...source,source_version:'2026-09-12T18:10:00Z'};
const c=tab();await c.w.pushCloud();const oldList=c.app.list;c.app.list=async()=>{c.w.eval('cloudEpoch++');return oldList();};await assert.rejects(c.importer.confirm(copy(source)),/Сеанс/);assert.equal(remote.payload.ev.length,0);c.close();
const d=tab();await d.w.pushCloud();const commit=d.app.commit;d.app.commit=(...args)=>{commit(...args);failWrite=true;};const pending=await d.importer.confirm(copy(source));assert.equal(pending.status,'pending');assert.equal(d.app.state().ev.length,1);assert.equal(remote.payload.ev.length,0);failWrite=false;await d.w.pushCloud();assert.equal(remote.payload.ev.length,1);assert.equal((await d.importer.confirm(copy(source))).status,'duplicate');
a.close();b.close();d.close();console.log('PASS real save/pushCloud path with fake server: import, second tab, edit sync, delete, ledger, stale preview, account change, failed write/retry.');
})().catch(e=>{console.error(e);process.exit(1)});
