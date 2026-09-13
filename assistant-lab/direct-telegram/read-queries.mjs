const norm=t=>String(t||'').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
const short=(t,n=220)=>{const s=String(t||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s;};
export function readIntent(text){
 if(typeof text!=='string')return null;
 const t=norm(text).replace(/[?!\.]+$/,'').trim();
 if(['/today','что сегодня','что у меня сегодня','план на сегодня','планы на сегодня'].includes(t))return {kind:'agenda',offset:0};
 if(['/tomorrow','что завтра','что у меня завтра','план на завтра','планы на завтра'].includes(t))return {kind:'agenda',offset:1};
 const m=/^(?:\/search|найди заметку|найди заметки|поиск заметок)(?:\s+(?:про|о))?(?:\s+|:\s*)(.*)$/u.exec(t);
 if(m)return {kind:'search',query:m[1].trim()};
 if(['/search','найди заметку','найди заметки','поиск заметок'].includes(t))return {kind:'search',query:''};
 return null;
}
function dateInMoscow(now,offset){return new Date(+new Date(now)+3*3600000+offset*86400000).toISOString().slice(0,10);}
function occurs(e,date){
 if(typeof e.date!=='string')return false;
 if(e.date===date)return true;if(e.date>date)return false;
 return e.repeat==='year'?e.date.slice(5)===date.slice(5):e.repeat==='month'?e.date.slice(8)===date.slice(8):e.repeat==='week'?(Date.parse(date+'T12:00Z')-Date.parse(e.date+'T12:00Z'))%(7*86400000)===0:false;
}
export function readAnswer(intent,payload,now=new Date()){
 if(!payload||!Array.isArray(payload.ev)||!Array.isArray(payload.notes))throw new Error('cloud_unavailable');
 const deleted=new Set((payload.del||[]).map(x=>x.id));
 if(intent.kind==='search'){
  if(intent.query.length<2||intent.query.length>120)return 'Напишите от 2 до 120 символов для поиска. Например: «Найди заметку про документы».';
  const terms=norm(intent.query).split(' ');
  const found=payload.notes.filter(n=>!deleted.has(n.id)&&terms.every(t=>norm([n.title,n.text,n.theme,...(n.items||[]).map(i=>i.t)].join(' ')).includes(t))).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  if(!found.length)return 'По запросу «'+short(intent.query,120)+'» заметок не найдено.';
  const lines=['Найдено заметок: '+found.length];
  found.slice(0,8).forEach((n,i)=>lines.push((i+1)+'. '+short([n.title,n.text,...(n.items||[]).map(x=>x.t)].filter(Boolean).join(' — '),300)+(n.done?' [выполнено]':'')));
  if(found.length>8)lines.push('Показаны первые 8. Уточните запрос или откройте «Заметки» в приложении.');
  return lines.join('\n\n');
 }
 const date=dateInMoscow(now,intent.offset),done=new Set(payload.day?.[date]?.done||[]);
 const events=payload.ev.filter(e=>!deleted.has(e.id)&&occurs(e,date)).sort((a,b)=>String(a.time||'99:99').localeCompare(String(b.time||'99:99')));
 const tasks=payload.notes.filter(n=>!deleted.has(n.id)&&!n.done&&n.due&&(intent.offset===0?n.due<=date:n.due===date));
 const lines=[(intent.offset?'Завтра':'Сегодня')+', '+date.split('-').reverse().join('.')+' (Москва)'];
 lines.push(events.length?'Встречи: '+events.length:'Встреч нет.');
 events.slice(0,8).forEach(e=>lines.push((done.has(e.id)?'✓ ':'')+(e.time||'Без времени')+' — '+short(e.title,170)+(e.address?' · '+short(e.address,100):'')));
 if(events.length>8)lines.push('Показаны первые 8 встреч. Остальные — в приложении.');
 lines.push(tasks.length?'Задачи со сроком: '+tasks.length:'Невыполненных задач со сроком на этот день нет.');
 tasks.slice(0,6).forEach(n=>lines.push('• '+short(n.title||n.text,200)+(n.due<date?' (просрочено с '+n.due.split('-').reverse().join('.')+')':'')));
 if(tasks.length>6)lines.push('Показаны первые 6 задач. Остальные — в приложении.');
 return lines.join('\n');
}
export async function answerReadQuery(intent,s,uid,chat,linked){
 const memberPath='tochka_members?user_id=eq.'+encodeURIComponent(uid)+'&revoked_at=is.null&select=user_id';
 if(!(await s.db(memberPath)).length)return;
 let text;
 try{const rows=await s.db('user_app_data?user_id=eq.'+encodeURIComponent(uid)+'&select=payload');text=readAnswer(intent,rows[0]?.payload);}
 catch{text='Не удалось прочитать записи из облака. Попробуйте позже. Ваши записи не изменены.';}
 if(!await linked()||!(await s.db(memberPath)).length)return;
 await s.user(null,uid);
 await s.tg('sendMessage',{chat_id:chat,text,link_preview_options:{is_disabled:true},reply_markup:{inline_keyboard:[[{text:'Открыть сайт',url:'https://innaodincova-finpro.github.io/tochka-dnya/'}]]}});
}
