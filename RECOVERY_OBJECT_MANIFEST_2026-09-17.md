# Манифест recovery-комплекта «Точки дня»

Дата сверки: 17 сентября 2026 года.

Манифест содержит только технические имена и контрольные суммы исходного кода.
Пользовательские данные и значения секретов в него не включены.

## Edge Functions

Хэш каталога вычислен воспроизводимо: для файлов верхнего уровня по алфавиту
формируется список `SHA-256  имя-файла`, затем вычисляется SHA-256 этого списка.

| Функция | Файлов | SHA-256 каталога | Production-версия | `verify_jwt` |
|---|---:|---|---:|---|
| `kalendar` | 1 | `462430c22b28eee25cd341927c0c419024baa6f0299969507386d00b8bfcbd18` | 20 | `false` |
| `kabinet` | 1 | `8ffb1909f5d24f4c327b94a462c67e6b08b001cc05926c0afc6c018a7fb40bd7` | 25 | `false` |
| `push` | 2 | `a79d62a9eaebe8282f7bdf8325f1f506601e0e1b2c2d6e5fd5e7e6b5d780bcec` | 24 | `false` |
| `tochka-assistant-setup` | 2 | `b428c351133c917c7c667cffdd86b106c1930acca3609487f2422735d894262d` | 16 | `true` |
| `tochka-assistant-link` | 2 | `3cfbf77aa394e2c035f7a4dbb11ec18261135b6ca1afa1e8aa711f5eba2f6ad8` | 8 | `true` |
| `tochka-assistant-control` | 3 | `48b6f9bbd2fdc6ad1b5e6a59f956804de638dfe6e5dbaee8545c4adcd7500f66` | 9 | `true` |
| `tochka-assistant-receiver` | 15 | `169e17e45d1d56e694ff9d7c92fc735ab7e93b82fb6126a3f1780e227b007989` | 53 | `false` |
| `tochka-assistant-sandbox` | 4 | `85d03b862c1eb903c3b647f674c9505792891c36315de2661ddf7f06d4742f29` | 6 | `true` |
| `tochka-assistant-calendar` | 4 | `3a5435c71b887e148e5ab84ee31fb24d4caaaae217eb53f61f0db97463300c2b` | 7 | `true` |
| `tochka-telegram-reminders` | 4 | `a7dddd68129b815af61a69c898f37247bf001f1d1c9c874ddb220bb9fb305ab2` | 10 | `false` |

Production-версии и режимы получены при read-only инвентаризации. Хэш каталога
описывает репозиторный исходный код и не обязан совпадать с хэшем собранного
Supabase bundle.

## Подтверждённые production bundle SHA-256

Для пяти восстановленных из read-only production каталогов были получены хэши
собранных bundle:

| Функция | Production bundle SHA-256 |
|---|---|
| `tochka-assistant-control` | `c102ff3dd10598b23b1ff692327ba424e76addb57be4f4b847eb0ceba6d4e830` |
| `tochka-assistant-receiver` | `a50bc382db02875765e97064394349d5a02b30e31ee65d169127fc68aa8aca42` |
| `tochka-assistant-sandbox` | `ea403b69ab8b92b7e24b7afce1bd1d41439403d1ad5241e39049666dc3b18e3f` |
| `tochka-assistant-calendar` | `fc974ef0e74ee0b36dfdb1bf3ece3feefc6762ff472e923a750a2b885746578a` |
| `tochka-telegram-reminders` | `16ef1736a6ac88cf8277c65cd9cb0d819abab4f99d873122c1d4f5b3a2bde5e0` |

Для остальных пяти функций отдельный production bundle hash в этой сверке не
фиксировался. Их соответствие production нельзя считать подтверждённым только
по репозиторному хэшу.

## Переменные окружения без значений

Для развёртывания требуются как минимум:

- `SUPABASE_URL`;
- `SUPABASE_ANON_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `TOCHKA_ASSISTANT_BOT_TOKEN`;
- `TOCHKA_ASSISTANT_DEEPSEEK_API_KEY`;
- `TOCHKA_ASSISTANT_OWNER_EMAIL`;
- `TOCHKA_ASSISTANT_TRANSCRIBE_URL`;
- `TOCHKA_ASSISTANT_TRANSCRIBE_SECRET`.

Значения должны храниться отдельно от Git. Cron дополнительно использует
случайные `cron_token` из закрытых конфигурационных таблиц.

## Что покрывает репозиторий

- 11 локальных migration-файлов как неизменяемая история;
- ordered rebuild manifest из 22 SQL-источников: девять Tochka-only миграций
  включены напрямую, а две mixed-project миграции заменены безопасными
  Tochka-only recovery extracts;
- исходники 10 Edge Functions;
- безопасный шаблон Cron без адреса production-проекта;
- регрессионную проверку состава и порядка.

Последний источник rebuild:

| Migration | SHA-256 | Назначение |
|---|---|---|
| `20260917110000_minimize_tochka_client_grants.sql` | `53ebb1e307338858b5dd51d7571e354c3e813e3ac0a6f7cab4d408d0df206ff8` | минимальные клиентские права после создания всех объектов |

## Что репозиторий не содержит

- production-строки базы;
- Auth-пользователей, identities и сессии;
- бинарные объекты Storage;
- значения секретов;
- полную исходную историю 37 production-миграций;
- доказательство полного восстановления в отдельном Supabase-проекте;
- измеренные фактические RPO и RTO.

Поэтому этот комплект является репозиторной частью восстановления, а не полной
production-резервной копией.

## Mixed-project миграции

`20260915133000_reaffirm_server_only_table_access.sql` и
`20260915140000_optimize_rls_and_foreign_keys.sql` сохранены в
`supabase/migrations` как история, но напрямую в rebuild не включаются. Они
зависят от таблиц Studkab и `public.app_data`, которых нет в чистом
Tochka-only проекте.

Вместо них используются:

- `supabase/recovery/20260915133000_reaffirm_server_only_table_access_tochka_only.sql`;
- `supabase/recovery/20260915140000_optimize_rls_and_foreign_keys_tochka_only.sql`.

В каждом extract зафиксированы исходный путь, commit и SHA-256 исходной
миграции. Регрессионный тест запрещает прямое включение mixed migration,
проверяет отсутствие исполняемых ссылок на Studkab/`public.app_data` и наличие
всех таблиц, к которым обращается extract.
