/* Test-branch integration. Does not run imports automatically. */
(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function proposal(row){
 const e=row?.calendar_event;
 if(!e||typeof row.source_version!=='string'||!Number.isFinite(Date.parse(row.source_version))||!Number.isSafeInteger(row.calendar_revision)||row.calendar_revision<1)throw Error('Выберите встречу из тестового календаря.');
 if(typeof e.title!=='string'||!e.title.trim()||e.title.length>1500||typeof e.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date+'T12:00:00Z'))||new Date(e.date+'T12:00:00Z').toISOString().slice(0,10)!==e.date||typeof e.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)||!(e.address==null||typeof e.address==='string'&&e.address.length<=300))throw Error('Проверьте дату, время и название встречи в тестовом календаре.');
 return {title:e.title.trim(),date:e.date,time:e.time,address:e.address||null,plan:null,kind:'plain',repeat:'none'};
}
async function identifier(user,version){const data=new TextEncoder().encode(user+':'+new Date(version).toISOString());const digest=await crypto.subtle.digest('SHA-256',data);return 'ai_'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}
function createImporter(app){
 let busy=false;
 function check(c){const now=app.context();if(!c.user||c.user!==now.user||c.epoch!==now.epoch||!now.ready||now.blocked)throw Error('Сеанс изменился или облако не готово. Войдите и обновите список.');}
 async function confirm(selected){
 if(busy)throw Error('Сохранение уже выполняется.');busy=true;
 const c=app.context();
 try{
 check(c);const p=proposal(selected),latest=(await app.list()).find(r=>r.source_version===selected.source_version);check(c);
 if(!latest||latest.calendar_revision!==selected.calendar_revision||JSON.stringify(proposal(latest))!==JSON.stringify(p))throw Error('Встреча изменилась. Обновите список и подтвердите новый вариант.');
 await app.flush();check(c);
 if(!app.context().synced)throw Error('Сначала дождитесь сохранения текущих записей в облаке.');
 const id=await identifier(c.user,selected.source_version);check(c);
 const state=app.state(),ledger=state.assistantImports||{};
 if(typeof ledger!=='object'||Array.isArray(ledger)||Object.entries(ledger).some(([k,v])=>!/^ai_[a-f0-9]{64}$/.test(k)||v!==true))throw Error('Некорректная история добавлений. Импорт остановлен.');
 if(ledger[id]||state.del?.some(x=>x.id===id)||['ev','notes','exp','inc'].some(k=>(state[k]||[]).some(x=>x.id===id)))return {status:'duplicate',id};
 const next=clone(state);next.ev.push({id,...p});next.assistantImports={...ledger,[id]:true};
 app.commit(next,c);check(c);
 try{await app.flush();check(c);}catch{return {status:'pending',id};}
 return {status:app.confirmed(id)?'saved':'pending',id};
 }finally{busy=false;}
 }
 return {confirm};
}
root.TochkaAssistantImport={createImporter,proposal,identifier};
if(typeof module==='object')module.exports=root.TochkaAssistantImport;
})(typeof window==='object'?window:globalThis);
