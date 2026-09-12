import {editHint} from './defaults.mjs';
import {hash,services,readJSON} from './common.mjs';
import {prepareDraft} from './deepseek.mjs';
import {validateProposal} from './proposal.mjs';
import {card,savedCard} from './conversation.mjs';
import {transcribeVoice,voiceErrorText} from './voice.mjs';
export function makeHandler(env,request=fetch,draft=prepareDraft,transcribe=transcribeVoice){
 return async req=>{
  if(req.method!=='POST')return new Response('',{status:405});
  const secret=req.headers.get('x-telegram-bot-api-secret-token')||'';
  if(!/^[a-f0-9]{64}$/.test(secret))return new Response('',{status:401});
  const s=services(env,request);let reserved=false,uid,update;
  try{
   const rows=await s.db('tochka_assistant_pilot?hook_hash=eq.'+await hash(secret)+'&select=user_id,enabled,enabled_at');
   const pilot=rows[0];if(!pilot)return new Response('',{status:401});
   if(!pilot.enabled)return new Response('ok');
   const body=await readJSON(req),cb=body?.callback_query;const m=cb?{...cb.message,from:cb.from}:body?.message;update=body?.update_id;uid=pilot.user_id;
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
   if(cb){
    if(typeof cb.id!=='string'||!Number.isSafeInteger(m.message_id)||typeof cb.data!=='string')return new Response('ok');
    const match=/^(save|cancel|edit):([0-9]{13})$/.exec(cb.data);if(!match)return new Response('ok');
    try{await s.tg('answerCallbackQuery',{callback_query_id:cb.id});}catch{}
    const version=Number(match[2]);
    try{
     if(match[1]==='edit'){
      const state=(await s.db('tochka_assistant_pilot'+filter+'&select=pending,pending_at'))[0];
      const fresh=state?.pending&&Date.parse(state.pending_at)===version&&version>Date.now()-1800000;
      await s.tg('sendMessage',{chat_id:m.chat.id,text:fresh?editHint(state.pending):'Эта запись уже сохранена, отменена или заменена. Для новой записи напишите её целиком.'});
     }else{
      const result=await s.db('rpc/tochka_assistant_confirm','POST',{p_user:uid,p_chat:m.chat.id,p_hook:await hash(secret),p_version:version,p_action:match[1]});
      const reply=['saved','already_saved'].includes(result.status)?savedCard(result.kind):{text:result.status==='cancelled'?'Отменено. Ничего не добавлено.':'Эта версия уже не актуальна. Используйте последнее сообщение бота или напишите запись заново.',reply_markup:{inline_keyboard:[]}};
      if(result.status==='saved'&&typeof m.text==='string')reply.text=m.text.split('Сохранить в «Точку дня»?')[0].trim()+'\n\n'+reply.text;
      try{await s.tg('editMessageText',{chat_id:m.chat.id,message_id:m.message_id,...reply,link_preview_options:{is_disabled:true}});}catch{await s.tg('sendMessage',{chat_id:m.chat.id,...reply});}
     }
    }catch{try{await s.tg('sendMessage',{chat_id:m.chat.id,text:'Не удалось подтвердить результат. Нажмите «Сохранить» ещё раз: повторное нажатие не создаёт дубль.'});}catch{}}
    return new Response('ok');
   }
   const hookInfo=await s.tg('getWebhookInfo');
   if(!hookInfo.allowed_updates?.includes('callback_query'))await s.tg('setWebhook',{url:env('SUPABASE_URL')+'/functions/v1/tochka-assistant-receiver',secret_token:secret,allowed_updates:['message','callback_query'],drop_pending_updates:false,max_connections:1});
   if(m.text==='/stop'){await s.db('tochka_assistant_pilot'+filter,'PATCH',{enabled:false,pending:null,pending_at:null});return new Response('ok');}
   const reservation=await s.db('rpc/tochka_assistant_reserve','POST',{p_user:uid,p_update:update});
   if(reservation==='busy')return new Response('',{status:503});
   if(reservation==='limit'){
    try{await s.tg('sendMessage',{chat_id:m.chat.id,text:'На сегодня достигнут лимит — 20 обращений. Работа возобновится после 00:00 по московскому времени. Это сообщение не обработано; после полуночи отправьте его снова. Сохранить уже подготовленную запись можно кнопкой «Сохранить».'});}catch{}
    return new Response('ok');
   }
   if(reservation!=='reserved')return new Response('ok');
   reserved=true;
   let text, pendingChange, presentation, transcript;
   if(m.voice){
    try {transcript=await transcribe({voice:m.voice,env,tg:s.tg,request});m.text=transcript;}
    catch(e){text=voiceErrorText(e)+' В «Точку дня» ничего не сохранено.';}
   }
   const context=(await s.db('tochka_assistant_pilot'+filter+'&select=pending,pending_at,enabled_at'))[0];
   let pending=null;
   if(context?.pending && Date.parse(context.pending_at)>Date.now()-30*60*1000 && Date.parse(context.pending_at)>=Date.parse(context.enabled_at)){try{pending=validateProposal(context.pending);}catch{}}
   if(text){}
   else if(typeof m.text!=='string')text='Отправьте текст или голосовое сообщение до 60 секунд.';
   else if(m.text==='/cancel'||m.text.trim().toLowerCase()==='отмена'){pendingChange=null;text='Черновик отменён. Напишите новое задание.';}
   else if(m.text.startsWith('/'))text='Напишите встречу, расход или заметку обычными словами. Я уточню недостающее и покажу кнопку «Сохранить». Запись появится в «Точке дня» после вашего подтверждения. Можно текстом или голосовым до 60 секунд; для отключения — /stop.';
   else if(!m.text.trim()||m.text.length>1500)text='Отправьте сообщение длиной от 1 до 1500 символов.';
   else {
    try {
     const settings=await s.db('user_app_data'+filter+'&select=currency:payload->settings->>cur');
     const defaultCurrency=settings[0]?.currency;
     const result=await draft({text:m.text,pending,defaultCurrency,apiKey:env('TOCHKA_ASSISTANT_DEEPSEEK_API_KEY'),fetchImpl:request});text=result.text;pendingChange=result.proposal?validateProposal(result.proposal):null;}
    catch(e){text=({balance_required:'На счёте DeepSeek недостаточно средств.',key_rejected:'Нужно проверить API-ключ DeepSeek.',key_missing_or_invalid:'Нужно проверить API-ключ DeepSeek.',provider_busy:'DeepSeek сейчас перегружен. Попробуйте позже.',provider_timeout:'DeepSeek не успел ответить. Попробуйте позже.',invalid_response:'Не удалось разобрать запись. Попробуйте сформулировать одно задание: покупку с суммой, встречу или заметку.'})[e.message]||'Не удалось подготовить черновик. Попробуйте позже.';text+=' В «Точку дня» ничего не сохранено.';}
   }
   if(await linked()){
    await s.user(null,uid);
    if(pendingChange!==undefined){const changed=await s.db('tochka_assistant_pilot'+filter+'&enabled=eq.true&current_update=eq.'+update,'PATCH',{pending:pendingChange,pending_at:pendingChange?new Date(Math.max(Date.now(),(Date.parse(context?.pending_at)||0)+1)).toISOString():null});if(!changed.length)return new Response('ok');if(pendingChange)presentation=card(pendingChange,Date.parse(changed[0].pending_at));}
    if(presentation&&transcript)presentation.text='Я услышал: «'+transcript+'»\n\n'+presentation.text;
    await s.tg('sendMessage',{chat_id:m.chat.id,...(presentation||{text}),link_preview_options:{is_disabled:true}});
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

