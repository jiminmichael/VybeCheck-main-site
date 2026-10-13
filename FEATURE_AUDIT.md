# Feature audit

## Repair status — 2026-10-13

All 17 findings below have corresponding local code changes. The original findings are retained as the baseline; their line numbers refer to the pre-fix files. Production deployment and live integration acceptance are separate from these local checks.

| Finding | Implemented change |
| --- | --- |
| 1. Wallet | Zero available balance is displayed as zero; earned totals are separate. |
| 2. Bank details | Bank code is saved, dummy account values removed, and saved account/bank details are verified server-side. |
| 3. Withdrawals | Definitive rejections release reservations; uncertain outcomes remain reserved. Added owner-authorized verification, same-reference recovery after provider 404, scheduled verification, and an operator-only OTP CLI. |
| 4. Checkout | Saved checkout retains its amount, resumed checkout explains the fixed amount, and receipts display the amount verified by the server. Invalid cached checkout links are rejected. |
| 5. Auto VIP | Settlement honors the current event setting and preserves existing VIP status. |
| 6. Queue | Shared order for dashboard, live screen, Play Next, and movement controls. Filters do not change playback; accepted requests precede pending requests, VIP first within each group. |
| 7. DJ links | Unresolved explicit handles/slugs produce an unavailable state rather than another DJ's form; handle resolution reruns as data arrives. |
| 8. Tracking | Local persistence and shareable tracking routes restore the request; no automatic selection of another visitor's request. Tracked results are cached separately from public snapshots. |
| 9. Rejections | Reason is validated, stored on the request and history, and shown to the customer. |
| 10. Payout history | Profile and open withdrawal receipt subscribe to current payout data; history provides status checks and recovery. |
| 11. Routing | Auth readiness gates protected routes; navigation updates the hash and supports reload/back. |
| 12. Audio parsing | Validates codec-bearing audio data URLs and preserves format/filename. |
| 13. Audio examples | Explicitly labeled catalog examples; no invented confidence or audio-identification metadata. |
| 14. Recognition deployment | Functions binds ACRCloud secrets, `.env.example` and deployment instructions updated. Cloud secret provisioning/deployment remains required. |
| 15. UI controls | QR Studio is reachable and saves themes; public-queue and tips switches are visible. Guest tipping honors the switch. Private DJ queries include the owner constraint. |
| 16. Discovery | Service and endpoint renamed to suggested tracks, removing the unsupported trending claim. |
| 17. Analytics | Central configurable tag initialization, explicit screen views, request/login events, and verified purchase events. Current Firebase property remains the default, with an override for the originally requested property. GA4 history-based auto-pageview settings must be checked after deployment. |

Validation: TypeScript checks, frontend/server builds, and Functions build pass. Tests: 26 passed, 1 emulator test skipped, 0 failures. Local HTTP smoke checks returned 200 for health, 400 for malformed audio, and 401 for unauthenticated payout reconciliation/recovery. No real charges, withdrawals, OTP approvals, or production writes were performed. The emulator rules test remains skipped in this environment. Full browser/social-login, microphone, payment-provider, and deployed-service acceptance still requires live testing.

See [deployment and operator instructions](FIREBASE_SETUP.md#feature-repair-deployment-checklist). The frontend still emits Vite's existing large-chunk warning; build output is successful.

## Original audit

Date: 2026-10-13. Scope: frontend feature wiring, store behavior, server routes, Firebase rules/configuration, builds, existing tests, and read-only public Firestore probes. No real charges, withdrawals, or production data changes were performed. Findings below are code-confirmed unless marked as needing live verification.

## Highest priority

1. **Wallet shows an incorrect available balance when the balance is zero.** `src/components/DJDashboard.tsx:244` uses `availableBalance || totalTipsNaira`. After withdrawing all funds, the dashboard can show historical event tips as available cash. The backend still checks the actual balance. Use a nullish fallback and keep earned totals separate from spendable funds.

2. **Saved bank details lose the bank code.** The bank selector updates `bankCode`, but `handleSaveProfile` omits it (`src/components/DJProfileView.tsx:181`). Reloading uses the old code or defaults to `058` (`:138`), even when another bank name/account was saved. Save and validate the bank code together with the account details. Remove the dummy account-number fallback at `:139`.

3. **A withdrawal can remain processing and block further withdrawals indefinitely.** `server/firebaseRoutes.ts:329` marks a transfer as attempted before calling the provider. Every subsequent exception, including a definitive provider rejection, retains the reserved funds and pending marker (`:334`). Existing-reference retries only return the saved record (`:310`). No transfer reconciliation job or verification route was found. Preserve reservations for uncertain outcomes, but reconcile with the provider and handle definitive failures and any required transfer authorization.

4. **Resumed checkout can display a different amount from the checkout being paid.** `src/components/PaystackCheckoutModal.tsx:27` caches checkout by request ID without its amount. Close an unpaid checkout, choose a different tip for the same request, and the old payment URL can be reused while the success screen displays the new `tipAmount` (`:99`). `src/services/store.ts:289` ignores the supplied amount. Server settlement validates against the original saved payment, so this is a misleading checkout/receipt issue, not evidence of arbitrary wallet credit. Persist checkout amount and show the verified amount.

## Queue and customer workflows

5. **Auto VIP OFF has no effect on payment settlement.** The dashboard saves `autoPriority` (`src/components/DJDashboard.tsx:76`; `server/firebaseRoutes.ts:104`), but successful payments always set `priority: true` (`server/firebaseRoutes.ts:236`). Apply the event setting during settlement and define how already-prioritized requests should behave.

6. **Queue ordering is inconsistent across screens and controls.** `src/services/store.ts:257` sorts active requests VIP-first; `src/components/DJDashboard.tsx:142` leaves pending requests unsorted and sorts up-next requests only by queue position. Play Next chooses from search/genre/VIP-filtered lists (`:117`), so a display filter changes the next song selected. Move Up/Down operates on the store's combined pending/up-next list (`src/services/store.ts:278`), not the visible up-next list. Use one explicit playback order and separate presentation filters from playback actions.

7. **Invalid DJ links silently retain or select another event.** `src/services/store.ts:119` falls back to the current/first event when a requested slug cannot be resolved. A mistyped QR URL can therefore show another DJ's request form. Explicitly show an unknown/unavailable DJ state for unresolved nonempty slugs, after data loading finishes.

8. **Customer tracking is not reliably restored.** The active token exists only in React state (`src/App.tsx:24`). Without a token, `src/components/CustomerTrackingScreen.tsx:45` automatically selects the first public request, which need not belong to the visitor. Persist the visitor's tracking reference and show an entry/empty state rather than guessing.

9. **Rejection reasons are discarded.** The dashboard collects and passes a reason (`src/components/DJDashboard.tsx:124`), but `src/services/store.ts:276` ignores it. Carry the reason through the server, history record, and customer status display.

10. **Payout history does not follow live updates.** `src/components/DJProfileView.tsx:112` subscribes to profile/auth changes but loads payouts only once and after the withdrawal callback. The store's payout listener replaces its array (`src/services/store.ts:102`), without updating the component's `payouts` state. Initial history can be empty until remount, and processing statuses can remain stale after a webhook. Refresh payout state on store notifications or subscribe directly to it.

11. **Navigation and restored authentication can disagree.** `src/App.tsx:57` resolves dashboard/profile hashes on mount before async auth restoration and does not rerun that resolution when authentication becomes ready. A signed-in visitor can be sent to the login modal on reload. Most internal navigation changes React state without updating the URL (`:130`), so reload/back behavior does not reliably restore the displayed view. Resolve protected routes after auth readiness and use a consistent routing source.

## Audio, analytics, and incomplete UI

12. **Audio data URLs containing codec parameters are decoded incorrectly.** The recorder preserves `mediaRecorder.mimeType` (`src/components/AudioRecognizerModal.tsx:98`). The server's stripping regex only accepts `data:audio/<word>;base64,` (`server/app.ts:153`), leaving headers such as `data:audio/webm;codecs=opus;base64,` in the decoded input. A local fixture produced 15 bytes instead of the expected 3. Parse the data URL robustly, validate it, and preserve the actual media format rather than always naming it `sample.webm`.

13. **Quick Audio Samples are simulations.** `src/components/AudioRecognizerModal.tsx:165` performs a text search and returns a fixed 96% confidence plus acoustic-match wording without analyzing audio. Label these as song examples/demo results, or provide actual sample audio to the recognition endpoint.

14. **Firebase Functions configuration does not bind the current recognition secrets.** `functions/index.ts:8` binds `PAYSTACK_SECRET_KEY` and `GEMINI_API_KEY`, while the recognition route needs `ACR_ACCESS_KEY` and `ACR_ACCESS_SECRET` (`server/app.ts:143`). Local ACR variables are present, but the deployed environment was not inspected. Provision and bind the required ACR credentials before relying on recognition in Firebase-hosted production.

15. **Some implemented controls have no reachable UI.** The personal QR customization modal is gated by state that is never set to true (`src/App.tsx:26`, `:240`). Separate profile QR features do exist. Public-queue and tips toggle handlers are defined but unused (`src/components/DJDashboard.tsx:83`, `:90`). Wire these controls into the intended interface or remove unfinished paths.

16. **“Trending” is a discovery approximation.** `server/app.ts:110` searches a randomly selected preset artist/query; `src/services/musicService.ts:79` also has fallback tracks. This does not establish current popularity. Label it as suggested music or connect a real trending source.

17. **Analytics does not explicitly cover in-app screens or conversions.** `index.html:4` loads Google Analytics, but no screen-view, request, or payment event instrumentation was found in `src`. State-only navigation cannot be assumed to generate distinct page views. The configured property is `G-BWX9MBN2W3`, whereas the originally requested tag was `G-DKN2CZSF0T`; confirm which reporting property is intended before changing it.

## Verification and limits

- `npm run lint`: passed (TypeScript checking).
- `npm test`: 16 passed, 1 emulator-dependent test skipped, 0 failures.
- `npm run build` and `npm run build:functions`: passed. Vite reports a large frontend chunk (about 1.14 MB before gzip); consider route/component splitting for mobile startup performance.
- Read-only unauthenticated Firestore queries: `events` and `public_djs` returned HTTP 200; private `djs` returned HTTP 403. These probes confirm those specific access paths, not every rules condition or authenticated request query.
- Audio data-URL decoding failure reproduced locally with a synthetic payload.
- Browser end-to-end checks remain necessary for social login/session restoration, private queue subscriptions, uploads, microphone permissions, QR scanning, and multi-device live updates.
- Payment settlement, real transfers, webhook delivery, production Functions secrets, and deployed Storage permissions were not exercised end to end. Passing unit tests do not establish these live integrations work.
- Application source was not changed during this audit; this report and generated build outputs were produced.

Suggested repair order: wallet/bank/checkout correctness; payout reconciliation; event resolution and customer tracking; shared queue ordering and Auto VIP; live payout updates; audio and deployment configuration; routing, unfinished controls, and analytics.
