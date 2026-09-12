import assert from 'node:assert/strict';import {makeHandler} from './receiver.mjs';import {hash} from './common.mjs';import {card} from './conversation.mjs';
const secret='a'.repeat(64),h=await hash(secret),now=Date.now(),uid='00000000-0000-4000-8000-000000000001';let calls=[],stored=null;
const env=n=>({SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'fake',TOCHKA_ASSISTANT_OWNER_EMAIL:'owner@test.invalid',TOCHKA_ASSISTANT_BOT_TOKEN:'fake',TOCHKA_ASSISTANT_DEEPSEEK_API_KEY:'fake'})[n];
const request=async(url,o={})=>{calls.push([url,o.body&&JSON.parse(o.body)]);let r;
if(url.includes('/auth/'))r={id:uid,email:'owner@test.invalid',email_confirmed_at:'2026-01-01'};
else if(url.includes('api.telegram.org'))r={ok:true,result:{message_id:10}};
else if(url.includes('rpc/tochka_assistant_confirm'))r={status:'saved',kind:'event'};
else if(url.includes('rpc/tochka_assistant_reserve'))r='reserved';
else if(url.includes('tochka_assistant_links'))r=[{chat_id:123}];
else if(url.includes('tochka_assistant_pilot')){if(o.method==='PATCH'){stored=JSON.parse(o.body);r=[stored];}else r=[{user_id:uid,enabled:true,enabled_at:new Date(now-5000).toISOString(),hook_hash:h,pending:null,pending_at:null}];}
else r=[];return Response.json(r);};
const handler=makeHandler(env,request,async()=>({proposal:{kind:'event',title:'test',date:'2026-09-15',time:'18:00'},text:'old draft'}));
const message={message_id:10,date:Math.floor(now/1000),chat:{id:123,type:'private'},from:{id:123,is_bot:false},text:'test'};
const send=b=>handler(new Request('https://local',{method:'POST',headers:{'x-telegram-bot-api-secret-token':secret,'content-type':'application/json'},body:JSON.stringify(b)}));
assert.equal((await send({update_id:1,message})).status,200);const sent=calls.find(([u])=>u.endsWith('/sendMessage'))[1];assert.ok(sent.reply_markup.inline_keyboard[0][0].callback_data.startsWith('save:'));assert.equal(sent.text.includes('Черновик'),false);assert.ok(stored.pending_at);
calls=[];assert.equal((await send({update_id:2,callback_query:{id:'cb',from:message.from,data:'save:'+now,message:{...message,from:{id:999,is_bot:true}}}})).status,200);assert.equal(calls.filter(([u])=>u.includes('rpc/tochka_assistant_confirm')).length,1);assert.ok(calls.some(([u])=>u.endsWith('/editMessageText')));assert.ok(!calls.some(([u])=>u.includes('reserve')));
calls=[];await send({update_id:3,callback_query:{id:'cb',from:{id:777,is_bot:false},data:'save:'+now,message}});assert.equal(calls.filter(([u])=>u.includes('confirm')).length,0);
const missing=card({kind:'event',title:'test'},now);assert.equal(missing.reply_markup.inline_keyboard.flat().some(b=>b.callback_data.startsWith('save:')),false);
console.log('PASS direct button path, callback identity, no paid inference on click, incomplete proposal cannot save');
