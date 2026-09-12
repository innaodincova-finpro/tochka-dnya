# Owner pilot — prepared 2026-09-12

Live URL: https://innaodincova-finpro.github.io/tochka-assistant/pilot/

Uses real user_app_data under current session and existing RLS. Server owner-only calendar endpoint is checked before any initial sync. No change to production main. Local app storage uses a separate KEY; authentication uses the existing SDK session. No automatic service worker registration or manifest installation in this pilot.

Before connect: read current cloud payload, preserve first baseline and latest startup snapshot in browser localStorage, verify readback. Storage failure, denied owner, absent cloud row or changed session stop connection. Original baseline can be downloaded with the visible button. These are device-local backups, not independent server archives. Clearing browser data deletes these copies. Existing per-import backup still runs.

Owner acceptance:
1. Open URL in ordinary browser. Use «Мои данные» to sign in if necessary. Wait for backup confirmation.
2. «Встречи помощника» → choose prepared meeting → «Добавить в мой план».
3. Open ordinary app on second device; confirm title/date/time and change persistence. Verify reminder through existing installed app subscription. Do not install another shortcut or enable another push subscription for this pilot.

Real user backup, live two-device acceptance and reminder delivery remain unverified until owner opens and tests. No final production release claimed.

Build from repository root: python assistant-lab/integration/pilot/build.py (outputs pilot/; place pilot-gate.js in output before deployment). Tests: node assistant-lab/integration/pilot/gate-test.cjs with generated index in same folder, or copy test and gate beside generated output. Source snapshot of published pilot is included here for exact review.

Rollback: return to ordinary /tochka-dnya/ URL. Already confirmed entries remain normal cloud events; returning does not undo data. Preserve baseline and assistantImports ledger. Main stays at ca04694eae174596e6f613f1fd0464f77d6a6dd1.
