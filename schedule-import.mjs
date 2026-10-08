// PLAN-IMPORT-01: local read-only source parsing. Never reads/writes user storage or calls a network.
import {calendarDate,calendarTime,parseCalendarText,parseCalendarSheets,readCalendarXlsx,MAX_CALENDAR_FILE} from './schedule-source-base.mjs';
export {calendarDate,calendarTime,parseCalendarText,parseCalendarSheets,readCalendarXlsx};
const MAX_TEXT=2*1024*1024,MAX_ROWS=5000;
const empty=()=>({events:[],issues:[],warnings:[],duplicates:0,session:null,summary:{classes:0,actions:0,tests:0}});
const clean=s=>String(s??'').trim();
function input(text){if(typeof text!=='string'||text.length>MAX_TEXT)throw new Error('Источник слишком большой. Разделите расписание.');return text.replace(/^\uFEFF/,'');}
function finish(out){
 const seen=new Map(),events=[];
 for(const e of out.events){
  const key=[e.date,e.time,e.title].join('|');const old=seen.get(key);
  if(old){out.duplicates++;if(old.endTime!==e.endTime||old.note!==e.note)out.issues.push({message:'Совпадающие записи содержат разные сведения.',event:e});}
  else{seen.set(key,e);events.push(e);}
 }
 out.events=events;out.summary={classes:events.filter(e=>e.kind==='cls').length,actions:events.filter(e=>e.kind!=='cls').length,tests:events.filter(e=>e.recordType==='Тест').length};return out;
}
// RFC-style quoted fields, including embedded line breaks; formula strings are not executed.
export function csvRows(text,separator){
 text=input(text);if(!separator){
  const head=text.split(/\r?\n/)[0];let quoted=false,counts={',':0,';':0,'\t':0};
  for(let i=0;i<head.length;i++){if(head[i]==='"'){if(quoted&&head[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted&&head[i] in counts)counts[head[i]]++;}
  separator=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
 }
 if(![',',';','\t'].includes(separator))throw new Error('Неизвестный разделитель CSV.');
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 const field=()=>{row.push(cell);cell='';closed=false;};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)throw new Error('Повреждены кавычки CSV.');quoted=true;}
  else if(c===separator)field();
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;field();rows.push(row);row=[];if(rows.length>MAX_ROWS+40)throw new Error('В CSV слишком много строк.');}
  else{if(closed)throw new Error('После закрывающей кавычки CSV найден текст.');cell+=c;}
 }
 if(quoted)throw new Error('В CSV не закрыты кавычки.');
 if(cell||row.length||closed){field();rows.push(row);}return rows;
}
export function parseScheduleCSV(text){
 const rows=csvRows(text),first=rows.findIndex(r=>r.some(clean));
 if(first<0){const out=empty();out.issues.push({message:'Файл пуст.'});return out;}
 const header=rows[first].map(s=>clean(s).toLowerCase());
 // Structured teaching tables share the verified workbook schema.
 if(header.includes('дисциплина')||header.includes('предмет'))return parseCalendarSheets([{name:'CSV',rows}]);
 const out=empty(),col=(...names)=>names.map(n=>header.indexOf(n)).find(i=>i>=0);
 const title=col('название','событие','title','summary'),date=col('дата','date'),start=col('начало','время','time','start'),end=col('окончание','конец','end'),note=col('примечание','note','description');
 if(title===undefined||date===undefined){out.issues.push({row:first+1,message:'Нужны столбцы «Название» и «Дата».',text:rows[first].join(';')});return out;}
 for(let i=first+1;i<rows.length;i++){
  const r=rows[i];if(!r.some(clean))continue;
  const name=clean(r[title]),d=calendarDate(r[date]),t=start===undefined?'':calendarTime(r[start]),until=end===undefined?'':calendarTime(r[end]);
  if(r.length!==header.length||!name||!d||(start!==undefined&&clean(r[start])&&!t)||(end!==undefined&&clean(r[end])&&(!until||!t||until<=t))||r.some(v=>/^\s*[=+@]/.test(v))){out.issues.push({row:i+1,message:'Проверьте структуру строки, дату, время или формулу.',text:r.join(';')});continue;}
  out.events.push({kind:'other',title:name,date:d,time:t,endTime:until,note:note===undefined?'':clean(r[note]),planOnly:false,source:{sheet:'CSV',row:i+1},sourceKey:''});
 }
 return finish(out);
}
const unescapeICS=s=>s.replace(/\\n/gi,'\n').replace(/\\([,;\\])/g,'$1');
function icsDate(value,params,zone){
 if(params.VALUE==='DATE'||/^\d{8}$/.test(value)){const d=calendarDate(value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6,8));if(!/^\d{8}$/.test(value)||!d)throw new Error('Некорректная дата ICS.');return {date:d,time:'',allDay:true};}
 const m=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
 if(!m||!calendarDate(m[1]+'-'+m[2]+'-'+m[3])||!calendarTime(m[4]+':'+m[5])||m[6]!=='00')throw new Error('Дата и время ICS требуют уточнения.');
 if(m[7]){
  if(params.TZID||!zone)throw new Error('Выберите часовой пояс для времени UTC.');
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z`)).map(p=>[p.type,p.value]));
  return {date:parts.year+'-'+parts.month+'-'+parts.day,time:parts.hour+':'+parts.minute};
 }
 if(!zone||params.TZID&&params.TZID!==zone)throw new Error('Уточните часовой пояс ICS.');
 return {date:m[1]+'-'+m[2]+'-'+m[3],time:m[4]+':'+m[5]};
}
export function parseScheduleICS(text,{timeZone}={}){
 text=input(text);const out=empty();
 if(!/^BEGIN:VCALENDAR\s*$/m.test(text)||!/^END:VCALENDAR\s*$/m.test(text)){out.issues.push({message:'Файл не содержит полного календаря ICS.'});return out;}
 if(timeZone){try{new Intl.DateTimeFormat('en',{timeZone});}catch{out.issues.push({message:'Некорректный часовой пояс.'});return out;}}
 const lines=text.replace(/\r\n/g,'\n').replace(/\n[ \t]/g,'').split('\n');let fields=null,first=0;
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(line==='BEGIN:VEVENT'){if(fields)out.issues.push({row:i+1,message:'Вложенное событие ICS.'});fields=new Map();first=i+1;continue;}
  if(!fields)continue;
  if(line==='END:VEVENT'){
   try{
    for(const key of ['RRULE','RDATE','EXDATE','RECURRENCE-ID','DURATION'])if(fields.has(key))throw new Error('Повторы, исключения или длительность ICS требуют отдельного уточнения.');
    for(const key of ['UID','DTSTART','SUMMARY','DTEND','SEQUENCE','STATUS'])if((fields.get(key)||[]).length>1)throw new Error('В событии повторяется поле '+key+'.');
    const get=k=>fields.get(k)?.[0],dt=get('DTSTART'),uid=get('UID'),title=unescapeICS(get('SUMMARY')?.value||'');
    if(!dt||!uid?.value||!title.trim())throw new Error('У события ICS нет UID, названия или начала.');
    if(get('STATUS')?.value==='CANCELLED')throw new Error('Отмена события требует подтверждения; существующая запись не удаляется.');
    const start=icsDate(dt.value,dt.params,timeZone),end=get('DTEND')?icsDate(get('DTEND').value,get('DTEND').params,timeZone):null;
    if(end&&((end.allDay!==start.allDay)||(end.date+end.time<=start.date+start.time)))throw new Error('Окончание ICS не соответствует началу.');
    if(end&&!start.allDay&&end.date!==start.date)throw new Error('Событие на несколько дней требует уточнения.');
    const seq=get('SEQUENCE')?.value||'0';if(!/^\d+$/.test(seq)||!Number.isSafeInteger(Number(seq)))throw new Error('Некорректный SEQUENCE.');
    out.events.push({kind:'other',title:title.trim(),date:start.date,time:start.time,endTime:!start.allDay&&end?end.time:'',endDate:end?.date||'',allDay:!!start.allDay,note:unescapeICS(get('DESCRIPTION')?.value||''),address:unescapeICS(get('LOCATION')?.value||''),planOnly:false,source:{sheet:'ICS',row:first},sourceKey:'ics:'+uid.value,sequence:Number(seq),timeZone:timeZone||''});
   }catch(e){out.issues.push({row:first,message:e.message,text:[...fields.entries()].map(([k,v])=>k+':'+v.map(p=>p.value).join(',')).join('\n')});}
   fields=null;if(out.events.length>MAX_ROWS)throw new Error('В ICS больше 5000 событий.');continue;
  }
  const colon=line.indexOf(':');if(colon<1){out.issues.push({row:i+1,message:'Повреждена строка ICS.',text:line});continue;}
  const [key,...extra]=line.slice(0,colon).split(';'),params={};for(const p of extra){const at=p.indexOf('=');if(at>0)params[p.slice(0,at).toUpperCase()]=p.slice(at+1).replace(/^"|"$/g,'');}
  const name=key.toUpperCase();fields.set(name,[...(fields.get(name)||[]),{value:line.slice(colon+1),params}]);
 }
 if(fields)out.issues.push({row:first,message:'Событие ICS не закрыто.'});
 if(!out.events.length&&!out.issues.length)out.issues.push({message:'В ICS нет событий.'});
 return finish(out);
}
export async function parseScheduleSource({format,text,bytes,...options}){
 if(format==='xlsx'){if(bytes?.length>MAX_CALENDAR_FILE)throw new Error('Excel превышает 5 МБ.');return parseCalendarSheets(await readCalendarXlsx(bytes,options));}
 if(format==='csv')return parseScheduleCSV(text);
 if(format==='ics')return parseScheduleICS(text,options);
 if(format==='text')return parseCalendarText(input(text));
 throw new Error('Этот формат пока требует отдельного способа распознавания.');
}
