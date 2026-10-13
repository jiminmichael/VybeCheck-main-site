# VybeCheck QA fixes

The numbered findings supplied in the request are addressed without changing server-side request/payment validation or Firebase authentication.

| Finding | Implementation |
| --- | --- |
| 1. Live QR | Public QR for the selected session, four-module quiet zone, request-page link fallback, no invented session slug; cancels stale QR generation. |
| 2. Song keyboard controls | Combobox/listbox/options, active-descendant selection, wrapping Arrow Up/Down, Enter selection, Escape dismissal, scrolling active options into view. |
| 3. Form associations | Explicit or wrapping labels across request, tracking, checkout, auth, payout, dashboard, profile, image and QR forms; help/error descriptions reference stable IDs. |
| 4. Zoom | Removed maximum-scale and user-scalable restrictions. |
| 5. Modals | Shared native modal dialog makes background inert, sets initial focus, traps focus, dismisses on Escape and restores focus; nested image picker and projector retain their underlying trigger. |
| 6. Icon names | Descriptive action labels for close, queue moves, rejection, preview, QR, sound, photo, notification and tracking buttons. |
| 7. Song validation | Clears song-specific errors after manual correction, suggestion selection or recognition; invalid submit focuses the song field. |
| 8. Sound | Persists enabled/muted preference, tolerates blocked storage, synchronizes controls in the same app. |
| 9. Audio upload | Real file control routes samples through the same recognition API as microphone recordings; validates audio type/size, shows progress/error and prevents stale results after close. |
| 10. Tracking loading | Loading until initial lookup completes; confirmed 404 differs from connection/backend failure; cancels old-token lookups and prevents overlapping polls. |
| 11. Search states | Loading, successful empty results and failure have separate accessible messages and manual-entry guidance; stale responses cannot overwrite newer queries. |
| 12. Tracking instructions | Full UUID-style code instructions, confirmation/status code display, clipboard copy and native share with link-copy/manual fallbacks. |

## Checks

- `npm run lint`
- `npm test` (36 passing; emulator rule test skipped without running emulators)
- `npm run build` and `npm run build:functions`
- `npm run test:ui`: actual React components rendered with isolated mock store/API services; Chrome at 1440×1000 and 390×844 (mobile touch emulation).

Browser checks cover keyboard suggestions, error correction, empty/failed/racing catalog searches, request confirmation and copying the tracking code, loading/not-found/backend-failure tracking states, all standalone dialogs plus nested image/projector and decline dialogs, microphone denial followed by actual upload API-client execution, decoded session QR contents, sound persistence, accessible names/labels/ARIA rules and horizontal layout overflow. The suite uses selected axe rules relevant to these findings; it is not a complete WCAG audit.

To run browser checks after installing dependencies:

```sh
npx playwright install chromium
npm run test:ui
```

To use an installed Chrome instead, set `QA_CHROME_PATH` to its executable. Tests create and remove a temporary build and never send real requests or payments. Their services are deliberately mocked: live Firebase Auth/Firestore/Storage, Paystack settlement, and ACRCloud recognition accuracy were not verified. Those require a configured test environment and valid credentials. Safari/iOS and Android hardware were not tested.
