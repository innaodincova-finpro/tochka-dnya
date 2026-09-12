import test from 'node:test';import assert from 'node:assert/strict';
import {makeHandler} from './receiver.mjs';import {makeHandler as control} from './control.mjs';import {hash} from './common.mjs';
const uid='00000000-0000-0000-0000-000000000001', secret='a'.repeat(64);
const env=n=>({SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'service-test',SUPABASE_ANON_KEY:'anon-test',TOCHKA_ASSISTANT_OWNER_EMAIL:'owner@example.test',TOCHKA_ASSISTANT_BOT_TOKEN:'bot-test',TOCHKA_ASSISTANT_DEEPSEEK_API_KEY:'key-test'})[n];
const req=(secretValue=secret)=>new Request('https://test.invalid',{method:'POST',headers:{'x-telegram-bot-api-secret-token':secretValue},body:JSON.stringify({update_id:1,message:{date:Math.floor(Date.now()/1000),chat:{id:123,type:'private'},from:{id:123,is_bot:false},text:'Врач завтра в 10:15'}})});
async function fixture(options={}){
 let sends=0,models=0,seen=false;const paths=[];
 const fetcher=async(url,opts={})=>{
  paths.push(url);assert.doesNotMatch(url,/user_app_data|tochka_members/);
  if(url.includes('/auth/v1/'))return Response.json({id:uid,email:'owner@example.test',email_confirmed_at:'2026-01-01'});
  if(url.includes('tochka_assistant_pilot'))return Response.json([{user_id:uid,enabled:options.enabled!==false,enabled_at:'2026-01-01',hook_hash:options.badHash?'b'.repeat(64):await hash(secret)}]);
  if(url.includes('tochka_assistant_links'))return Response.json([{chat_id:options.otherChat?456:123}]);
  if(url.includes('/rpc/')){const result=seen?'duplicate':'reserved';seen=true;return Response.json(result);}
  if(url.includes('/sendMessage')){sends++;if(options.sendFailure)throw Error('ambiguous');return Response.json({ok:true,result:{}});}
  if(url.includes('tochka_assistant_deliveries'))return Response.json([]);
  assert.fail(url);
 };
 const handler=makeHandler(env,fetcher,async()=>{models++;return {text:'Черновик. Ничего не сохранено.'};});
 return {handler,counts:()=>({sends,models}),paths};
}
test('missing webhook auth makes no network call',async()=>{const h=makeHandler(env,()=>assert.fail());assert.equal((await h(req(''))).status,401);});
test('owner message produces draft once; repeated update ignored',async()=>{const f=await fixture();assert.equal((await f.handler(req())).status,200);await f.handler(req());assert.deepEqual(f.counts(),{sends:1,models:1});});
test('disabled or mismatched chat causes no inference/send',async()=>{for(const options of [{enabled:false},{otherChat:true},{badHash:true}]){const f=await fixture(options);await f.handler(req());assert.deepEqual(f.counts(),{sends:0,models:0});}});
test('ambiguous send is never automatically repeated',async()=>{const f=await fixture({sendFailure:true});await f.handler(req());await f.handler(req());assert.deepEqual(f.counts(),{sends:1,models:1});});
test('control requires owner auth before provider calls',async()=>{const h=control(env,()=>assert.fail());const r=await h(new Request('https://test.invalid',{method:'POST',body:'{}'}));assert.equal(r.status,401);});
