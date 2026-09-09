const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
(async()=>{
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,invited_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create table public.user_app_data(user_id uuid primary key references auth.users(id),payload jsonb not null default '{}',updated_at timestamptz default now());
alter table public.user_app_data enable row level security;
grant all on public.user_app_data to authenticated;
create policy own on public.user_app_data to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create table public.push_subscriptions(user_id uuid references auth.users(id));
create table public.app_data(user_id uuid references auth.users(id),app text,data jsonb);
create function public.delete_pending_invitation(p_user_id uuid,p_email text) returns boolean language sql as $$select true$$;
insert into auth.users values(gen_random_uuid(),'inna_odincova@mail.ru',now(),null);`);
await db.exec(fs.readFileSync(__dirname+'/supabase/migrations/20260909170917_tochka_app_scoped_access.sql','utf8'));
await db.exec(fs.readFileSync(__dirname+'/access-test.sql','utf8'));
await db.exec(`insert into auth.users(id,email) values ('11111111-1111-4111-8111-111111111111','rls@example.invalid');
set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);`);
let denied=false;try{await db.exec("insert into public.user_app_data(user_id) values(auth.uid())");}catch(e){denied=e.code==='42501'}
if(!denied)throw Error('RLS allowed nonmember');
try{await db.exec("insert into public.tochka_members(user_id) values(auth.uid())");throw Error('Self-grant allowed');}catch(e){if(e.code!=='42501')throw e;}
console.log('PASS: owner-only access, self protection, app-only visits, deletion, other-app preservation, revoked-write denial, reinvitation, RLS, no self-grant');
await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
