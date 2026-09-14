import {hash} from './common.mjs';
const norm=t=>String(t||'').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/[«»"]/g,'').trim();
export function actionIntent(text,now=new Date()){
 if(typeof text!=='string')return null;
 const t=text.trim();let m=/^удали\s+(встречу|событие|заметку|задачу|расход)\s+(.+)$/iu.exec(t);
 const section=type=>['встречу','событие'].includes(norm(type))?'ev':norm(type)==='расход'?'exp':'notes';
 if(m)return {action:'delete',section:section(m[1]),query:norm(m[2])};
 m=/^заверши\s+(встречу|событие|заметку|задачу)\s+(.+)$/iu.exec(t);
 if(m)return {action:'complete',section:section(m[1]),query:norm(m[2])};
 m=/^перенеси\s+(?:встречу|событие)\s+(.+?)\s+на\s+(.+?)\s+в\s+(\d{1,2}:\d{2})[.!]?$/iu.exec(t);
 if(m){
  const today=new Date(+now+3*3600000).toISOString().slice(0,10);let d=new Date(today+'T12:00:00Z'),date;
  const word=norm(m[2]),relative={сегодня:0,завтра:1,послезавтра:2};
  if(word in relative){d.setUTCDate(d.getUTCDate()+relative[word]);date=d.toISOString().slice(0,10);}
  else {const weekdays={воскресенье:0,понедельник:1,вторник:2,среду:3,четверг:4,пятницу:5,субботу:6};
   if(word in weekdays){d.setUTCDate(d.getUTCDate()+(weekdays[word]-d.getUTCDay()+7)%7);date=d.toISOString().slice(0,10);}
   else if(/^\d{4}-\d{2}-\d{2}$/.test(word))date=word;
   else {const p=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(word);if(p)date=p[3]+'-'+p[2]+'-'+p[1];}
  }
  const time=m[3].padStart(5,'0');
  if(!date||!Number.isFinite(Date.parse(date+'T12:00Z'))||new Date(date+'T12:00Z').toISOString().slice(0,10)!==date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return {help:true};
  return {action:'move',section:'ev',query:norm(m[1]),target:{date,time}};
 }
 if(/^(?:удали|заверши)\s|^перенеси\s+(?:встречу|событие)(?:\s|$)/iu.test(t))return {help:true};
 return null;
}
export async function prepareAction(intent,s,uid,chat,linked){
 const say=text=>s.tg('sendMessage',{chat_id:chat,text});
 if(intent.help||!intent.query||intent.query.length>150)return say('Например: «Перенеси встречу Врач на завтра в 15:00», «Заверши задачу Документы», «Удали расход Кофе». Название можно указать частично. Перед изменением я покажу запись.');
 const member='tochka_members?user_id=eq.'+encodeURIComponent(uid)+'&revoked_at=is.null&select=user_id';
 if(!(await s.db(member)).length)return;
 const rows=await s.db('user_app_data?user_id=eq.'+encodeURIComponent(uid)+'&select=payload'),p=rows[0]?.payload;
 if(!Array.isArray(p?.[intent.section]))return say('Не удалось прочитать записи. Ничего не изменено.');
 const dead=new Set((p.del||[]).map(x=>x.id));
 const found=p[intent.section].filter(r=>r.id&&!dead.has(r.id)&&norm(r.title||r.text).includes(intent.query));
 if(!found.length)return say('Подходящих записей не найдено. Укажите часть названия из «Точки дня».');
 if(found.length>5)return say('Найдено записей: '+found.length+'. Уточните название, чтобы выбрать нужную. Ничего не изменено.');
 if(!await linked()||!(await s.db(member)).length)return;
 for(const rec of found){
  if(intent.action!=='delete'&&((intent.section==='ev'&&rec.repeat&&rec.repeat!=='none')||(intent.section==='notes'&&rec.items))){await say('«'+String(rec.title||rec.text).slice(0,150)+'»: для изменения повторяющейся встречи или списка откройте приложение. Ничего не изменено.');continue;}
  const id=crypto.randomUUID();
  await s.db('tochka_assistant_actions','POST',{id,user_id:uid,section:intent.section,action:intent.action,original:rec,target:intent.target||{}});
  const label=({move:'Перенести',complete:'Отметить выполненным',delete:rec.repeat&&rec.repeat!=='none'?'Удалить всю серию':'Удалить'})[intent.action];
  const text=[label+'?',String(rec.title||rec.text).slice(0,1000),...(rec.date?[rec.date+(rec.time?' '+rec.time:'')]:[]),...(intent.section==='exp'?[String(rec.sum)+' '+(rec.cur||p.settings?.cur||'')]:[]),...(intent.target?['Новое время: '+intent.target.date+' '+intent.target.time+' (Москва)']:[]),'Изменение произойдёт только после подтверждения.'].join('\n');
  await s.tg('sendMessage',{chat_id:chat,text,reply_markup:{inline_keyboard:[[{text:'Подтвердить: '+label.toLowerCase(),callback_data:'actyes:'+id}],[{text:'Отмена',callback_data:'actno:'+id}]]}});
 }
}
export async function confirmAction(cb,m,s,uid,secret){
 const match=/^act(yes|no):([0-9a-f-]{36})$/.exec(cb.data||'');if(!match)return false;
 try{await s.tg('answerCallbackQuery',{callback_query_id:cb.id});}catch{}
 let text;
 try{const result=await s.db('rpc/tochka_apply_assistant_action','POST',{p_user:uid,p_chat:m.chat.id,p_hook:await hash(secret),p_id:match[2],p_cancel:match[1]==='no'});
  text=({applied:'Изменение сохранено в «Точке дня».',cancelled:'Отменено. Запись не изменена.',changed:'Запись уже изменилась или удалена. Напишите команду заново.',stale:'Подтверждение устарело. Напишите команду заново.'})[result]||'Не удалось подтвердить результат.';
 }catch{text='Не удалось подтвердить результат. Повторите нажатие: одно действие не применяется дважды.';await s.tg('sendMessage',{chat_id:m.chat.id,text});return true;}
 try{await s.tg('editMessageText',{chat_id:m.chat.id,message_id:m.message_id,text,reply_markup:{inline_keyboard:[]}});}catch{await s.tg('sendMessage',{chat_id:m.chat.id,text});}
 return true;
}
