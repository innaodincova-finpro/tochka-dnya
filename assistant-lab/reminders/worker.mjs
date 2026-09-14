import {services} from './common.mjs';
import {candidates,reminderText} from './schedule.mjs';
const eq=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;};
export function makeReminderHandler(env,request=fetch,clock=()=>Date.now()){
 return async req=>{
  if(req.method!=='POST')return new Response('',{status:405});
  const jobKey=req.headers.get('x-job-key');
  if(!jobKey||jobKey.length!==72)return new Response('',{status:401});
  const s=services(env,request);
  let authorized=false;
  const result={checked:0,sent:0,retry:0,unknown:0,skipped:0};
  try{
   const config=(await s.db('tochka_telegram_reminder_config?id=eq.1&select=cron_token,owner_id,enabled'))[0];
   if(!config||!eq(jobKey,config.cron_token))return new Response('',{status:401});
   authorized=true;
   if(!config.enabled||!config.owner_id)return Response.json({enabled:false});
   const uid=config.owner_id,filter='?user_id=eq.'+encodeURIComponent(uid);
   // Same verified owner account as the input bot; never enumerate other members.
   await s.user(null,uid);
   async function current(){
    const cfg=(await s.db('tochka_telegram_reminder_config?id=eq.1&select=owner_id,enabled'))[0];
    if(!cfg?.enabled||cfg.owner_id!==uid)return null;
    const pilot=(await s.db('tochka_assistant_pilot'+filter+'&select=enabled'))[0];
    const link=(await s.db('tochka_assistant_links'+filter+'&select=chat_id'))[0];
    const member=(await s.db('tochka_members'+filter+'&revoked_at=is.null&select=user_id'))[0];
    if(!pilot?.enabled||!member||!Number.isSafeInteger(Number(link?.chat_id))||Number(link.chat_id)<=0)return null;
    const row=(await s.db('user_app_data'+filter+'&select=payload'))[0];
    return row?{chat:Number(link.chat_id),payload:row.payload}:null;
   }
   const initial=await current();
   if(initial){
    const started=clock();
    const list=candidates(initial.payload,clock());result.checked=list.length;
    if(list.length){const me=await s.tg('getMe');if(me.is_bot!==true||me.username?.toLowerCase()!=='inna_assis_bot')throw new Error('wrong_bot');}
    // Bound one invocation; unsent candidates are picked up by the next minute.
    let attempted=0;
    for(const candidate of list){
     if(attempted>=10||clock()-started>40000)break;
     const fresh=await current();
     const latest=fresh&&candidates(fresh.payload,clock()).find(c=>c.key===candidate.key);
     if(!latest||fresh.chat!==initial.chat){result.skipped++;continue;}
     const token=await s.db('rpc/tochka_claim_telegram_reminder','POST',{p_user:uid,p_chat:fresh.chat,p_key:latest.key,p_event:latest.event,p_date:latest.occurrence});
     if(!token)continue;
     attempted++;
     const delivery='tochka_telegram_reminder_deliveries'+filter+'&key=eq.'+encodeURIComponent(latest.key)+'&claim_id=eq.'+encodeURIComponent(token);
     // Recheck after claiming as well. A later edit cannot undo a message already sent.
     const finalState=await current();
     const final=finalState?.chat===fresh.chat&&candidates(finalState.payload,clock()).find(c=>c.key===latest.key);
     if(!final){await s.db(delivery,'PATCH',{state:'skipped'});result.skipped++;continue;}
     let state='unknown',retry_at=null;
     try{
      const response=await request('https://api.telegram.org/bot'+env('TOCHKA_ASSISTANT_BOT_TOKEN')+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:finalState.chat,text:reminderText(final,clock()),link_preview_options:{is_disabled:true},reply_markup:{inline_keyboard:[[{text:'Открыть сайт',url:'https://innaodincova-finpro.github.io/tochka-dnya/'}]]}}),signal:AbortSignal.timeout(8000),redirect:'error'});
      const answer=await response.json();
      if(response.ok&&answer.ok===true)state='sent';
      else if(answer.ok===false&&answer.error_code===429){state='retry';retry_at=new Date(clock()+Math.max(60,Number(answer.parameters?.retry_after)||60)*1000).toISOString();}
      else if(answer.ok===false)state='skipped';
     }catch{/* Unknown delivery outcome must not trigger a duplicate message. */}
     result[state]++;
     await s.db(delivery,'PATCH',{state,retry_at,...(state==='sent'?{sent_at:new Date(clock()).toISOString()}:{})});
    }
   }
   await s.db('tochka_telegram_reminder_config?id=eq.1','PATCH',{last_run_at:new Date(clock()).toISOString(),last_result:result});
   return Response.json(result);
  }catch{
   if(authorized){try{await s.db('tochka_telegram_reminder_config?id=eq.1','PATCH',{last_run_at:new Date(clock()).toISOString(),last_result:{...result,error:'run_failed'}});}catch{}}
   return Response.json({error:'run_failed'},{status:503});
  }
 };
}
