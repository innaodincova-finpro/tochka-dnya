import {ORIGIN,hash,safe,services,readJSON} from './common.mjs';
export function makeHandler(env,request=fetch){
 const reply=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','access-control-allow-origin':ORIGIN,'access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS','vary':'Origin'}});
 return async req=>{
  if(req.headers.get('origin')&&req.headers.get('origin')!==ORIGIN)return reply({error:'origin_not_allowed'},403);
  if(req.method==='OPTIONS')return reply({ok:true});
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  const auth=req.headers.get('authorization')||'';if(!/^Bearer \S+$/.test(auth))return reply({error:'sign_in_required'},401);
  try{
   const s=services(env,request),u=await s.user(auth),input=await readJSON(req),filter='?user_id=eq.'+encodeURIComponent(u.id);
   if(!['status','enable','disable'].includes(input?.action))throw safe('invalid_request',400);
   const links=await s.db('tochka_assistant_links'+filter+'&select=chat_id');
   if(!links[0]?.chat_id)throw safe('not_linked',409);
   const rows=await s.db('tochka_assistant_pilot'+filter+'&select=enabled,used,day');
   if(input.action==='status')return reply({enabled:!!rows[0]?.enabled,key_present:!!env('TOCHKA_ASSISTANT_DEEPSEEK_API_KEY'),limit:20});
   if(input.action==='disable'){await s.db('tochka_assistant_pilot'+filter,'PATCH',{enabled:false});return reply({enabled:false});}
   if(env('TOCHKA_ASSISTANT_RECEIVER_READY')!=='true')throw safe('rollout_not_ready',409);
   const key=env('TOCHKA_ASSISTANT_DEEPSEEK_API_KEY');if(!key||/\s/.test(key))throw safe('key_missing_or_invalid',409);
   const balance=await request('https://api.deepseek.com/user/balance',{headers:{authorization:'Bearer '+key},signal:AbortSignal.timeout(10000),redirect:'error'});
   if(!balance.ok){await balance.body?.cancel();throw safe(balance.status===401?'key_rejected':'provider_unavailable',409);}
   const b=await balance.json();if(b.is_available!==true)throw safe('balance_required',409);
   const me=await s.tg('getMe');if(me.username?.toLowerCase()!=='inna_assis_bot'||!me.is_bot)throw safe('wrong_bot',409);
   const url=env('SUPABASE_URL')+'/functions/v1/tochka-assistant-receiver';
   const old=await s.tg('getWebhookInfo');if(old.url&&old.url!==url)throw safe('existing_webhook',409);
   // Never disclose the webhook credential; only its digest persists.
   const secret=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
   const values={enabled:false,hook_hash:await hash(secret),enabled_at:new Date(Math.floor(Date.now()/1000)*1000).toISOString()};
   if(rows.length)await s.db('tochka_assistant_pilot'+filter,'PATCH',values);
   else await s.db('tochka_assistant_pilot','POST',{user_id:u.id,...values});
   await s.tg('setWebhook',{url,secret_token:secret,allowed_updates:['message'],drop_pending_updates:false,max_connections:1});
   const enabled=await s.db('tochka_assistant_pilot'+filter+'&hook_hash=eq.'+await hash(secret),'PATCH',{enabled:true});
   if(!enabled.length)throw safe('state_changed',409);
   return reply({enabled:true,limit:20});
  }catch(e){return reply({error:e.safe||'connection_unavailable'},e.status||503);}
 };
}
