# DeepSeek pilot connection

Owner selected DeepSeek on 2026-09-12. Server adapter: deepseek.mjs, fixed https://api.deepseek.com/chat/completions, deepseek-flash, thinking disabled, JSON output, 1200 output token cap, 1500 input characters, 25 second timeout, bounded 32KB response, no automatic retry. Date context defaults to Europe/Moscow; caller must use the owner's configured timezone when available. No secrets or user records in this repository.

Secret to provision in Supabase project dcpthwmuiodrjepifzsd → Edge Functions → Secrets:

TOCHKA_ASSISTANT_DEEPSEEK_API_KEY

Value: owner's DeepSeek API key. Do not send it in chat, commit it, put it in HTML, or reuse another application's credential implicitly.

Validation: node --test assistant-lab/ai/*.test.mjs (12 tests, synthetic responses). No live inference has been performed. No Telegram AI receiver has been deployed. Existing pairing remains operational; saving this secret alone will not activate AI replies.

Remaining: implement owner-only Telegram receiver, reserve request quota atomically (initial pilot cap 20/day), deduplicate Telegram updates, verify linked owner still active before inference and sending, and add explicit enable/disable control. Activate only after credential is set and authenticated live check succeeds. Initial replies are drafts only; no application record reads/writes. Voice and multi-turn clarification remain future work.

Official reference checked 2026-09-12:
- https://api-docs.deepseek.com/
- https://api-docs.deepseek.com/guides/json_mode/
- https://api-docs.deepseek.com/api/create-chat-completion/
