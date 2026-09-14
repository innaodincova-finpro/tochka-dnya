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
await pending({kind:'expense',title:'coffee',date:'2026-09-15',amount:350,currency:'RUB',category:'Кафе'},now+1);assert.equal((await call(now+1)).status,'saved');
await pending({kind:'note',title:'idea'},now+2);assert.equal((await call(now+2)).status,'saved');
state=(await db.query('select payload from user_app_data')).rows[0].payload;
const dom=new JSDOM(fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8'),{url:'https://test.invalid/index.html',runScripts:'dangerously',beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};}});
try{
 dom.window.saved=state;dom.window.eval('validateData(saved)');
 assert.equal(state.exp[0].cat,'Кафе');assert.equal(state.exp[0].sum,350);assert.equal(state.exp[0].cur,'RUB');assert.equal(state.notes[0].text,'idea');
 assert.deepEqual(state.settings,payload.settings);assert.deepEqual(state.ev[0],payload.ev[0]);
}finally{dom.window.close();}
await pending({kind:'event',title:'incomplete'},now+3);await assert.rejects(call(now+3));assert.equal((await call(now+2)).status,'already_saved');
assert.equal((await call(now+4)).status,'stale');await assert.rejects(call(now+3,'save',999));assert.equal((await call(now+3,'cancel')).status,'cancelled');
await db.exec('set role authenticated');await assert.rejects(db.query('select tochka_assistant_confirm($1,123,$2,$3,\'save\')',[user,hook,now]));await db.exec('reset role');
await pending({kind:'event',title:'Internet',date:'2026-10-10',time:'09:00',repeat:'month'},now+5);
assert.equal((await call(now+5)).status,'saved');assert.equal((await call(now+5)).status,'already_saved');
state=(await db.query('select payload from user_app_data')).rows[0].payload;assert.equal(state.ev.at(-1).repeat,'month');assert.equal(state.ev.length,3);
await pending({kind:'event',title:'bad',date:'2026-10-10',time:'09:00',repeat:'daily'},now+6);await assert.rejects(call(now+6));
for(const [i,repeat] of ['week','year'].entries()){await pending({kind:'event',title:'repeat',date:'2026-10-10',time:'09:00',repeat},now+10+i);assert.equal((await call(now+10+i)).status,'saved');assert.equal((await call(now+10+i)).status,'already_saved');state=(await db.query('select payload from user_app_data')).rows[0].payload;assert.equal(state.ev.at(-1).repeat,repeat);}
// Undo affects only the inserted record, preserves later records and active draft.
const prior=(await db.query('select payload from user_app_data')).rows[0].payload;
await pending({kind:'note',title:'undo target'},now+20);await call(now+20);
await pending({kind:'note',title:'keep later'},now+21);await call(now+21);
await pending({kind:'note',title:'keep draft'},now+22);
assert.equal((await call(now+20,'undo')).status,'undone');assert.equal((await call(now+20,'undo')).status,'undone');assert.equal((await call(now+20)).status,'undone');
state=(await db.query('select payload from user_app_data')).rows[0].payload;
assert.ok(!state.notes.some(n=>n.text==='undo target'));assert.ok(state.notes.some(n=>n.text==='keep later'));assert.deepEqual(state.ev,prior.ev);assert.deepEqual(state.settings,prior.settings);
assert.equal((await db.query('select pending from tochka_assistant_pilot')).rows[0].pending.title,'keep draft');assert.ok(state.del.some(d=>d.id.endsWith(String(now+20))));
await pending({kind:'expense',title:'unchanged',date:'2026-09-13',amount:10,currency:'RUB'},now+23);await call(now+23);
await db.exec("update user_app_data set payload=jsonb_set(payload,'{exp,1,title}','\"edited\"')");
assert.equal((await call(now+23,'undo')).status,'undo_changed');
await pending({kind:'event',title:'done event',date:'2026-09-13',time:'18:00',repeat:'week'},now+24);await call(now+24);
const rid=(await db.query('select record_id from tochka_assistant_confirmed where version=$1',[now+24])).rows[0].record_id;
await db.query("update user_app_data set payload=jsonb_set(payload,'{day}',$1)",[{'2026-09-13':{done:[rid]}}]);
assert.equal((await call(now+24,'undo')).status,'undo_changed');
await db.query("update tochka_assistant_confirmed set created_at=now()-interval '31 minutes' where version=$1",[now+21]);assert.equal((await call(now+21,'undo')).status,'undo_expired');
await assert.rejects(call(now+23,'undo',999));
await pending({kind:'event',title:'series undo',date:'2026-09-13',time:'18:00',repeat:'month'},now+25);await call(now+25);assert.equal((await call(now+25,'undo')).status,'undone');
console.log('PASS undo scoped removal, tombstone, replay, no resave, active draft/later data retained, edited/completed/expired/wrong-chat blocked, series removal');
console.log('PASS atomic save 3 kinds, snapshot, duplicate, stale, cancel, wrong chat, incomplete, role restriction; existing data preserved');
}finally{await db.close();}
