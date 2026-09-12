import {blank,mergeThree} from './calendar-core.mjs';
const BASE='https://dcpthwmuiodrjepifzsd.supabase.co',KEY='sb_publishable_OL_S1GutrvcvpaRaLzKpsQ_ExxamvKt',$=id=>document.getElementById(id);
let token=null,records=[],editing=null,busy=false,day=new Date().toLocaleDateString('en-CA');
if(!/^\d{4}-\d{2}-\d{2}$/.test(day))day=new Date().toISOString().slice(0,10);
$('month').value=day.slice(0,7);
const say=t=>$('status').textContent=t;
function lock(){document.querySelectorAll('button').forEach(b=>b.disabled=busy);}
async function run(fn){if(busy)return;busy=true;lock();say('Подождите…');try{await fn();}catch(e){say(e.message||'Не удалось связаться с сервером. Повторите попытку.');}finally{busy=false;lock();}}
async function api(data){const r=await fetch(BASE+'/functions/v1/tochka-assistant-calendar',{method:'POST',headers:{apikey:KEY,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(20000),redirect:'error'});const d=await r.json();if(r.status===409)return d;if(!r.ok){if(r.status===401)logout();throw Error(r.status===401?'Войдите снова.':r.status===403?'Доступ открыт только владельцу.':'Не удалось выполнить действие. Повторите попытку.');}return d;}
function upsert(r){records=records.filter(x=>x.source_version!==r.source_version);records.push(r);}
async function reload(){records=(await api({action:'list'})).records;render();}
function button(text,fn){const b=document.createElement('button');b.textContent=text;b.onclick=fn;return b;}
function render(){
 $('sources').replaceChildren();for(const r of records.filter(x=>x.proposal.kind==='event'&&!x.calendar_event)){const a=document.createElement('article'),p=document.createElement('p');p.textContent=r.proposal.title+' · '+r.proposal.date+' '+r.proposal.time;a.append(p,button('Добавить в тестовый календарь',()=>run(async()=>{const d=await api({action:'import',version:r.source_version});if(d.error==='conflict'){await reload();say('Список изменился. Проверьте календарь.');return;}upsert(d.record);day=d.record.calendar_event.date;$('month').value=day.slice(0,7);render();say('Встреча добавлена в тестовый календарь.');})));$('sources').append(a);}
 if(!$('sources').children.length)$('sources').textContent='Все доступные встречи уже добавлены, либо новых сохранённых встреч нет.';
 const [y,m]=$('month').value.split('-').map(Number);if(!y||!m)return;
 $('grid').replaceChildren();for(const t of ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']){const el=document.createElement('small');el.textContent=t;$('grid').append(el);}
 const offset=(new Date(y,m-1,1).getDay()+6)%7;for(let i=0;i<offset;i++)$('grid').append(document.createElement('span'));
 for(let n=1;n<=new Date(y,m,0).getDate();n++){const d=$('month').value+'-'+String(n).padStart(2,'0'),count=records.filter(x=>x.calendar_event?.date===d).length;const b=button(n+(count?' •':''),()=>{day=d;render();});b.classList.toggle('selected',d===day);b.setAttribute('aria-label',d+(count?', встреч: '+count:''));$('grid').append(b);}
 $('daytitle').textContent='Встречи на '+day.split('-').reverse().join('.');$('events').replaceChildren();
 for(const r of records.filter(x=>x.calendar_event?.date===day).sort((a,b)=>a.calendar_event.time.localeCompare(b.calendar_event.time))){const a=document.createElement('article'),p=document.createElement('p');p.textContent=r.calendar_event.time+' · '+r.calendar_event.title+(r.calendar_event.address?' · '+r.calendar_event.address:'');a.append(p,button('Изменить',()=>{editing=structuredClone(r);for(const k of ['title','date','time','place'])$(k).value=r.calendar_event[k==='place'?'address':k]||'';$('editor').hidden=false;$('conflict').hidden=true;$('title').focus();}));$('events').append(a);}
 if(!$('events').children.length)$('events').textContent='На этот день встреч нет.';lock();
}
function logout(){token=null;records=[];editing=null;$('workspace').hidden=true;$('login').hidden=false;$('editor').hidden=true;$('password').value='';$('sources').replaceChildren();$('events').replaceChildren();}
$('loginform').onsubmit=e=>{e.preventDefault();run(async()=>{const password=$('password').value;$('password').value='';const r=await fetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:KEY,'content-type':'application/json'},body:JSON.stringify({email:$('email').value.trim(),password}),signal:AbortSignal.timeout(20000),redirect:'error'});const d=await r.json();if(!r.ok||!d.access_token)throw Error('Проверьте почту и пароль «Точки дня».');token=d.access_token;try{await reload();}catch(e){logout();throw e;}$('login').hidden=true;$('workspace').hidden=false;say('Тестовый календарь загружен.');});};
$('refresh').onclick=()=>run(async()=>{await reload();say('Данные обновлены с сервера.');});
$('logout').onclick=()=>{logout();say('Вы вышли.');};
$('month').onchange=()=>{day=$('month').value+'-01';render();};
$('cancel').onclick=()=>{editing=null;$('editor').hidden=true;};
$('editform').onsubmit=e=>{e.preventDefault();if(!editing)return;run(async()=>{
 const original=structuredClone(editing),local={...original.calendar_event};for(const k of ['title','date','time','place'])local[k==='place'?'address':k]=$(k).value.trim();
 let target=original,event=local;
 for(let attempt=0;attempt<3;attempt++){
 const proposal={kind:'event',title:event.title,date:event.date,time:event.time,place:event.address||''};
 const d=await api({action:'edit',version:target.source_version,revision:target.calendar_revision,proposal});
 if(!d.error){upsert(d.record);day=d.record.calendar_event.date;$('month').value=day.slice(0,7);editing=null;$('editor').hidden=true;render();say('Изменения сохранены на сервере тестовой версии.');return;}
 if(!d.record)throw Error('Встреча больше недоступна.');
 upsert(d.record);render();const state=ev=>({...blank(),ev:[ev]});
 try{event=mergeThree(state(original.calendar_event),state(local),state(d.record.calendar_event)).ev[0];}
 catch{$('conflict').hidden=false;throw Error('Есть разные изменения одного поля. Автоматическая перезапись остановлена.');}
 target=d.record;
 }
 throw Error('Запись сейчас изменяется в другом окне. Повторите сохранение.');
 });};
