# Firebase-backed API

The local server, Vercel compatibility entrypoint, and Firebase Function share `server/app.ts`.

Authenticated endpoints require `Authorization: Bearer <Firebase ID token>`. The server verifies expiration, revocation and user ownership. DJ IDs are Firebase UIDs. Do not send passwords to the API: use Firebase Auth in the browser.

| Endpoint | Purpose | Access |
| --- | --- | --- |
| `POST /api/auth/profile` | Create/load profile and initial session | Signed-in user |
| `PUT /api/djs/:id` | Update permitted profile fields | Owner |
| `POST /api/events` | Create session | Signed-in DJ |
| `PATCH /api/events/:id` | Change session controls | Owner |
| `POST /api/requests` | Submit song; paid amount starts at zero | Guest |
| `GET /api/requests/track/:token` | Track one request | Holder of tracking token |
| `PATCH /api/requests/:id/status` | Update queue status and history | Owner |
| `POST /api/requests/reorder` | Reorder `orderedIds` atomically | Owner |
| `PATCH /api/notifications/:id/read` | Mark notification read | Owner |
| `POST /api/payments/initialize` | Create checkout from `requestId`, `amount`, `customerEmail` | Guest |
| `POST /api/payments/verify` | Verify provider payment using `reference`, `requestId` | Guest |
| `POST /api/payments/webhook` | Settle signed charge/transfer events | Paystack HMAC |
| `GET /api/payout/banks` | List Nigerian banks | Public |
| `POST /api/payout/resolve-account` | Resolve account with Paystack | Signed-in user |
| `POST /api/payout/withdraw` | Reserve funds and initiate transfer | Signed-in owner |
| `GET /api/payout/history/:djId` | Read payout history | Owner |
| `GET /api/firebase/status` | Check Firestore connectivity | Public |
| `GET /api/health` | Server liveness | Public |
| `/api/music/search`, `/api/music/trending`, `/api/music/identify` | Existing catalog/audio features | Public |

All monetary amounts use naira at the application boundary; Paystack uses integer kobo. Withdrawal requests include a stable `reference` (`payout-<UUID>`) and bank details. Reuse that reference after a network failure. Processing means provider confirmation is still pending; it is not a successful settlement.

Clients subscribe to Firestore for live reads. See `firestore.rules` and `storage.rules` for access policies. Payment records, tips, and wallet balances are updated together in a server transaction. Legacy demo login, SQL password login and custom OTP endpoints have been removed.
