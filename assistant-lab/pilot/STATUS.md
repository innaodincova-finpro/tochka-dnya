# Telegram AI pilot — 2026-09-12

Prepared receiver, authenticated control, quota and deduplication schema. Five receiver/control tests and local PGlite quota/deduplication/access/cascade checks passed. Twelve existing proposal/DeepSeek tests passed in preceding step.

Live: schema installed with RLS and no anon/authenticated privileges; owner control deployed with verify_jwt=true. Receiver deployment rejected by automatic approval review pending explicit consent to forwarding incoming Telegram message text to DeepSeek and custom-auth public webhook endpoint. Receiver NOT deployed, webhook NOT registered, zero enabled pilots. Control enable action is blocked unless TOCHKA_ASSISTANT_RECEIVER_READY is true; do not set before approved receiver deployment. No real model request performed, API key not verified.

Next: obtain explicit data-flow consent, deploy reviewed receiver, add authenticated activation UI and validate actual owner flow. Only newly sent pilot messages would go to DeepSeek; application records are never read. Existing pairing continues. Initial limit 20 reserved messages/day (including errors and commands); over-limit updates receive no reply in this initial code. /stop disables without response. Clarification is single-message: owner must resubmit full task. No voice support. These limitations need clear UI text before enabling.

Sources: common.mjs, control.mjs, receiver.mjs, deepseek.mjs and proposal.mjs are deployment bundle sources. Deploy receiver with index.ts importing receiver.mjs and custom Telegram secret auth, control with index.ts importing control.mjs and JWT enabled. No credential values in repository. Delivery state records contain IDs/status only, not message text. Ambiguous sends are not retried automatically.
