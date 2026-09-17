const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const migration = fs.readFileSync('supabase/migrations/20260917110000_minimize_tochka_client_grants.sql', 'utf8');
const guide = fs.readFileSync('supabase/DATABASE_HARDENING.md', 'utf8');

async function denied(action, message) {
  await assert.rejects(action, /permission denied|row-level security policy/i, message);
}

async function main() {
  assert(!/public\.app_data\b/i.test(migration), 'shared app_data is outside the Tochka-only scope');
  assert(!/studkab_/i.test(migration), 'Studkab is outside the Tochka-only scope');
  assert(guide.includes('включён последним'), 'final rebuild order is not documented');
  assert(guide.includes('53ebb1e307338858b5dd51d7571e354c3e813e3ac0a6f7cab4d408d0df206ff8'), 'migration hash is not documented');
  assert(guide.includes('Production-применение') && guide.includes('остаётся заблокированным'), 'production gate is not documented');
  assert(guide.includes('Прямой запуск через `psql -f` не'), 'unsafe direct production execution is not prohibited');
  assert(guide.includes('Leaked Password Protection'), 'deferred Auth setting is not documented');
  assert(guide.includes('Откат'), 'rollback procedure is not documented');

  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create role public_probe;
    create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$select current_setting('request.jwt.claim.sub', true)::uuid$$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;

    create table public.user_app_data(user_id uuid primary key, payload jsonb not null default '{}');
    create table public.tochka_documents(id uuid primary key, user_id uuid not null, title text);
    create table public.tochka_members(user_id uuid primary key, last_seen_at timestamptz, revoked_at timestamptz);
    create table public.app_data(id integer);
    create table public.studkab_requests(id integer);

    alter table public.user_app_data enable row level security;
    alter table public.tochka_documents enable row level security;
    alter table public.tochka_members enable row level security;
    create policy own_app_data on public.user_app_data to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
    create policy own_documents on public.tochka_documents to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
    create policy own_membership on public.tochka_members for select to authenticated
      using (user_id = auth.uid());
    create policy own_last_seen on public.tochka_members for update to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());

    grant all privileges on public.user_app_data, public.tochka_documents, public.tochka_members
      to anon, authenticated, service_role;
    grant select on public.app_data to anon;
    grant insert on public.studkab_requests to authenticated;
    alter default privileges for role postgres in schema public grant select on tables to anon;

    insert into public.user_app_data values
      ('00000000-0000-0000-0000-000000000001','{"owner":1}'),
      ('00000000-0000-0000-0000-000000000002','{"owner":2}');
    insert into public.tochka_documents values
      ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','own'),
      ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','foreign');
    insert into public.tochka_members values
      ('00000000-0000-0000-0000-000000000001',null,null),
      ('00000000-0000-0000-0000-000000000002',null,null);
  `);

  const sentinelBefore = (await db.query(`select
    has_table_privilege('anon','public.app_data','SELECT') app_anon,
    has_table_privilege('authenticated','public.studkab_requests','INSERT') studkab_auth`)).rows[0];

  await db.exec(migration);
  await db.exec(migration);

  await db.exec('set role anon');
  for (const table of ['user_app_data', 'tochka_documents', 'tochka_members']) {
    await denied(() => db.query(`select * from public.${table}`), `anon can read ${table}`);
  }
  await db.exec('reset role');

  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false); set role authenticated;`);
  assert.equal((await db.query('select * from public.user_app_data')).rows.length, 1, 'RLS fixture did not isolate app data');
  assert.equal((await db.query('select * from public.tochka_documents')).rows.length, 1, 'RLS fixture did not isolate documents');
  await db.exec(`
    insert into public.user_app_data values ('00000000-0000-0000-0000-000000000001','{}') on conflict (user_id) do update set payload=excluded.payload;
    update public.user_app_data set payload='{"changed":true}' where user_id=auth.uid();
    insert into public.tochka_documents values ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','new');
    update public.tochka_documents set title='changed' where id='10000000-0000-0000-0000-000000000003';
    delete from public.tochka_documents where id='10000000-0000-0000-0000-000000000003';
    update public.tochka_members set last_seen_at=now() where user_id=auth.uid();
  `);
  await denied(() => db.exec(`update public.tochka_members set revoked_at=now() where user_id=auth.uid()`), 'authenticated can update revoked_at');
  await denied(() => db.exec('truncate public.user_app_data'), 'authenticated can truncate app data');
  await db.exec(`delete from public.user_app_data where user_id=auth.uid(); reset role;`);

  await db.exec('set role public_probe');
  for (const table of ['user_app_data', 'tochka_documents', 'tochka_members']) {
    await denied(() => db.query(`select * from public.${table}`), `PUBLIC can read ${table}`);
  }
  await db.exec('reset role');

  await db.exec('set role service_role');
  await db.exec('truncate public.user_app_data');
  await db.exec('reset role');

  const sentinelAfter = (await db.query(`select
    has_table_privilege('anon','public.app_data','SELECT') app_anon,
    has_table_privilege('authenticated','public.studkab_requests','INSERT') studkab_auth`)).rows[0];
  assert.deepEqual(sentinelAfter, sentinelBefore, 'shared or Studkab grants changed');

  await db.exec('create table public.default_privilege_probe(id integer)');
  assert.equal((await db.query(`select has_table_privilege('anon','public.default_privilege_probe','SELECT') allowed`)).rows[0].allowed, true, 'default privileges changed');

  console.log('PASS: real role operations confirm scoped, minimal and idempotent Tochka grants');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
