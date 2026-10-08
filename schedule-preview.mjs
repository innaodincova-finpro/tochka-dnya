// PLAN-IMPORT-01. Pure preview/application; caller owns atomic local storage and account guards.
const text=s=>String(s??'').trim();
export const calendarType=e=>e.calendarType==='study'?'study':'personal';
const sig=e=>JSON.stringify([e.date,e.time||'',text(e.title).toLowerCase().replace(/лекция\s*\(вебинар\)$/,'лекция')]);
const fields=e=>({title:e.title,date:e.date,time:e.time||null,endTime:e.endTime||'',endDate:e.endDate||'',allDay:!!e.allDay,kind:['cls','other'].includes(e.kind)?'plain':e.kind||'plain',repeat:e.repeat||'none',address:e.address||null,note:e.note||'',recordType:e.recordType||'',discipline:e.discipline||'',planOnly:!!e.planOnly,...(e.workMetadata?{workMetadata:JSON.parse(JSON.stringify(e.workMetadata))}:{})});
const equalFields=(a,b)=>JSON.stringify(fields(a))===JSON.stringify(fields(b));
export async function previewSchedule(state,parsed,{target,namespace,digest}={}){
 if(!['personal','study'].includes(target)||!text(namespace)||!Array.isArray(parsed?.events))throw new Error('Выберите календарь и название расписания.');
 const hash=digest||(async value=>{const result=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,'0')).join('');});
 const result={target,namespace:text(namespace),base:JSON.stringify(state),items:[],issues:structuredClone(parsed.issues||[]),warnings:structuredClone(parsed.warnings||[]),session:parsed.session||null,summary:parsed.summary,duplicates:parsed.duplicates||0};
 const existing=(state.ev||[]).filter(e=>calendarType(e)===target),dead=new Set([...(state.del||[]).map(e=>e.id),...Object.keys(state.settings?.scheduleDeleted||{})]);
 for(const source of parsed.events){
  // A work can have several preparation stages: its code/type is not a unique event key.
  const sourceKey=source.sourceKey?.startsWith('work:')?source.sourceKey+'|'+text(source.title).toLowerCase():source.sourceKey;
  const key=sourceKey?.startsWith('ics:')?sourceKey:[result.namespace,sourceKey||sig(source)].join('|');
  const id='sched_'+await hash(JSON.stringify([target,key]));const record={...fields(source),id,calendarType:target};
  record.scheduleImport={namespace:result.namespace,key,baseline:JSON.stringify(fields(record)),sequence:source.sequence??null};
  const old=existing.find(e=>e.id===id),same=(state.ev||[]).find(e=>sig(e)===sig(record));let kind='new',message='Новая запись';
  if(old){
   if(equalFields(old,record)){kind='same';message='Уже есть';}
   else if(source.sequence!==undefined&&Number.isInteger(old.scheduleImport?.sequence)&&source.sequence<old.scheduleImport.sequence){kind='same';message='В календаре более новая версия ICS; прежняя сохранена';}
   else{kind='change';message=old.scheduleImport?.baseline!==JSON.stringify(fields(old))?'Запись изменена вручную. Замена требует вашего выбора.':'Источник предлагает изменение. Проверьте прежнюю и новую запись.';}
  }else if(dead.has(id)){kind='restore';message='Вы удаляли эту запись. Восстановить можно только вашим выбором.';}
  else if(same){kind='same';message='Такая запись уже есть'+(calendarType(same)!==target?' в другом календаре':'')+'; её данные сохраняются';}
  else if(existing.some(e=>e.scheduleImport?.namespace===result.namespace&&text(e.title)===record.title)){kind='possible';message='Есть записи с таким названием. Проверьте, не переносится ли прежняя запись; автоматической замены нет.';}
  result.items.push({kind,message,record,old:old||null,source});
 }
 const origins=new Map();
 for(const item of result.items){
  const prior=origins.get(item.record.id);
  if(prior&&!equalFields(prior.record,item.record)){
   prior.kind=item.kind='possible';prior.message=item.message='В источнике один идентификатор описывает разные записи. Выберите только одну версию.';
   result.issues.push({message:item.message,title:item.record.title});
  }else origins.set(item.record.id,item);
 }
 for(let i=0;i<result.items.length;i++)for(let j=i+1;j<result.items.length;j++){
  const a=result.items[i].record,b=result.items[j].record;
  if(a.date===b.date&&a.time&&b.time&&a.endTime&&b.endTime&&a.time<b.endTime&&b.time<a.endTime)result.warnings.push({message:'Пересечение времени: '+a.title+' / '+b.title,date:a.date});
 }
 return result;
}
export function applySchedule(state,preview,selected,{excludeIssues=false}={}){
 if(JSON.stringify(state)!==preview.base)throw new Error('Календарь изменился после проверки. Проверьте источник заново.');
 if(preview.issues.length&&!excludeIssues)throw new Error('Уточните нераспознанные строки или явно исключите их.');
 const next=JSON.parse(JSON.stringify(state));const chosen=new Set(selected);let added=0,updated=0,restored=0,skipped=0;
 const ids=new Set();for(const i of chosen){const id=preview.items[i]?.record.id;if(!id)throw new Error('Выбрана неизвестная запись.');if(ids.has(id))throw new Error('Выберите только одну версию записи с общим идентификатором.');ids.add(id);}
 for(let i=0;i<preview.items.length;i++){
  const item=preview.items[i];if(item.kind==='same'||!chosen.has(i)){skipped++;continue;}
  const e=JSON.parse(JSON.stringify(item.record));
  if(item.kind==='change'){
   const at=next.ev.findIndex(r=>r.id===e.id);if(at<0)throw new Error('Изменяемая запись исчезла. Повторите проверку.');
   // Preserve unrelated fields and completed-day marks. No implied submission/completion.
   next.ev[at]={...next.ev[at],...e};updated++;
  }else{
   if(next.ev.some(r=>r.id===e.id||sig(r)===sig(e))){skipped++;continue;}
   next.ev.push(e);added++;
   if(item.kind==='restore'){next.del=(next.del||[]).filter(r=>r.id!==e.id);if(next.settings.scheduleDeleted)delete next.settings.scheduleDeleted[e.id];restored++;}
  }
 }
 if(preview.session){next.settings.scheduleSessions={...(next.settings.scheduleSessions||{}),[preview.target]:{namespace:preview.namespace,...preview.session}};}
 return {state:next,added,updated,restored,skipped,excludedIssues:excludeIssues?preview.issues.length:0};
}
