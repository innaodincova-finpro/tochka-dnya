# Cloudflare voice transcriber

Private POST-only bridge from the existing Supabase Telegram receiver to Cloudflare Workers AI. It accepts at most 4 MiB, keeps audio in memory, calls `@cf/openai/whisper-large-v3-turbo` in Russian transcription mode and never logs audio, secrets or transcripts.

Cloudflare Worker secret: `TRANSCRIBE_SECRET`. Supabase Edge Function secrets: `TOCHKA_ASSISTANT_TRANSCRIBE_URL` and the same `TOCHKA_ASSISTANT_TRANSCRIBE_SECRET`. The secret must be at least 32 random non-whitespace characters. The public Worker URL is safe to store as configuration; authorization is enforced by the shared secret.

Deploy only after setting the Worker secret and AI binding. Then set both Supabase secrets, deploy the updated receiver and verify one fresh owner voice message. Groq is no longer part of this path.
