import {parseScheduleSource} from './schedule-import.mjs';
import {previewSchedule,applySchedule} from './schedule-preview.mjs';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createScheduleUI(env){
 const doc=env.document;let token=0,current=null;
 const label=t=>t==='study'?'Учебный':'Личный';
 const box=()=>doc.getElementById('sheet-in');
 const live=()=>current&&current.owner===env.owner();
 function show(html){if(!live())return;box().innerHTML=html;}
 function on(id,fn,event='click'){box().querySelector('#'+id)?.addEventListener(event,fn);}
 function remember(){if(!live())return;for(const [id,key] of [['schedule-text','text'],['schedule-name','namespace'],['schedule-target','target'],['schedule-zone','timeZone']]){const e=box().querySelector('#'+id);if(e)current[key]=e.value;}}
 function source(){
  show('<h3>Загрузить расписание</h3><p>Выберите календарь назначения. Личные записи сохранятся. До подтверждения ничего не добавляется.</p>'+
   '<div class="fld"><label for="schedule-target">Календарь назначения</label><select id="schedule-target"><option value="personal"'+(current.target==='personal'?' selected':'')+'>Личный</option><option value="study"'+(current.target==='study'?' selected':'')+'>Учебный</option><option value=""'+(!current.target?' selected':'')+'>Выберите календарь</option></select></div>'+
   '<div class="fld"><label for="schedule-name">Название расписания</label><input id="schedule-name" maxlength="160" value="'+escape(current.namespace)+'"><small>При повторной загрузке используйте то же название.</small></div>'+
   '<div class="fld"><label for="schedule-file">Excel .xlsx, CSV или ICS</label><input type="file" id="schedule-file" accept=".xlsx,.csv,.ics"><small>'+escape(current.file?.name||'Файл не выбран')+' · до 5 МБ</small></div>'+
   '<div class="fld"><label for="schedule-text">Или вставьте текст расписания</label><textarea id="schedule-text" rows="5">'+escape(current.text)+'</textarea></div>'+
   '<div class="fld"><label for="schedule-zone">Часовой пояс для ICS</label><input id="schedule-zone" value="'+escape(current.timeZone)+'" placeholder="Например: Europe/Moscow"><small>Для ICS подтвердите пояс. Время без года и неясные даты не угадываются.</small></div>'+
   '<p class="mut">PDF, фотографии и скриншоты будут доступны после подключения распознавания.</p>'+
   (current.error?'<p role="alert">'+escape(current.error)+'</p>':'')+
   '<button class="btn" id="schedule-check">Проверить</button><button class="btn ghost" id="schedule-cancel">Отмена</button>');
  on('schedule-file',()=>{remember();current.file=doc.getElementById('schedule-file').files[0]||null;if(current.file&&!current.namespace){current.namespace=current.file.name;doc.getElementById('schedule-name').value=current.namespace;}},'change');
  on('schedule-check',check);on('schedule-cancel',()=>env.close());
 }
 async function check(){
  remember();if(!live()||current.busy)return;
  if(!current.target||!current.namespace.trim()){current.error='Выберите календарь назначения и укажите название расписания.';source();return;}
  if(current.file&&current.text.trim()){current.error='Выберите один источник: файл или текст.';source();return;}
  if(!current.file&&!current.text.trim()){current.error='Выберите файл или вставьте текст.';source();return;}
  const run=++token;current.busy=true;show('<h3>Проверяем расписание…</h3><p role="status">Данные не сохраняются.</p><button class="btn ghost" id="schedule-cancel">Отмена</button>');on('schedule-cancel',()=>env.close());
  try{
   const args={format:'text',text:current.text};
   if(current.file){
    if(current.file.size>5*1024*1024)throw new Error('Файл превышает 5 МБ.');
    args.format=current.file.name.split('.').pop().toLowerCase();
    if(args.format==='xlsx')args.bytes=new Uint8Array(await current.file.arrayBuffer());else args.text=await current.file.text();
   }
   if(!live()||run!==token)return;
   args.timeZone=current.timeZone.trim();current.parsed=await (env.parse||parseScheduleSource)(args);
   if(!live()||run!==token)return;
   current.preview=await (env.preview||previewSchedule)(env.state(),current.parsed,{target:current.target,namespace:current.namespace,digest:env.digest});
   if(!live()||run!==token)return;
   current.busy=false;review();
  }catch(e){if(live()&&run===token){current.busy=false;current.error=e.message||'Не удалось прочитать источник.';source();}}
 }
 function review(){
  const p=current.preview,counts=kind=>p.items.filter(i=>i.kind===kind).length;
  const describe=e=>escape(e.date)+' · '+escape(e.time||'без времени')+(e.endTime?'–'+escape(e.endTime):'')+' · '+escape(e.title)+(e.note?'<small style="display:block;margin-top:4px">'+escape(e.note)+'</small>':'');
  show('<h3>Проверьте перед сохранением</h3><p>Назначение: <b>'+label(p.target)+'</b></p><p>Новых: '+counts('new')+' · Уже есть: '+counts('same')+' · Изменений: '+counts('change')+' · Требуют выбора: '+(counts('restore')+counts('possible'))+'</p>'+
   (p.session?'<p>Сессия: '+escape(p.session.from)+' — '+escape(p.session.to)+'. Конкретные экзамены без источника не добавляются.</p>':'')+
   (p.issues.length?'<div role="alert"><b>Не распознано: '+p.issues.length+'</b>'+p.issues.map(i=>'<p>'+escape(i.message)+(i.row?' · строка '+i.row:'')+(i.text?'<pre style="white-space:pre-wrap">'+escape(i.text)+'</pre>':'')+'</p>').join('')+'<label><input type="checkbox" id="schedule-exclude"> Исключить эти строки из текущей загрузки. Они не будут сохранены.</label></div>':'')+
   (p.warnings.length?'<details><summary>Предупреждения: '+p.warnings.length+'</summary>'+p.warnings.map(i=>'<p>'+escape(i.message)+(i.date?' · '+escape(i.date):'')+'</p>').join('')+'</details>':'')+
   '<div>'+p.items.map((item,i)=>'<div class="card" style="margin:8px 0"><label>'+(item.kind==='same'?'': '<input type="checkbox" data-schedule-row="'+i+'"'+(item.kind==='new'?' checked':'')+'> ')+describe(item.record)+'</label><small style="display:block;margin-top:4px">'+escape(item.message)+'</small>'+(item.old?'<p>Сейчас: '+describe(item.old)+'</p>':'')+'</div>').join('')+'</div>'+
   (!p.items.length?'<p>Записей для сохранения нет.</p>':'')+
   '<button class="btn" id="schedule-save">Сохранить выбранное</button><button class="btn ghost" id="schedule-back">Назад</button><button class="btn ghost" id="schedule-cancel">Отмена</button>');
  on('schedule-back',()=>{current.error='';source();});on('schedule-cancel',()=>env.close());on('schedule-save',save);
 }
 function save(){
  if(!live()||current.busy)return;
  const selected=Array.from(box().querySelectorAll('[data-schedule-row]:checked'),e=>Number(e.dataset.scheduleRow));
  if(!selected.length){env.toast('Выберите записи. Календарь не изменён.');return;}
  try{
   const result=applySchedule(env.state(),current.preview,selected,{excludeIssues:!!doc.getElementById('schedule-exclude')?.checked});
   if(!live())throw new Error('Аккаунт изменился. Откройте загрузку заново.');
   env.commit(result.state);current.busy=true;
   show('<h3>Добавлено на устройстве</h3><p>Добавлено: '+result.added+' · Изменено: '+result.updated+' · Пропущено: '+result.skipped+' · Восстановлено вашим выбором: '+result.restored+'</p><p>Подтверждение облачного сохранения смотрите в обычном статусе приложения. Доставка уведомления проверяется отдельно.</p><button class="btn" id="schedule-finish">Открыть календарь</button>');
   on('schedule-finish',()=>{const target=current.target;env.close();env.calendar(target);});
  }catch(e){env.toast(e.message||'Не удалось сохранить. Календарь не изменён.');}
 }
 return {open(target){token++;current={owner:env.owner(),target:target==='all'?'':target,namespace:'',text:'',timeZone:'',file:null,busy:false,error:''};env.begin();source();},cancel(){token++;current=null;},active(){return !!current;}};
}
