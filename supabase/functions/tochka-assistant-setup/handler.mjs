// Read-only connection check. Never returns secrets; never sends messages or modifies webhooks.
const EXPECTED_BOT='inna_assistant_bot';
export function makeHandler(env, request=fetch){
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
 return async req=>{
  if(req.method!=='GET')return reply({error:'method_not_allowed'},405);
  const auth=req.headers.get('authorization')||'';
  if(!/^Bearer \S+$/.test(auth))return reply({error:'sign_in_required'},401);
  const base=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY'),owner=(env('TOCHKA_ASSISTANT_OWNER_EMAIL')||'').trim().toLowerCase();
  if(!base||!key||!owner)return reply({error:'server_not_configured'},503);
  try{
   const res=await request(base+'/auth/v1/user',{headers:{apikey:key,authorization:auth},signal:AbortSignal.timeout(8000),redirect:'error'});
   if(!res.ok)return reply({error:'sign_in_required'},401);
   const u=await res.json();
   if(!u.id||!u.email_confirmed_at||typeof u.email!=='string'||u.email.toLowerCase()!==owner)return reply({error:'owner_only'},403);
   const token=env('TOCHKA_ASSISTANT_BOT_TOKEN');
   if(!token)return reply({bot:'@Inna_Assistant_bot',token:'missing',assistant:'not_connected',productionWrites:false});
   if(!/^\d{5,20}:[A-Za-z0-9_-]{20,100}$/.test(token))return reply({error:'invalid_bot_token_format'},422);
   const result=await request('https://api.telegram.org/bot'+token+'/getMe',{method:'POST',signal:AbortSignal.timeout(8000),redirect:'error'});
   if(!result.ok)return reply({error:'telegram_check_failed'},502);
   const data=await result.json();
   if(!data.ok||data.result?.is_bot!==true||typeof data.result?.username!=='string')return reply({error:'telegram_check_failed'},502);
   if(data.result.username.toLowerCase()!==EXPECTED_BOT)return reply({error:'wrong_bot'},409);
   return reply({bot:'@Inna_Assistant_bot',token:'verified',assistant:'not_connected',productionWrites:false});
  }catch{return reply({error:'connection_check_unavailable'},503)}
 };
}
