# AI boundary — 2026-09-12

Telegram pairing and receipt of the explicit test message were confirmed by the owner on her phone. This does not demonstrate AI processing.

Implemented here: provider-independent strict proposal validation, readable Russian previews, explicit missing-field questions, and a system prompt. No network, storage, application records, or Telegram dispatch code is present in this module. Run `node --test assistant-lab/ai/proposal.test.mjs`.

NOT connected: model provider, inference endpoint, continuous Telegram receiver, multi-turn clarification, voice transcription. These tests use synthetic proposals; they do not validate model quality or a real Telegram AI round trip.

Next implementation gate: select the owner's model provider and a separate server-side API credential/budget. Do not reuse the student application's provider or credential implicitly. Then implement an owner-only receiver with authenticated webhook, update deduplication, bounded input/output and daily request limits, revocation checks, fixed model endpoint, strict output validation and a kill switch. Register the webhook only after the receiver and necessary secret are ready. Do not clear pending Telegram updates silently.

Only incoming pilot messages may be submitted to the selected model; no existing meetings, expenses or notes may be fetched. The first pilot replies with drafts only. Real application writes remain excluded.
