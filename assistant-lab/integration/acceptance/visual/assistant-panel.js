(function(){
'use strict';
let dialog=null,selected=null,locked=false,rows=[],owner=null;
const note=t=>{const e=document.getElementById('assistant-message');if(e)e.textContent=t;};
const ctx=()=>({user:cloudUser?.id,epoch:cloudEpoch,ready:cloudReady,blocked:loadBlocked||!!cloudConflict,synced:cloudState==='synced'});
async function list(){
 const captured=ctx();if(!captured.user||!captured.ready)throw Error('Сначала подключите облачное сохранение в разделе «Мои данные».');
 const session=await cloudClient.auth.getSession();
 if(ctx().user!==captured.user||ctx().epoch!==captured.epoch)throw Error('Сеанс изменился. Откройте помощника заново.');
 const token=session.data?.session?.access_token;if(!token)throw Error('Войдите в аккаунт заново.');
 const r=await fetch(SUPABASE_URL+'/functions/v1/tochka-assistant-calendar',{method:'POST',headers:{apikey:SUPABASE_KEY,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({action:'list'}),signal:AbortSignal.timeout(20000),redirect:'error'});
 const d=await r.json();
 if(ctx().user!==captured.user||ctx().epoch!==captured.epoch)throw Error('Сеанс изменился. Откройте помощника заново.');
 if(!r.ok)throw Error(r.status===403?'Помощник пока доступен только владельцу.':'Не удалось загрузить встречи помощника.');
 return d.records.filter(x=>x.calendar_event);
}
async function flush(){
 const until=Date.now()+15000;
 while(cloudBusy&&Date.now()<until)await new Promise(r=>setTimeout(r,100));
 if(cloudBusy)throw Error('Синхронизация ещё выполняется. Повторите позже.');
 clearTimeout(cloudTimer);await pushCloud();
}
const importer=TochkaAssistantImport.createImporter({
 context:ctx,state:()=>S,list,flush,
 commit(next,c){
 if(ctx().user!==c.user||ctx().epoch!==c.epoch||S.settings.cloudOwner!==c.user)throw Error('Сменился аккаунт. Добавление остановлено.');
 validateData(next);
 // One recoverable local snapshot before each explicit addition.
 localStorage.setItem(KEY+':assistant-before:'+c.user,JSON.stringify(S));
 localStorage.setItem(KEY,JSON.stringify(next));
 S=next;save();
 },
 confirmed:id=>cloudState==='synced'&&!!cloudBase?.ev?.some(x=>x.id===id)
});
function lock(value){locked=value;dialog?.querySelectorAll('button').forEach(b=>b.disabled=value);}
async function run(fn){if(locked)return;lock(true);note('Подождите…');try{await fn();}catch(e){note(e.message||'Не удалось выполнить действие.');}finally{lock(false);}}
function clear(){selected=null;rows=[];owner=null;dialog?.remove();dialog=null;}
window.openAssistantImport=function(){
 if(!cloudUser||!cloudReady){toast('Сначала подключите облачное сохранение.');return;}
 if(dialog){dialog.showModal();return;}
 owner=ctx();dialog=document.createElement('dialog');dialog.id='assistant-dialog';
 dialog.style.cssText='max-width:650px;width:calc(100% - 32px);max-height:85dvh;overflow:auto;border:1px solid var(--line);border-radius:20px;padding:24px;background:var(--card,#fff);color:var(--text,#302a3d)';
 dialog.innerHTML='<h2>Встречи помощника</h2><p>Проверьте встречу перед добавлением в план «Точки дня». После добавления она сохраняется и синхронизируется как обычная встреча.</p><p id="assistant-message" role="status" aria-live="polite"></p><div id="assistant-list"></div><section id="assistant-preview" hidden><h3>Проверьте перед добавлением</h3><p id="assistant-details" style="white-space:pre-wrap"></p><button class="btn" id="assistant-confirm">Добавить в мой план</button></section><button class="btn ghost" id="assistant-refresh">Обновить список</button><button class="btn ghost" id="assistant-close">Закрыть</button>';
 document.body.append(dialog);dialog.addEventListener('cancel',e=>{if(locked)e.preventDefault();else clear();});
 document.getElementById('assistant-close').onclick=()=>clear();
 document.getElementById('assistant-refresh').onclick=()=>run(refresh);
 document.getElementById('assistant-confirm').onclick=()=>run(async()=>{
 if(!selected)return;
 const result=await importer.confirm(selected);
 if(!dialog)return;
 document.getElementById('assistant-preview').hidden=true;selected=null;
 note(result.status==='saved'?'Встреча добавлена в план и сохранена в облаке.':result.status==='duplicate'?'Эта встреча уже добавлялась. Повторного добавления не будет.':'Встреча добавлена на устройстве. Облачное сохранение пока не подтверждено — проверьте статус в «Моих данных».');
 });
 dialog.showModal();run(refresh);
};
async function refresh(){
 const data=await list();
 if(!dialog||owner.user!==ctx().user||owner.epoch!==ctx().epoch){clear();return;}
 rows=data;selected=null;document.getElementById('assistant-preview').hidden=true;
 const target=document.getElementById('assistant-list');target.replaceChildren();
 for(const row of rows){
 let p;try{p=TochkaAssistantImport.proposal(row);}catch{continue;}
 const b=document.createElement('button');b.className='btn ghost';b.style.cssText='display:block;margin:10px 0;width:100%;text-align:left';
 b.textContent=p.date.split('-').reverse().join('.')+' · '+p.time+' · '+p.title;
 b.onclick=()=>{selected=structuredClone(row);document.getElementById('assistant-details').textContent=[p.title,p.date.split('-').reverse().join('.'),p.time,p.address].filter(Boolean).join('\n');document.getElementById('assistant-preview').hidden=false;note('Добавление произойдёт только после нажатия «Добавить в мой план».');};
 target.append(b);
 }
 note(target.children.length?'Выберите встречу. Показаны последние доступные записи.':'Подготовленных встреч нет. Сначала сохраните встречу в тестовом календаре помощника.');
}
window.addEventListener('pagehide',clear);
setInterval(()=>{if(dialog&&(ctx().user!==owner?.user||ctx().epoch!==owner?.epoch))clear();},500);
})();
