import assert from 'node:assert/strict';
import {prepareDraft} from './deepseek.mjs';
import {localDraft} from './local-draft.mjs';
import {expenseDefaults} from './defaults.mjs';
import {makeHandler} from './receiver.mjs';
import {hash} from './common.mjs';
const today='2026-09-13',now=new Date('2026-09-12T21:10:00Z');
const noNetwork=()=>{throw new Error('Unexpected paid request');};
for(const text of ['Пятёрочка, пять тысяч','Магазин Пятёрочка пять тысяч','Пятёрочка 5 000','Пятёрочка 5\u00a0000']){
 const {proposal:p}=await prepareDraft({text,now,defaultCurrency:'KZT',fetchImpl:noNetwork});
 assert.equal(p.kind,'expense');assert.equal(p.amount,5000);assert.equal(p.currency,'KZT');assert.equal(p.date,today);
}
const pending={kind:'expense',title:'Пятёрочка',amount:350,date:today,currency:'RUB'};
for(const text of ['5 000','5 тысяч'])assert.equal((await prepareDraft({text,pending,now,fetchImpl:noNetwork})).proposal.amount,5000);
assert.equal((await prepareDraft({text:'Кофе 350.50',now,defaultCurrency:'RUB',fetchImpl:noNetwork})).proposal.amount,350.5);
assert.equal(expenseDefaults({kind:'expense',title:'Первомайский',amount:350.5},{text:'Первомайский 350.50',today,defaultCurrency:'RUB'}).date,today);
assert.equal(expenseDefaults({kind:'expense',title:'Кофе',amount:350},{text:'Кофе 12.09 350',today,defaultCurrency:'RUB'}).date,undefined);
assert.equal((await prepareDraft({text:'Пятёрочка 5000 рублей',now,defaultCurrency:'KZT',fetchImpl:noNetwork})).proposal.currency,'RUB');
assert.deepEqual((await prepareDraft({text:'Запиши идею: подготовить материалы к уроку',now,fetchImpl:noNetwork})).proposal,{kind:'note',title:'подготовить материалы к уроку'});
for(const text of ['Встреча завтра в 15:00','Зарплата 5000','Пятёрочка вчера 5000','Кофе 300 и такси 500','Врач 15:00','Пятёрочка -500','Пятёрочка 5000 юаней','Запланируй покупку 5000'])assert.equal(localDraft(text),null,text);

// Full receiver cancellation at the quota limit, using version-checked RPC.
const uid='00000000-0000-4000-8000-000000000001',secret='a'.repeat(64),hook=await hash(secret);
let calls=[],state={pending,pending_at:new Date().toISOString()},revoked=false;
const env=n=>({SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'fake',TOCHKA_ASSISTANT_OWNER_EMAIL:'owner@test.invalid',TOCHKA_ASSISTANT_BOT_TOKEN:'fake'})[n];
const request=async(url,o={})=>{
 const b=o.body?JSON.parse(o.body):null;calls.push([url,b]);let r;
 if(url.includes('/auth/'))r={id:uid,email:'owner@test.invalid',email_confirmed_at:'2026-01-01'};
 else if(url.endsWith('/getWebhookInfo'))r={ok:true,result:{allowed_updates:['message','callback_query']}};
 else if(url.includes('api.telegram.org'))r={ok:true,result:{message_id:10}};
 else if(url.includes('rpc/tochka_assistant_reserve'))r='limit';
 else if(url.includes('rpc/tochka_assistant_confirm')){assert.equal(b.p_action,'cancel');assert.equal(b.p_version,Date.parse(state.pending_at));r={status:'cancelled'};state.pending=null;}
 else if(url.includes('tochka_assistant_links'))r=[{chat_id:123}];
 else if(url.includes('tochka_assistant_pilot'))r=[{user_id:uid,enabled:!revoked,enabled_at:'2026-01-01T00:00:00Z',hook_hash:hook,...state}];
 else throw new Error('Unexpected endpoint '+url);
 return Response.json(r);
};
const handler=makeHandler(env,request,noNetwork);
const send=()=>handler(new Request('https://local',{method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body:JSON.stringify({update_id:1,message:{date:Math.floor(Date.now()/1000),message_id:1,chat:{id:123,type:'private'},from:{id:123,is_bot:false},text:'Отмена'}})}));
assert.equal((await send()).status,200);assert.equal(state.pending,null);assert.ok(!calls.some(([u])=>u.includes('reserve')));assert.match(calls.find(([u])=>u.endsWith('/sendMessage'))[1].text,/отменён/);
calls=[];revoked=true;await send();assert.ok(!calls.some(([u])=>u.includes('confirm')||u.includes('api.telegram.org')));
console.log('PASS exact purchase and note without AI/key, grouped/decimal amounts, explicit currency/date, ambiguous input fallback, cancellation at quota, disabled owner');
