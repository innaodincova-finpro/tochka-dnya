import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {makeReminderHandler} from './worker.mjs';
import {reminderCommand} from '../direct-telegram/reminders.mjs';
const db=new PGlite(),uid='00000000-0000-4000-8000-000000000001',chat=123,key='a'.repeat(72);
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table tochka_assistant_pilot(user_id uuid primary key,enabled boolean);
 create table tochka_assistant_links(user_id uuid primary key,chat_id bigint);
 create table tochka_members(user_id uuid primary key,revoked_at timestamptz);
 create table user_app_data(user_id uuid primary key,payload jsonb);
 grant select,update on all tables in schema public to service_role;`);
await db.exec(fs.readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
await db.query('insert into tochka_assistant_pilot values($1,true)',[uid]);await db.query('insert into tochka_assistant_links values($1,$2)',[uid,chat]);await db.query('insert into tochka_members values($1,null)',[uid]);
await db.query('update tochka_telegram_reminder_config set owner_id=$1,enabled=true,cron_token=$2',[uid,key]);
const now=Date.now(),start=new Date(now+4*3600000).toISOString();
const event={id:'event1',title:'Тестовая встреча',date:start.slice(0,10),time:start.slice(11,16),address:'Тестовый адрес',repeat:'none'};
const original={ev:[event],exp:[{id:'old',sum:100}],notes:[{id:'note',text:'keep'}],settings:{cur:'KZT'},day:{},del:[]};
await db.query('insert into user_app_data values($1,$2)',[uid,original]);
let sent=[],outcome='ok',mutateAfterClaim=false;
async function rest(path,method='GET',body){
 const u=new URL('https://db.test/rest/v1/'+path),table=u.pathname.split('/').pop();
 if(table==='tochka_claim_telegram_reminder'){
  await db.exec('set role service_role');let claim;
  try{claim=(await db.query('select tochka_claim_telegram_reminder($1,$2,$3,$4,$5) as token',[body.p_user,body.p_chat,body.p_key,body.p_event,body.p_date])).rows[0].token;}finally{await db.exec('reset role');}
  if(claim&&mutateAfterClaim)await db.query('update user_app_data set payload=$1',[{...original,ev:[]}]);
  return claim;
 }
 assert.ok(['tochka_telegram_reminder_config','tochka_telegram_reminder_deliveries','tochka_assistant_pilot','tochka_assistant_links','tochka_members','user_app_data'].includes(table));
 const params=[],conditions=[];
 for(const [k,v] of u.searchParams){if(k==='select')continue;assert.match(k,/^[a-z_]+$/);if(v==='is.null')conditions.push(k+' is null');else{assert.ok(v.startsWith('eq.'));params.push(v.slice(3));conditions.push(k+'=$'+params.length);}}
 const where=conditions.length?' where '+conditions.join(' and '):'';
 if(method==='GET')return (await db.query('select * from '+table+where,params)).rows;
 assert.equal(method,'PATCH');
 const assignments=Object.entries(body).map(([k,v])=>{assert.match(k,/^[a-z_]+$/);params.push(v);return k+'=$'+params.length;});
 return (await db.query('update '+table+' set '+assignments.join(',')+where+' returning *',params)).rows;
}
const env=n=>({SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'fake',TOCHKA_ASSISTANT_OWNER_EMAIL:'owner@test.invalid',TOCHKA_ASSISTANT_BOT_TOKEN:'fake'})[n];
const request=async(url,o={})=>{
 if(url.endsWith('/getMe'))return Response.json({ok:true,result:{is_bot:true,username:'Inna_Assis_bot'}});
 if(url.includes('/auth/'))return Response.json({id:uid,email:'owner@test.invalid',email_confirmed_at:'2026-01-01'});
 if(url.includes('/rest/v1/')){try{return Response.json(await rest(url.split('/rest/v1/')[1],o.method,o.body&&JSON.parse(o.body)));}catch(e){console.error('Test REST failure:',e.message);throw e;}}
 assert.ok(url.endsWith('/sendMessage'));sent.push(JSON.parse(o.body));
 if(outcome==='timeout')throw new Error('timeout');
 if(outcome==='429')return Response.json({ok:false,error_code:429,parameters:{retry_after:1}},{status:429});
 return Response.json({ok:true,result:{message_id:123}});
};
const handler=makeReminderHandler(env,request);
const run=(k=key)=>handler(new Request('https://worker.test',{method:'POST',headers:{'x-job-key':k}}));
async function reset(){sent=[];outcome='ok';mutateAfterClaim=false;await db.exec('truncate tochka_telegram_reminder_deliveries');await db.query('update user_app_data set payload=$1',[original]);await db.exec('update tochka_telegram_reminder_config set enabled=true; update tochka_assistant_pilot set enabled=true; update tochka_members set revoked_at=null;');}
try{
 assert.equal((await run('b'.repeat(72))).status,401);assert.equal(sent.length,0);
 assert.equal((await run()).status,200);assert.equal(sent.length,1);assert.equal(sent[0].chat_id,chat);assert.match(sent[0].text,/Тестовый адрес/);
 await run();assert.equal(sent.length,1);assert.deepEqual((await db.query('select payload from user_app_data')).rows[0].payload,original);
 await reset();mutateAfterClaim=true;await run();assert.equal(sent.length,0);
 await reset();outcome='timeout';await run();await run();assert.equal(sent.length,1);assert.equal((await db.query('select state from tochka_telegram_reminder_deliveries')).rows[0].state,'unknown');
 await reset();outcome='429';await run();await run();assert.equal(sent.length,1);await db.exec("update tochka_telegram_reminder_deliveries set retry_at=now()-interval '1 second'");outcome='ok';await run();assert.equal(sent.length,2);assert.equal((await db.query('select attempts from tochka_telegram_reminder_deliveries')).rows[0].attempts,2);
 await reset();await db.exec('update tochka_members set revoked_at=now()');await run();assert.equal(sent.length,0);
 await reset();await db.exec('update tochka_assistant_pilot set enabled=false');await run();assert.equal(sent.length,0);
 await reset();await db.query('update user_app_data set payload=$1',[{...original,day:{[event.date]:{done:[event.id]}}}]);await run();assert.equal(sent.length,0);
 await reset();await db.query('update user_app_data set payload=$1',[{...original,ev:Array.from({length:12},(_,i)=>({...event,id:'event'+i}))}]);await run();await run();assert.equal(sent.length,12);
 await reset();const messages=[];const service={db:rest,tg:async(method,b)=>messages.push(b)};
 assert.equal(await reminderCommand('Отключи напоминания',service,uid,chat),true);await run();assert.equal(sent.length,0);
 assert.equal(await reminderCommand('Включи напоминания',service,uid,chat),true);await run();assert.equal(sent.length,1);
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from tochka_telegram_reminder_config'));await assert.rejects(db.query('select * from tochka_telegram_reminder_deliveries'));await assert.rejects(db.query('select tochka_claim_telegram_reminder($1,$2,$3,$4,$5)',[uid,chat,'x',event,event.date]));await db.exec('reset role');
 console.log('PASS worker + real claim SQL: dedupe, delete after claim, timeout no resend, explicit 429 retry, membership/stop, done, 12-event batch, controls, role restrictions, unchanged app data');
}finally{await db.close();}
