# Закрытые серверные таблицы Supabase

Проверено 15 сентября 2026 года в рабочем проекте `dcpthwmuiodrjepifzsd`.

## Решение

Для перечисленных ниже таблиц отсутствие RLS-политик является намеренным. Они
не являются пользовательским API: роли `anon` и `authenticated` не имеют на
них ни одного табличного права. RLS оставлена включённой как второй защитный
слой. Публичные REST-запросы ко всем 30 таблицам дополнительно проверены и
получили отказ HTTP 401.

## «Точка дня»: уведомления — 3

- `push_configuration`
- `push_deliveries`
- `push_subscriptions`

## «Точка дня»: помощник и Telegram — 8

- `tochka_assistant_actions`
- `tochka_assistant_confirmed`
- `tochka_assistant_deliveries`
- `tochka_assistant_links`
- `tochka_assistant_pilot`
- `tochka_assistant_sandbox`
- `tochka_telegram_reminder_config`
- `tochka_telegram_reminder_deliveries`

## «Кабинет студента»: заявки и результаты — 11

- `studkab_request_config`
- `studkab_requests`
- `studkab_requirement_passports`
- `studkab_result_reviews`
- `studkab_result_versions`
- `studkab_results`
- `studkab_telegram_setup`
- `studkab_push_configuration`
- `studkab_push_deliveries`
- `studkab_push_subscriptions`
- `studkab_gen_policy`

## «Кабинет студента»: серверная генерация — 8

- `studkab_gen_attempts`
- `studkab_gen_budget`
- `studkab_gen_jobs`
- `studkab_gen_limits`
- `studkab_gen_parts`
- `studkab_gen_pricing`
- `studkab_gen_reconciliations`
- `studkab_gen_recoveries`

Последние три таблицы используются внутренними функциями обслуживания базы,
доступными только владельцу БД `postgres`; отсутствие прямых прав
`service_role` для них также намеренно.

## Контроль

Миграция `20260915133000_reaffirm_server_only_table_access.sql` повторно
отзывает все права на эти таблицы у `public`, `anon` и `authenticated`. При
добавлении новой серверной таблицы требуется одновременно:

1. включить RLS;
2. отозвать права браузерных ролей;
3. выдать серверу только необходимые операции;
4. добавить проверку в `server-table-access-regression.cjs`.

Информационное сообщение Supabase `RLS Enabled No Policy` для этих таблиц
принимается осознанно: добавлять фиктивные разрешающие политики ради исчезновения
сообщения запрещено.
