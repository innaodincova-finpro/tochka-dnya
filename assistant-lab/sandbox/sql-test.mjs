import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table public.tochka_assistant_links(user_id uuid primary key);');
await db.exec("create table public.tochka_assistant_pilot(user_id uuid primary key references tochka_assistant_links(user_id),hook_hash text,enabled boolean,enabled_at timestamptz,pending jsonb,pending_at timestamptz);");
await db.exec(fs.readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
const uid='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
for(const id of [uid,other]){await db.query('insert into tochka_assistant_links values($1)',[id]);await db.query("insert into tochka_assistant_pilot(user_id,hook_hash,enabled,enabled_at) values($1,$2,true,now()-interval '1 hour')",[id,'a'.repeat(64)]);}
const p={kind:'event',title:'Встреча с Мариной',date:'2026-09-13',time:'16:00'};
async function pending(value=p,age=0){return (await db.query("update tochka_assistant_pilot set pending=$2,pending_at=clock_timestamp()-($3::text||' minutes')::interval where user_id=$1 returning pending_at",[uid,JSON.stringify(value),age])).rows[0].pending_at;}
const confirm=async(v,proposal=p,id=uid)=>(await db.query('select tochka_assistant_sandbox_confirm($1,$2,$3) as v',[id,v,JSON.stringify(proposal)])).rows[0].v;
let v=await pending();assert.equal((await confirm(v,p,other)).error,'draft_changed');
assert.equal((await confirm(v,{...p,time:'17:00'})).error,'draft_changed');
assert.equal((await confirm(v)).duplicate,false);assert.equal((await confirm(v)).duplicate,true);
assert.equal((await db.query('select count(*)::int as n from tochka_assistant_sandbox')).rows[0].n,1);
const old=v;v=await pending({...p,time:'17:00'});assert.equal((await confirm(v,p)).error,'draft_changed');assert.equal((await confirm(old)).duplicate,true);
assert.equal((await confirm(v,{...p,time:'17:00'})).saved,true);
v=await pending({kind:'event',title:'Без даты'});assert.equal((await confirm(v,{kind:'event',title:'Без даты'})).error,'incomplete');
v=await pending(p,31);assert.equal((await confirm(v)).error,'draft_expired');
v=await pending();await db.exec('update tochka_assistant_pilot set enabled=false');assert.equal((await confirm(v)).error,'disabled');
for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from tochka_assistant_sandbox'));await assert.rejects(confirm(v));await db.exec('reset role');}
await db.close();console.log('SQL: owner separation, tampering, repeat confirmation, stale version, expiry, incomplete, disabled, RLS passed.');
