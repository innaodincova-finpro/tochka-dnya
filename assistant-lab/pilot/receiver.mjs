import {hash,services,readJSON} from './common.mjs';
import {prepareDraft} from './deepseek.mjs';
import {validateProposal} from './proposal.mjs';
export function makeHandler(env,request=fetch,draft=prepareDraft){
 return async req=>{
  if(req.method!=='POST')return new Response('',{status:405});
  const secret=req.headers.get('x-telegram-bot-api-secret-token')||'';
  if(!/^[a-f0-9]{64}$/.test(secret))return new Response('',{status:401});
  const s=services(env,request);let reserved=false,uid,update;
  try{
   const rows=await s.db('tochka_assistant_pilot?hook_hash=eq.'+await hash(secret)+'&select=user_id,enabled,enabled_at');
   const pilot=rows[0];if(!pilot)return new Response('',{status:401});
   if(!pilot.enabled)return new Response('ok');
   const body=await readJSON(req),m=body?.message;update=body?.update_id;uid=pilot.user_id;
   if(!Number.isSafeInteger(update)||update<0||m?.chat?.type!=='private'||!Number.isSafeInteger(m.chat.id)||m.chat.id<=0||m.from?.id!==m.chat.id||m.from?.is_bot!==false)return new Response('ok');
   // The pilot processes only new messages, never earlier pairing codes or backlog.
   if(!Number.isFinite(m.date)||m.date*1000<Date.parse(pilot.enabled_at))return new Response('ok');
   const filter='?user_id=eq.'+encodeURIComponent(uid);
   const linked=async()=>{
    const l=await s.db('tochka_assistant_links'+filter+'&select=chat_id');
    const p=await s.db('tochka_assistant_pilot'+filter+'&select=enabled,hook_hash');
    return String(l[0]?.chat_id)===String(m.chat.id)&&p[0]?.enabled&&p[0]?.hook_hash===await hash(secret);
   };
   if(!await linked())return new Response('ok');
   await s.user(null,uid);
   if(m.text==='/stop'){await s.db('tochka_assistant_pilot'+filter,'PATCH',{enabled:false,pending:null,pending_at:null});return new Response('ok');}
   const reservation=await s.db('rpc/tochka_assistant_reserve','POST',{p_user:uid,p_update:update});
   if(reservation==='busy')return new Response('',{status:503});
   if(reservation!=='reserved')return new Response('ok');
   reserved=true;
   let text, pendingChange;
   const context=(await s.db('tochka_assistant_pilot'+filter+'&select=pending,pending_at,enabled_at'))[0];
   let pending=null;
   if(context?.pending && Date.parse(context.pending_at)>Date.now()-30*60*1000 && Date.parse(context.pending_at)>=Date.parse(context.enabled_at)){try{pending=validateProposal(context.pending);}catch{}}
   if(typeof m.text!=='string')text='Пока я принимаю только текст. Голосовые сообщения ещё не подключены.';
   else if(m.text==='/cancel'||m.text.trim().toLowerCase()==='отмена'){pendingChange=null;text='Черновик отменён. Напишите новое задание.';}
   else if(m.text.startsWith('/'))text='Напишите встречу, расход или заметку. Я подготовлю черновик. Для отключения — /stop.';
   else if(!m.text.trim()||m.text.length>1500)text='Отправьте сообщение длиной от 1 до 1500 символов.';
   else {
    try {const result=await draft({text:m.text,pending,apiKey:env('TOCHKA_ASSISTANT_DEEPSEEK_API_KEY'),fetchImpl:request});text=result.text;pendingChange=result.proposal?validateProposal(result.proposal):null;}
    catch(e){text=({balance_required:'На счёте DeepSeek недостаточно средств.',key_rejected:'Нужно проверить API-ключ DeepSeek.',key_missing_or_invalid:'Нужно проверить API-ключ DeepSeek.',provider_busy:'DeepSeek сейчас перегружен. Попробуйте позже.',provider_timeout:'DeepSeek не успел ответить. Попробуйте позже.',invalid_response:'Не удалось получить корректный черновик. Напишите задачу ещё раз с датой и временем.'})[e.message]||'Не удалось подготовить черновик. Попробуйте позже.';text+=' В «Точку дня» ничего не сохранено.';}
   }
   if(await linked()){
    await s.user(null,uid);
    if(pendingChange!==undefined){const changed=await s.db('tochka_assistant_pilot'+filter+'&enabled=eq.true&current_update=eq.'+update,'PATCH',{pending:pendingChange,pending_at:pendingChange?new Date().toISOString():null});if(!changed.length)return new Response('ok');}
    await s.tg('sendMessage',{chat_id:m.chat.id,text,link_preview_options:{is_disabled:true}});
    await s.db('tochka_assistant_deliveries?update_id=eq.'+update+'&user_id=eq.'+encodeURIComponent(uid),'PATCH',{state:'sent'});
   }
   return new Response('ok');
  }catch{
   // After reservation, never retry potentially delivered messages or paid inference.
   if(reserved){try{await s.db('tochka_assistant_deliveries?update_id=eq.'+update+'&user_id=eq.'+encodeURIComponent(uid),'PATCH',{state:'failed'});}catch{}return new Response('ok');}
   return new Response('',{status:503});
  }
 };
}
