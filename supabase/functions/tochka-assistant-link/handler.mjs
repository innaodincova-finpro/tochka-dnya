const ORIGIN='https://innaodincova-finpro.github.io';
const BOT='Inna_Assis_bot';
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
export function makeHandler(env,request=fetch){
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','access-control-allow-origin':ORIGIN,'access-control-allow-headers':'authorization, apikey, content-type','access-control-allow-methods':'POST, OPTIONS','vary':'Origin'}});
 return async req=>{
  if(req.headers.get('origin')&&req.headers.get('origin')!==ORIGIN)return reply({error:'origin_not_allowed'},403);
  if(req.method==='OPTIONS')return reply({ok:true});
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  const auth=req.headers.get('authorization')||'';
  if(!/^Bearer \S+$/.test(auth))return reply({error:'sign_in_required'},401);
  const base=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),owner=(env('TOCHKA_ASSISTANT_OWNER_EMAIL')||'').trim().toLowerCase();
  const fail=(code,status=503)=>{throw {safe:code,status}};
  try{
   if(!base||!anon||!owner)fail('server_not_configured');
   const ur=await request(base+'/auth/v1/user',{headers:{apikey:anon,authorization:auth},signal:AbortSignal.timeout(8000),redirect:'error'});
   if(!ur.ok)return reply({error:'sign_in_required'},401);
   const u=await ur.json();
   if(!u.id||!u.email_confirmed_at||u.email?.toLowerCase()!==owner)return reply({error:'owner_only'},403);
   const raw=await req.text();if(raw.length>1000)return reply({error:'invalid_request'},400);
   let input;try{input=JSON.parse(raw)}catch{return reply({error:'invalid_request'},400)}
   if(!['status','start','check','test','unlink'].includes(input?.action))return reply({error:'invalid_request'},400);
   const service=env('SUPABASE_SERVICE_ROLE_KEY'),token=env('TOCHKA_ASSISTANT_BOT_TOKEN');
   if(!service||!token)fail('server_not_configured');
   const db=async(method,filter='',body,prefer='return=representation')=>{
    const r=await request(base+'/rest/v1/tochka_assistant_links'+filter,{method,headers:{apikey:service,authorization:'Bearer '+service,'content-type':'application/json',prefer},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000),redirect:'error'});
    if(!r.ok)fail('storage_unavailable');return r.status===204?[]:await r.json();
   };
   const tg=async(method,body={})=>{
    const r=await request('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000),redirect:'error'});
    if(!r.ok)fail('telegram_unavailable');const d=await r.json();if(!d.ok)fail('telegram_unavailable');return d.result;
   };
   const filter='?user_id=eq.'+encodeURIComponent(u.id);
   let row=(await db('GET',filter+'&select=*'))[0];
   const state=()=>({linked:!!row?.chat_id,test_state:row?.test_state||'ready',bot:'@'+BOT});
   if(input.action==='status')return reply(state());
   if(input.action==='unlink'){await db('DELETE',filter);return reply({linked:false});}
   const me=await tg('getMe');if(me?.is_bot!==true||me.username?.toLowerCase()!==BOT.toLowerCase())return reply({error:'wrong_bot'},409);
   if(input.action==='start'){
    if(row?.chat_id)return reply(state());
    const hook=await tg('getWebhookInfo');if(hook.url)return reply({error:'existing_webhook'},409);
    const code=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','').slice(0,16);
    const values={challenge_hash:await hash(code),expires_at:new Date(Date.now()+600000).toISOString()};
    if(!row)await db('POST','?on_conflict=user_id',{user_id:u.id},'resolution=ignore-duplicates,return=representation');
    const updated=await db('PATCH',filter+'&chat_id=is.null',values);
    if(!updated.length)return reply({error:'state_changed'},409);
    return reply({linked:false,code,url:'https://t.me/'+BOT+'?start='+code,expires_at:values.expires_at});
   }
   if(input.action==='check'){
    if(row?.chat_id)return reply(state());
    if(!row?.challenge_hash||Date.parse(row.expires_at)<=Date.now())return reply({error:'code_expired'},410);
    if(typeof input.code!=='string'||!/^[a-f0-9]{48}$/.test(input.code)||await hash(input.code)!==row.challenge_hash)return reply({error:'invalid_code'},400);
    const hook=await tg('getWebhookInfo');if(hook.url)return reply({error:'existing_webhook'},409);
    // No offset: never acknowledge or discard queued messages during this pilot.
    const updates=await tg('getUpdates',{limit:100,timeout:0});
    if(!Array.isArray(updates))fail('telegram_unavailable');
    const matches=updates.map(x=>x.message).filter(m=>m?.chat?.type==='private'&&Number.isSafeInteger(m.chat.id)&&m.chat.id>0&&m.from?.id===m.chat.id&&m.from?.is_bot===false&&m.text==='/start '+input.code&&m.date*1000>=Date.parse(row.expires_at)-600000-5000);
    const ids=[...new Set(matches.map(m=>m.chat.id))];
    if(ids.length>1)return reply({error:'ambiguous_chat'},409);
    if(!ids.length)return reply({linked:false,pending:true,queue_full:updates.length===100});
    const changed=await db('PATCH',filter+'&chat_id=is.null&challenge_hash=eq.'+row.challenge_hash+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString()),{chat_id:ids[0],linked_at:new Date().toISOString(),challenge_hash:null,expires_at:null});
    if(!changed.length)return reply({error:'state_changed'},409);
    return reply({linked:true,test_state:'ready',bot:'@'+BOT});
   }
   if(!row?.chat_id)return reply({error:'not_linked'},409);
   const reserved=await db('PATCH',filter+'&chat_id=eq.'+row.chat_id+'&test_state=eq.ready',{test_state:'sending'});
   if(!reserved.length)return reply({linked:true,test_state:row.test_state,already_attempted:true});
   try{
    await tg('sendMessage',{chat_id:row.chat_id,text:'Точка дня: связь с вашим Telegram проверена. Это пробное сообщение. ИИ и доступ к записям пока не подключены.'});
    await db('PATCH',filter+'&chat_id=eq.'+row.chat_id+'&test_state=eq.sending',{test_state:'sent'});
    return reply({linked:true,test_state:'sent'});
   }catch{
    await db('PATCH',filter+'&chat_id=eq.'+row.chat_id+'&test_state=eq.sending',{test_state:'unknown'});
    return reply({linked:true,test_state:'unknown'});
   }
  }catch(e){return reply({error:e?.safe||'connection_unavailable'},e?.status||503)}
 };
}
