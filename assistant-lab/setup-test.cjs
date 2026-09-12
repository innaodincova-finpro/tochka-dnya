const assert=require('node:assert/strict');
(async()=>{
 const {makeHandler}=await import('../supabase/functions/tochka-assistant-setup/handler.mjs');let n=0;
 const token='12345678:abcdefghijklmnopqrstuvwxyz_123456789';
 async function check(name,{auth='Bearer test',method='GET',owner=true,confirmed=true,secret=token,username='Inna_Assis_bot',throwNetwork=false,telegramStatus=200}={},expected){
  const calls=[];const env=k=>({SUPABASE_URL:'https://auth.test',SUPABASE_ANON_KEY:'public',TOCHKA_ASSISTANT_BOT_TOKEN:secret,TOCHKA_ASSISTANT_OWNER_EMAIL:'owner@example.test'})[k];
  const f=async(url,opts)=>{calls.push(url);assert.equal(opts.redirect,'error');if(throwNetwork)throw Error('SECRET:'+token);if(url.endsWith('/auth/v1/user'))return Response.json({id:'u',email:owner?'owner@example.test':'other@example.com',email_confirmed_at:confirmed?'2026-01-01':null});assert.equal(url,'https://api.telegram.org/bot'+token+'/getMe');assert.equal(opts.method,'POST');return Response.json({ok:true,result:{username,is_bot:true}},{status:telegramStatus})};
  const res=await makeHandler(env,f)(new Request('https://edge.test',{method,headers:auth?{authorization:auth}:{}}));const body=await res.text();assert.equal(res.status,expected,name);assert.ok(!body.includes(token));assert.ok(!body.includes('public'));if(!auth||method!=='GET')assert.equal(calls.length,0);if(!owner||!confirmed||!secret)assert.ok(calls.length<=1);n++;console.log('PASS '+name);
 }
 await check('anonymous blocked',{auth:''},401);await check('writes blocked',{method:'POST'},405);await check('other user blocked',{owner:false},403);await check('unconfirmed owner blocked',{confirmed:false},403);await check('missing secret reported only to owner',{secret:''},200);await check('invalid token rejected without request',{secret:'bad'},422);await check('correct bot checked without messaging',{},200);await check('wrong bot rejected',{username:'other_bot'},409);await check('upstream error redacted',{throwNetwork:true},503);await check('Telegram failure not reported as verified',{telegramStatus:401},502);
 console.log(n+' setup checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
