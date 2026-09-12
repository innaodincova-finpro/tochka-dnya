export const ORIGIN='https://innaodincova-finpro.github.io';
export const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
export const safe=(code,status=503)=>Object.assign(new Error(code),{safe:code,status});
export function services(env,request=fetch){
 const base=env('SUPABASE_URL'),service=env('SUPABASE_SERVICE_ROLE_KEY');
 return {
  async db(path,method='GET',body){
   const r=await request(base+'/rest/v1/'+path,{method,headers:{apikey:service,authorization:'Bearer '+service,'content-type':'application/json',prefer:'return=representation,resolution=merge-duplicates'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000),redirect:'error'});
   if(!r.ok)throw safe('storage_unavailable');return r.status===204?null:r.json();
  },
  async user(auth,adminId){
   const r=await request(base+'/auth/v1/'+(adminId?'admin/users/'+encodeURIComponent(adminId):'user'),{headers:{apikey:adminId?service:env('SUPABASE_ANON_KEY'),authorization:adminId?'Bearer '+service:auth},signal:AbortSignal.timeout(8000),redirect:'error'});
   if(!r.ok)throw safe('sign_in_required',401);const u=await r.json();
   if(!u.id||!u.email_confirmed_at||!env('TOCHKA_ASSISTANT_OWNER_EMAIL')||u.email?.toLowerCase()!==env('TOCHKA_ASSISTANT_OWNER_EMAIL').trim().toLowerCase()||(u.banned_until&&Date.parse(u.banned_until)>Date.now()))throw safe('owner_only',403);
   return u;
  },
  async tg(method,body={}){
   const r=await request('https://api.telegram.org/bot'+env('TOCHKA_ASSISTANT_BOT_TOKEN')+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000),redirect:'error'});
   if(!r.ok)throw safe('telegram_unavailable');const d=await r.json();if(!d.ok)throw safe('telegram_unavailable');return d.result;
  }
 };
}
export async function readJSON(req){
 const reader=req.body?.getReader();if(!reader)throw safe('invalid_request',400);
 let size=0,text='';const decoder=new TextDecoder();
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();throw safe('invalid_request',413);}text+=decoder.decode(value,{stream:true});}
 try{return JSON.parse(text+decoder.decode());}catch{throw safe('invalid_request',400);}
}
