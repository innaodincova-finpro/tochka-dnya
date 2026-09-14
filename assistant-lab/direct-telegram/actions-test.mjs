import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';
import {JSDOM} from 'jsdom';
import {actionIntent,prepareAction} from './actions.mjs';
const now=new Date('2026-09-13T10:00Z');
assert.deepEqual(actionIntent('Перенеси встречу Врач на завтра в 9:30',now),{action:'move',section:'ev',query:'врач',target:{date:'2026-09-14',time:'09:30'}});
assert.equal(actionIntent('Перенеси встречу Врач на 31.02.2026 в 15:00',now).help,true);
assert.equal(actionIntent('Перенеси на завтра',now),null);
assert.equal(actionIntent('Удали расход Кофе').section,'exp');assert.equal(actionIntent('Заверши задачу Документы').action,'complete');
const uid='00000000-0000-4000-8000-000000000001',hook='a'.repeat(64),event={id:'a',title:'Врач',date:'2026-09-13',time:'12:00',repeat:'none'},note={id:'n',text:'Документы',date:'2026-09-13'};
const original={ev:[event],notes:[note],exp:[{id:'x',title:'Кофе',date:'2026-09-13',sum:300,cur:'RUB'}],inc:[],del:[],day:{'2026-09-13':{done:['a'],other:'keep'}},settings:{cur:'KZT',theme:'dark'}};
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create table tochka_assistant_pilot(user_id uuid primary key,enabled boolean,hook_hash text);
create table tochka_assistant_links(user_id uuid primary key,chat_id bigint);
create table tochka_members(user_id uuid primary key,revoked_at timestamptz);
create table user_app_data(user_id uuid primary key,payload jsonb,updated_at timestamptz);
grant select,update on all tables in schema public to service_role;`);
await db.exec(fs.readFileSync(new URL('./actions.sql',import.meta.url),'utf8'));
await db.query('insert into tochka_assistant_pilot values($1,true,$2)',[uid,hook]);await db.query('insert into tochka_assistant_links values($1,123)',[uid]);await db.query('insert into tochka_members values($1,null)',[uid]);await db.query('insert into user_app_data values($1,$2,now())',[uid,original]);
const get=async()=>(await db.query('select payload from user_app_data')).rows[0].payload;
async function draft(section,action,record,target={}){return (await db.query('insert into tochka_assistant_actions(user_id,section,action,original,target) values($1,$2,$3,$4,$5) returning id',[uid,section,action,record,target])).rows[0].id;}
async function apply(id,cancel=false,chat=123){await db.exec('set role service_role');try{return(await db.query('select tochka_apply_assistant_action($1,$2,$3,$4,$5) r',[uid,chat,hook,id,cancel])).rows[0].r;}finally{await db.exec('reset role');}}
try{
let id=await draft('ev','move',event,{date:'2026-09-14',time:'15:00'});assert.deepEqual(await get(),original);assert.equal(await apply(id),'applied');assert.equal(await apply(id),'applied');
let p=await get();assert.equal(p.ev[0].time,'15:00');assert.deepEqual(p.notes,original.notes);assert.deepEqual(p.settings,original.settings);assert.deepEqual(p.day['2026-09-13'],{done:[],other:'keep'});
id=await draft('ev','delete',event);assert.equal(await apply(id),'changed');assert.equal((await get()).ev.length,1);
id=await draft('notes','complete',note);await assert.rejects(apply(id,false,999));assert.equal(await apply(id),'applied');assert.equal((await get()).notes[0].done,true);
id=await draft('exp','delete',original.exp[0]);assert.equal(await apply(id,true),'cancelled');assert.equal(await apply(id),'cancelled');assert.equal((await get()).exp.length,1);
id=await draft('exp','delete',original.exp[0]);assert.equal(await apply(id),'applied');p=await get();assert.equal(p.exp.length,0);assert.equal(p.del[0].id,'x');assert.ok(p.del[0].at);assert.equal(await apply(id),'applied');assert.equal((await get()).del.length,1);
id=await draft('ev','complete',p.ev[0]);assert.equal(await apply(id),'applied');assert.deepEqual((await get()).day['2026-09-14'].done,['a']);
const dom=new JSDOM(fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8'),{url:'https://test.invalid/index.html',runScripts:'dangerously',beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};}});
try{dom.window.fresh=await get();dom.window.old=original;dom.window.eval('validateData(fresh)');const merged=dom.window.eval('mergeStates(old,fresh)');assert.equal(merged.exp.length,0);assert.equal(merged.ev[0].time,'15:00');assert.equal(merged.notes[0].done,true);}finally{dom.window.close();}
id=await draft('ev','delete',(await get()).ev[0]);await db.query("update tochka_assistant_actions set created_at=now()-interval '16 minutes' where id=$1",[id]);assert.equal(await apply(id),'stale');
await db.exec('set role authenticated');await assert.rejects(db.query('select * from tochka_assistant_actions'));await assert.rejects(db.query('select tochka_apply_assistant_action($1,123,$2,$3,false)',[uid,hook,id]));await db.exec('reset role');
const calls=[];await prepareAction(actionIntent('Удали расход Кофе'),{db:async(path,method,body)=>{calls.push({path,method,body});return path.includes('members')?[{user_id:uid}]:path.includes('user_app_data')?[{payload:original}]:[body];},tg:async(method,body)=>calls.push({method,body})},uid,123,async()=>true);
assert.ok(calls.some(x=>x.path==='tochka_assistant_actions'&&x.body.original.id==='x'));assert.ok(!calls.some(x=>x.method==='PATCH'||x.path?.includes('rpc/')));assert.ok(calls.some(x=>x.body?.reply_markup?.inline_keyboard[0][0].callback_data.startsWith('actyes:')));
console.log('PASS action parsing, preview no mutation, SQL move/complete/delete, preservation, completion reset, duplicates, stale snapshot, cancel, expiration, wrong chat and role');
}finally{await db.close();}
