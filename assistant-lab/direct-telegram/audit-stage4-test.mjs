import assert from 'node:assert/strict';
import {prepareDraft} from './deepseek.mjs';
import {localDraft} from './local-draft.mjs';
import {makeHandler} from './receiver.mjs';
import {hash} from './common.mjs';

const now=new Date('2026-09-14T12:00:00Z'),today='2026-09-14';
const noPaidRequest=()=>{throw new Error('paid provider must not be called');};
let result=await prepareDraft({text:'Пятёрочка 5000',now,defaultCurrency:'RUB',fetchImpl:noPaidRequest});
assert.deepEqual(result.proposal,{kind:'expense',title:'Пятёрочка',date:today,amount:5000,currency:'RUB',category:'Продукты'});
result=await prepareDraft({text:'Зайти в аптеку в 19.00.',now,defaultCurrency:'RUB',fetchImpl:noPaidRequest});
assert.deepEqual(result.proposal,{kind:'event',title:'Зайти в аптеку',date:today,time:'19:00'});
assert.equal(localDraft('Аптека 19.00',today),null,'неоднозначное время не становится расходом локально');

const uid='00000000-0000-4000-8000-000000000001',secret='a'.repeat(64),hook=await hash(secret);
let calls=[];
const env=n=>({SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'fake',TOCHKA_ASSISTANT_OWNER_EMAIL:'owner@test.invalid',TOCHKA_ASSISTANT_BOT_TOKEN:'fake',TOCHKA_ASSISTANT_DEEPSEEK_API_KEY:'fake'})[n];
const request=async(url,o={})=>{
 const body=o.body?JSON.parse(o.body):null;calls.push([url,body]);let data;
 if(url.includes('/auth/'))data={id:uid,email:'owner@test.invalid',email_confirmed_at:'2026-01-01'};
 else if(url.endsWith('/getWebhookInfo'))data={ok:true,result:{allowed_updates:['message','callback_query']}};
 else if(url.includes('rpc/tochka_assistant_reserve'))data='reserved';
 else if(url.includes('tochka_assistant_links'))data=[{chat_id:123}];
 else if(url.includes('tochka_assistant_pilot')){if(o.method==='PATCH')throw new Error('simulated storage failure after draft');data=[{user_id:uid,enabled:true,enabled_at:'2026-01-01T00:00:00Z',hook_hash:hook,pending:null,pending_at:null}];}
 else if(url.includes('user_app_data'))data=[{currency:'RUB'}];
 else if(url.includes('tochka_assistant_deliveries'))data=[];
 else if(url.includes('api.telegram.org'))data={ok:true,result:{message_id:10}};
 else throw new Error('unexpected '+url);
 return Response.json(data);
};
const handler=makeHandler(env,request);
const message={date:Math.floor(Date.now()/1000),message_id:1,chat:{id:123,type:'private'},from:{id:123,is_bot:false},text:'Пятёрочка 5000'};
assert.equal((await handler(new Request('https://local',{method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body:JSON.stringify({update_id:77,message})}))).status,200);
const sent=calls.filter(([u])=>u.endsWith('/sendMessage')).at(-1)?.[1]?.text||'';
assert.match(sent,/внутреннего сбоя/);assert.match(sent,/ничего не сохранено/i);
console.log('PASS audit stage 4: deterministic safe path, no paid call, visible post-reservation failure');
