-- Полное восстановление схемы «Точки дня» в НОВОМ пустом проекте Supabase.
-- Запускать psql из корня репозитория: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/rebuild.sql
-- Файл не содержит пользовательских данных и секретов.
\set ON_ERROR_STOP on

-- Основное облачное хранилище и защита протокола.
\ir DATABASE_SETUP.sql
\ir DATABASE_SYNC_GUARD.sql

-- Push, приглашения и доступ к приложению.
\ir migrations/20260907110737_direct_push.sql
\ir migrations/20260909163029_atomic_pending_invitation_delete.sql
\ir migrations/20260909170917_tochka_app_scoped_access.sql

-- Telegram: привязка, лимит, диалог, подтверждение и откат записей.
\ir ../assistant-lab/link-schema.sql
\ir ../assistant-lab/pilot/pilot.sql
\ir ../assistant-lab/pilot/dialog.sql
\ir ../assistant-lab/direct-telegram/actions.sql
\ir ../assistant-lab/direct-telegram/direct-save.sql

-- Изолированный предпросмотр и календарная запись.
\ir ../assistant-lab/sandbox/schema.sql
\ir ../assistant-lab/calendar/schema.sql

-- Telegram-напоминания и расписание.
\ir ../assistant-lab/reminders/schema.sql
\ir ../assistant-lab/reminders/cron.sql

-- Документы и исправления доступа/отвязки из аудита.
\ir migrations/20260913150000_documents_storage_v1.sql
\ir migrations/20260915090000_audit_stage_5_access_and_unlink.sql
