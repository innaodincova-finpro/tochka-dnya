-- Isolated pilot metadata. No app records or Auth changes.
create table public.tochka_assistant_links (
 user_id uuid primary key,
 challenge_hash text,
 expires_at timestamptz,
 chat_id bigint unique,
 linked_at timestamptz,
 test_state text not null default 'ready' check (test_state in ('ready','sending','sent','unknown')),
 check (challenge_hash is null or challenge_hash ~ '^[a-f0-9]{64}$')
);
alter table public.tochka_assistant_links enable row level security;
revoke all on public.tochka_assistant_links from public, anon, authenticated;
grant select, insert, update, delete on public.tochka_assistant_links to service_role;
