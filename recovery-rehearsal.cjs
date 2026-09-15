const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const USER_1 = '11111111-1111-4111-8111-111111111111';
const USER_2 = '22222222-2222-4222-8222-222222222222';

const schema = `
create schema auth;
create schema storage;
create table auth.users (id uuid primary key, email text not null unique);
create table public.user_app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.tochka_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  invited_at timestamptz, last_seen_at timestamptz, revoked_at timestamptz
);
create table public.push_subscriptions (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique, subscription jsonb not null, timezone text not null,
  enabled boolean not null default true, created_at timestamptz not null default now()
);
create index push_subscriptions_owner on public.push_subscriptions(user_id);
create table public.tochka_documents (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, original_name text not null, object_path text not null unique,
  mime_type text not null, size_bytes bigint not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index tochka_documents_user_created_idx
  on public.tochka_documents(user_id, created_at desc) where deleted_at is null;
create table storage.objects (
  id uuid primary key, bucket_id text not null, name text not null unique,
  owner_id uuid references auth.users(id) on delete cascade, metadata jsonb
);
`;

const fixtures = `
insert into auth.users(id,email) values
  ('${USER_1}','recovery-one@example.test'),('${USER_2}','recovery-two@example.test');
insert into public.tochka_members(user_id,invited_at,last_seen_at) values
  ('${USER_1}','2026-09-01T10:00:00Z','2026-09-15T13:00:00Z'),
  ('${USER_2}','2026-09-02T10:00:00Z','2026-09-15T13:05:00Z');
insert into public.user_app_data(user_id,payload,updated_at) values
  ('${USER_1}', '{"notes":[{"id":"n1","text":"Проверка восстановления"}],"money":[{"id":"m1","sum":1250}]}', '2026-09-15T13:00:00Z'),
  ('${USER_2}', '{"events":[{"id":"e1","title":"Контрольная встреча","date":"2026-09-16"}]}', '2026-09-15T13:05:00Z');
insert into public.push_subscriptions(id,user_id,endpoint,subscription,timezone) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${USER_1}','https://push.example.test/one','{"keys":{"p256dh":"test","auth":"test"}}','Europe/Moscow');
insert into public.tochka_documents(id,user_id,title,original_name,object_path,mime_type,size_bytes,created_at,updated_at) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${USER_1}','Контрольный документ','control.pdf','${USER_1}/control.pdf','application/pdf',1024,'2026-09-15T13:00:00Z','2026-09-15T13:00:00Z');
insert into storage.objects(id,bucket_id,name,owner_id,metadata) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','tochka-documents','${USER_1}/control.pdf','${USER_1}','{"size":1024,"mimetype":"application/pdf"}');
`;

async function snapshot(db) {
  const tables = ['auth.users','public.user_app_data','public.tochka_members',
    'public.push_subscriptions','public.tochka_documents','storage.objects'];
  const result = {};
  for (const table of tables) {
    const rows = await db.query(`select to_jsonb(t)::text as value from ${table} t order by to_jsonb(t)::text`);
    result[table] = {
      rows: rows.rows.length,
      sha256: crypto.createHash('sha256').update(rows.rows.map(r => r.value).join('\n')).digest('hex')
    };
  }
  return result;
}

(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const source = new PGlite();
  await source.exec(schema);
  await source.exec(fixtures);
  const before = await snapshot(source);
  const backup = await source.dumpDataDir('gzip');

  await source.exec('delete from auth.users');
  assert.equal((await source.query('select count(*)::int as n from public.user_app_data')).rows[0].n, 0);
  await source.close();

  const restored = new PGlite({ loadDataDir: backup });
  const after = await snapshot(restored);
  assert.deepEqual(after, before, 'restored rows or checksums differ from backup source');
  assert.equal((await restored.query(
    "select payload->'notes'->0->>'text' as text from public.user_app_data where user_id=$1",
    [USER_1]
  )).rows[0].text, 'Проверка восстановления');
  assert.equal((await restored.query(
    "select count(*)::int as n from pg_indexes where schemaname='public' and indexname in ('push_subscriptions_owner','tochka_documents_user_created_idx')"
  )).rows[0].n, 2);
  await restored.close();
  console.log('PASS: isolated PostgreSQL backup restored; 6 tables, rows, JSON payloads, relations and indexes retained');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
