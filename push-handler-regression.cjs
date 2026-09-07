const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
(async()=>{
 const schedule=await import('./supabase/functions/push/schedule.js'),webpush=require('web-push');
 const crypto=require('node:crypto'),ec=crypto.createECDH('prime256v1');ec.generateKeys();
 const subscription={endpoint:'https://web.push.apple.com/test',keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')}};
 let handler,providerCalls=0,providerStatus=201,reads=0,move=false;
 const sid='00000000-0000-0000-0000-000000000002',uid='00000000-0000-0000-0000-000000000001';
 const config={cron_token:'job-secret',vapid:webpush.generateVAPIDKeys()},subs=[{id:sid,user_id:uid,subscription,enabled:true,timezone:'Europe/Moscow'}],claimed=new Set();
 let events=[{id:'meeting',date:'2026-09-07',time:'12:00',title:'test'}];
 const clock=class extends Date{static now(){return Date.parse('2026-09-07T08:00:30Z');}};
 let source=fs.readFileSync('supabase/functions/push/index.ts','utf8').replace(/^import .*;\n/gm,'');
 vm.runInNewContext(stripTypeScriptTypes(source),{...schedule,webpush,URL,Response,Request,AbortSignal,Uint8Array,Intl,Date:clock,Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://test.invalid':'service-secret'},serve:f=>handler=f},fetch:async(url,opts={})=>{
  if(url.includes('web.push.apple.com')){providerCalls++;assert(opts.body instanceof Uint8Array);assert(opts.headers.Authorization.startsWith('vapid '));return new Response('',{status:providerStatus});}
  if(url.endsWith('/auth/v1/user'))return opts.headers.Authorization==='Bearer user'?Response.json({id:uid}):new Response('',{status:401});
  const u=new URL(url),path=u.pathname.split('/').pop(),method=opts.method||'GET',body=opts.body?JSON.parse(opts.body):null;
  if(path==='push_configuration'){if(method==='PATCH')Object.assign(config,body);return Response.json([config]);}
  if(path==='user_app_data'){reads++;return Response.json([{payload:{ev:move&&reads>1?[]:events}}]);}
  if(path==='claim_push_delivery'){if(claimed.has(body.delivery_key))return Response.json(false);claimed.add(body.delivery_key);return Response.json(true);}
  if(path==='push_deliveries')return Response.json([]);
  if(path==='push_subscriptions'){
   if(method==='PATCH'){Object.assign(subs[0],body);return Response.json(subs);}
   if(u.searchParams.get('user_id')&&u.searchParams.get('user_id')!=='eq.'+uid)return Response.json([]);
   if(u.searchParams.get('enabled')==='eq.true'&&!subs[0].enabled)return Response.json([]);
   return Response.json(subs);
  }
  throw new Error('Unexpected '+url);
 }});
 const req=(body,headers={})=>new Request('https://test.invalid/push',{method:'POST',headers,body:JSON.stringify(body)});
 assert.equal((await handler(req({action:'key'}))).status,401);
 assert.equal((await handler(req({}, {'x-job-key':'wrong'}))).status,403);
 const key=await (await handler(req({action:'key'},{Authorization:'Bearer user'}))).json();assert.equal(key.publicKey,config.vapid.publicKey);assert(!JSON.stringify(key).includes(config.vapid.privateKey));
 assert.equal((await handler(req({action:'subscribe',subscription:{...subscription,endpoint:'http://127.0.0.1'},timezone:'Europe/Moscow'},{Authorization:'Bearer user'}))).status,400);
 let result=await handler(req({}, {'x-job-key':'job-secret'}));assert.equal(result.status,200);assert.equal((await result.json()).sent,1);assert.equal(providerCalls,1);
 await handler(req({}, {'x-job-key':'job-secret'}));assert.equal(providerCalls,1,'no duplicate');
 claimed.clear();reads=0;move=true;await handler(req({}, {'x-job-key':'job-secret'}));assert.equal(providerCalls,1,'moved between scan and send');
 claimed.clear();reads=0;move=false;providerStatus=410;await handler(req({}, {'x-job-key':'job-secret'}));assert.equal(subs[0].enabled,false,'expired endpoint disabled');
 console.log('PUSH HANDLER PASS: auth, public-key-only response, SSRF rejection, encrypted dispatch, dedupe, fresh data, expired subscription.');
})().catch(e=>{console.error(e);process.exitCode=1});
