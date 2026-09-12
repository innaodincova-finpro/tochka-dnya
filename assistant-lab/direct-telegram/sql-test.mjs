import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs';import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create table public.tochka_assistant_pilot(user_id uuid primary key,enabled boolean,hook_hash text,enabled_at timestamptz,pending jsonb,pending_at timestamptz);
create table public.tochka_assistant_links(user_id uuid primary key,chat_id bigint);
create table public.tochka_members(user_id uuid primary key,revoked_at timestamptz);
create table public.user_app_data(user_id uuid primary key,payload jsonb,updated_at timestamptz);
grant select,update on all tables in schema public to service_role;`);
await db.exec(fs.readFileSync(new URL('./direct-save.sql',import.meta.url),'utf8'));
const user='00000000-0000-4000-8000-000000000001',hook='a'.repeat(64),now=Date.now(),payload={ev:[{id:'old',title:'existing',date:'2026-09-01'}],exp:[],inc:[],notes:[],settings:{theme:'dark',reminderMode:'three-and-hour'},del:[],day:{},savedAt:'old'};
await db.query('insert into tochka_assistant_pilot values($1,true,$2,$3,null,null)',[user,hook,new Date(now-1000).toISOString()]);await db.query('insert into tochka_assistant_links values($1,123)',[user]);await db.query('insert into tochka_members values($1,null)',[user]);await db.query('insert into user_app_data values($1,$2,now())',[user,payload]);
async function pending(p,version){await db.query('update tochka_assistant_pilot set pending=$1,pending_at=$2 where user_id=$3',[p,new Date(version).toISOString(),user]);}
const call=async(version,action='save',chat=123)=>{await db.exec('set role service_role');try{return(await db.query('select tochka_assistant_confirm($1,$2,$3,$4,$5) r',[user,chat,hook,version,action])).rows[0].r;}finally{await db.exec('reset role');}};
try{
await pending({kind:'event',title:'test',date:'2026-09-15',time:'18:30'},now);
assert.equal((await call(now)).status,'saved');assert.equal((await call(now)).status,'already_saved');
let state=(await db.query('select payload from user_app_data')).rows[0].payload;assert.equal(state.ev.length,2);assert.deepEqual(state.settings,payload.settings);assert.deepEqual(state.ev[0],payload.ev[0]);
assert.deepEqual((await db.query('select before_payload from tochka_assistant_confirmed')).rows[0].before_payload,payload);
await pending({kind:'expense',title:'coffee',date:'2026-09-15',amount:350,currency:'RUB'},now+1);assert.equal((await call(now+1)).status,'saved');
await pending({kind:'note',title:'idea'},now+2);assert.equal((await call(now+2)).status,'saved');
state=(await db.query('select payload from user_app_data')).rows[0].payload;
const dom=new JSDOM(fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8'),{url:'https://test.invalid/index.html',runScripts:'dangerously',beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};}});
try{
 dom.window.saved=state;dom.window.eval('validateData(saved)');
 assert.equal(state.exp[0].sum,350);assert.equal(state.exp[0].cur,'RUB');assert.equal(state.notes[0].text,'idea');
 assert.deepEqual(state.settings,payload.settings);assert.deepEqual(state.ev[0],payload.ev[0]);
}finally{dom.window.close();}
await pending({kind:'event',title:'incomplete'},now+3);await assert.rejects(call(now+3));assert.equal((await call(now+2)).status,'already_saved');
assert.equal((await call(now+4)).status,'stale');await assert.rejects(call(now+3,'save',999));assert.equal((await call(now+3,'cancel')).status,'cancelled');
await db.exec('set role authenticated');await assert.rejects(db.query('select tochka_assistant_confirm($1,123,$2,$3,\'save\')',[user,hook,now]));await db.exec('reset role');
console.log('PASS atomic save 3 kinds, snapshot, duplicate, stale, cancel, wrong chat, incomplete, role restriction; existing data preserved');
}finally{await db.close();}
