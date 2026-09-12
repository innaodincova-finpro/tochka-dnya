# Direct Telegram confirmation

UX: one text -> missing-field question or preview -> Save/Edit/Cancel in Telegram -> confirmed cloud result. No sandbox/calendar/pilot transfers. Supports event, expense (RUB/AZN/KZT, category Other), plain note. Edit button asks for amendments BEFORE saving. Saved records are edited/deleted in ordinary app via Open button. Voice support is described below; multi-item extraction is not implemented. Current dates/time use Europe/Moscow. Pending confirmation expires after 30 minutes; old cards cannot modify a newer proposal.

Telegram official features support callback buttons and editing messages: https://core.telegram.org/bots/features and https://core.telegram.org/bots/api . Design choice: explicit confirmation, show concrete date/time, no database jargon, only say saved after commit. User need not learn commands.

SQL: service_role-only SECURITY INVOKER RPC. Locks pilot, verifies linked chat/current hook/enabled membership, uses existing user_app_data row lock, preserves every unrelated JSON field, stores before_payload and idempotence receipt in same transaction. Backups and receipts are service-only with RLS, no anon/authenticated access. Existing authenticated client CAS retries on updated_at and merges normal records. No AI access to stored app records.

Webhook stays custom-authenticated (JWT false like v4). Owner and linked private-chat checks precede both text and callback handling. On first legitimate text, existing verified webhook secret is retained while allowed_updates expands to callbacks; no pairing/reconfiguration needed. Paid reserve is used for text and voice; callback saves never call AI. Public callback data is only a version, never credentials. Failed/duplicate Telegram presentation cannot duplicate DB save.

Tests: node receiver-test.mjs; node sql-test.mjs (PGlite, synthetic DB). Before publishing apply direct-save.sql and inspect advisors. Deploy all *.mjs and index.ts to existing tochka-assistant-receiver. Keep original v4 as rollback source from prior git history. Reverting receiver disables direct buttons; committed records remain ordinary records. Do not restore all user data automatically.

Live confirmation from owner's next fresh message remains the acceptance step; no unsolicited test message sent. Main app repo main is not modified by this rollout.

## Voice messages

Receiver supports Telegram `message.voice`, up to 60 seconds / 4 MiB.
Uses Groq `whisper-large-v3-turbo`, Russian transcription, then the existing DeepSeek proposal and confirmation path. Server secret required: `TOCHKA_ASSISTANT_GROQ_API_KEY`. No fallback to unrelated project keys. Create a key in https://console.groq.com/keys and add it in Supabase Edge Function Secrets. No key is committed or sent in a chat. Audio is passed in memory, never persisted by this code. Groq receives the audio; DeepSeek receives the transcript. Provider retention is governed by provider settings/policy.

Quota/update reservation and owner verification precede transcription; one voice update uses one existing daily reservation. Duplicate Telegram updates use existing delivery deduplication. Errors leave previous pending proposal unchanged. Speech results are shown verbatim above the proposed record; no save occurs before the user presses Save. Files/photos/video notes are not transcribed. Speech recognition can make mistakes: confirmation is required.

Checks: `node voice-test.mjs`, `node receiver-test.mjs`, `node sql-test.mjs`. Tests use mocked speech responses and synthetic database rows. Actual provider recognition and live Telegram acceptance require the server key and a fresh owner voice message; not yet verified.

Docs: https://console.groq.com/docs/speech-to-text ; https://core.telegram.org/bots/api#getfile ; https://supabase.com/docs/guides/functions/secrets
