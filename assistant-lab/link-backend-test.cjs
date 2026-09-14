const assert=require('node:assert/strict');
(async()=>{
const {makeHandler}=await import('../supabase/functions/tochka-assistant-link/handler.mjs');
const env=k=>({SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'SERVICE_SECRET',TOCHKA_ASSISTANT_OWNER_EMAIL:'owner@example.test',TOCHKA_ASSISTANT_BOT_TOKEN:'BOT_SECRET'})[k];
let row,updates=[],sent=0,other=false,hook=false,calls=[];
const f=async(url,o)=>{calls.push(url);assert.equal(o.redirect,'error');if(url.endsWith('/auth/v1/user'))return Response.json({id:'abc',email:other?'other@example.test':'owner@example.test',email_confirmed_at:'2026-01-01'});
 if(url.includes('/rest/')){assert.ok(url.includes('/tochka_assistant_links'));assert.equal(o.headers.apikey,'SERVICE_SECRET');const body=o.body?JSON.parse(o.body):{};if(o.method==='GET')return Response.json(row?[row]:[]);if(o.method==='POST'){row??=body;return Response.json([row]);}if(o.method==='DELETE'){row=undefined;return Response.json([]);}if(o.method==='PATCH'){if(url.includes('chat_id=is.null')&&row.chat_id)return Response.json([]);if(url.includes('test_state=eq.ready')&&row.test_state!=='ready')return Response.json([]);row={test_state:'ready',...row,...body};return Response.json([row]);}}
 const method=url.split('/').pop();if(method==='getMe')return Response.json({ok:true,result:{is_bot:true,username:'Inna_Assis_bot'}});if(method==='getWebhookInfo')return Response.json({ok:true,result:{url:hook?'https://existing.test':''}});if(method==='getUpdates'){assert.ok(!('offset' in JSON.parse(o.body)));return Response.json({ok:true,result:updates})}if(method==='sendMessage'){assert.equal(JSON.parse(o.body).chat_id,123);sent++;return Response.json({ok:true,result:{message_id:1}})}throw Error('unexpected call');};
const h=makeHandler(env,f);const invoke=async(action,extra={},auth='Bearer owner')=>{const r=await h(new Request('https://fn.test',{method:'POST',headers:{authorization:auth},body:JSON.stringify({action,...extra})}));const text=await r.text();assert.ok(!text.includes('SECRET'));return {status:r.status,...JSON.parse(text)}};
assert.equal((await invoke('start',{},'')).status,401);other=true;assert.equal((await invoke('start')).status,403);assert.equal(calls.filter(x=>x.includes('/rest/')).length,0);other=false;
hook=true;assert.equal((await invoke('start')).error,'existing_webhook');hook=false;
const start=await invoke('start');assert.match(start.url,/https:\/\/t.me\/Inna_Assis_bot\?start=/);assert.ok(row.challenge_hash!==start.code);assert.equal((await invoke('check',{code:'f'.repeat(48)})).status,400);
assert.equal((await invoke('check',{code:start.code})).pending,true);
updates=[{message:{chat:{type:'group',id:123},from:{id:123,is_bot:false},text:'/start '+start.code,date:Date.now()/1000}}];assert.equal((await invoke('check',{code:start.code})).pending,true);
updates[0].message.chat.type='private';assert.equal((await invoke('check',{code:start.code})).linked,true);assert.equal(row.challenge_hash,null);assert.equal(sent,0);
assert.equal((await invoke('test')).test_state,'sent');await invoke('test');assert.equal(sent,1);assert.equal((await invoke('status')).linked,true);await invoke('unlink');assert.equal((await invoke('status')).linked,false);
console.log('PASS owner-only access, existing webhook preserved, random challenge, invalid code, private chat proof, one-time consumption, explicit test, duplicate suppression, unlink');
})().catch(e=>{console.error(e);process.exitCode=1});
