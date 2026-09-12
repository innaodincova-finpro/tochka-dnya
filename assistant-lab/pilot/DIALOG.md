# Clarification context

Receiver v3 deployed 2026-09-12. Only the latest incomplete validated proposal is passed as assistant JSON to the next inference, usable for 30 minutes and only in the same enabled session/linked owner. Completed draft clears pending. /cancel or «отмена» clears without inference; /stop clears and disables. No production app record reads/writes. Stored pending content is not immediately deleted at TTL: it becomes ineligible and is overwritten/cleared on later interactions or removed on unlink. RLS enabled, no anon/authenticated column access.

Five synthetic dialog tests pass. Local SQL verifies busy updates return retryable status, duplicate detection and stale update guard. User's real two-message flow remains unverified. Previous single-message examples passed on phone.

Schema change: dialog.sql. Existing quota preserved; one in-flight reservation per owner (90s); pending write requires current_update. A model can still misunderstand a new task versus an amendment; this needs pilot verification. Voice, completed-draft editing and application writes are not implemented.
