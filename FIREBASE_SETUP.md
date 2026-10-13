# Firebase setup and migration

The application now targets **vybecheck-6a8b7**. Firebase Auth handles Google, email/password, password resets, and email-link sign-in. Cloud Firestore stores DJ profiles, sessions, requests, notifications, payment records, and payouts. Cloud Storage holds uploaded profile images. Firebase Hosting serves the frontend and routes `/api/**` to the `api` Cloud Function. Paystack remains the payment processor; ACRCloud handles audio recognition and the music catalog supplies text search.

The web configuration is already present in `src/services/firebase.ts` and `.env`. It is public configuration, not an Admin credential. Analytics loads once through `src/services/analytics.ts` and defaults to the supplied Firebase measurement ID **G-BWX9MBN2W3**. Set `VITE_GA_MEASUREMENT_ID=G-DKN2CZSF0T` to use the originally requested Analytics property instead.

## Enable the project services

1. In Firebase Console → Authentication → Sign-in method, enable **Google**, **Email/Password**, and **Email link**. Add the live hostname and `localhost` to Authorized domains. If Google prompts for a support email, select yours.
2. Create the default **Cloud Firestore** database and **Storage** bucket. Deploy the included rules; do not use test-mode rules in production.
3. Enable billing for Cloud Functions/Storage as required by Firebase. The API function is configured in `us-central1`; choose another region consistently in `functions/index.ts` and `firebase.json` before the first deployment if needed.
4. Install the Firebase CLI, sign in to the project, and set server secrets. Never use a `VITE_` prefix for a secret.

```sh
npm install
npm install --prefix functions
npx firebase-tools login
npx firebase-tools functions:secrets:set PAYSTACK_SECRET_KEY --project vybecheck-6a8b7
npx firebase-tools functions:secrets:set ACR_ACCESS_KEY --project vybecheck-6a8b7
npx firebase-tools functions:secrets:set ACR_ACCESS_SECRET --project vybecheck-6a8b7
npm run lint
npm test
npm run build
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage,functions,hosting --project vybecheck-6a8b7
```

`functions` builds automatically before deployment. The API uses managed Firebase Admin credentials on Firebase Functions. Keep the Paystack secret in test mode while validating payments. Configure the Paystack webhook to `https://YOUR_HOST/api/payments/webhook`. The endpoint verifies the signature against the original request bytes. Both checkout confirmation and webhook delivery use the same idempotent Firestore transaction.

These three API function secrets are required at deployment because the app includes both payments and music recognition. To disable a feature, remove its secret binding and leave its server environment variable unset; that feature will return an unavailable error.

## Local development or existing Vercel hosting

Copy the values you need from `.env.example` into `.env`. For local/Vercel Admin access, supply either `GOOGLE_APPLICATION_CREDENTIALS` pointing to a local Firebase service-account JSON file or `FIREBASE_SERVICE_ACCOUNT_JSON` through the host's secret manager. Do not commit the file or paste it into browser code. Firebase Functions does not need a downloaded service-account key.

```sh
npm run dev
```

The Vercel compatibility entrypoint uses the same API as Firebase Functions. Firebase Hosting is the supplied destination for the full migration; `vercel.json` remains usable during cutover.

For isolated testing, start Auth, Firestore and Storage emulators using the CLI. A supported Java runtime is needed for Firestore/Storage emulators. Use the commented emulator environment variables in `.env.example`; restart Vite after changing them. Do not set emulator variables in production.

```sh
npx firebase-tools emulators:start --only auth,firestore,storage --project vybecheck-6a8b7
# In another terminal, with FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST set:
npm test
```

## Transfer existing records

Back up the source database first. Pause writes on the old site during the final export/import and verify the destination before switching live traffic. The importer never deletes source data and does not overwrite existing Firestore documents. Choose the authoritative source explicitly; the old application used both Supabase and SQLite, so inspect **both** before deciding which contains the records you need. Do not blindly combine two copies of the same wallet history.

Dry run (reads the source, makes no Firebase writes):

```sh
npm run migrate:firebase -- --source=sqlite
npm run migrate:firebase -- --source=supabase
```

The Supabase export requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the local server environment. These variables are used only by the importer, never by the running app. An alternate SQLite file can be selected with `--file=/path/to/backup.sqlite`.

After reviewing counts and resolving duplicate emails, handles, or orphaned records, run with Admin credentials:

```sh
npm run migrate:firebase -- --source=sqlite --apply --project=vybecheck-6a8b7
# Or select --source=supabase instead, if that is your authoritative database.
```

Unlinked historical records are preserved in the private `migration_orphans` collection for manual reconciliation rather than being attached to the wrong wallet. Dry runs report these separately. The importer creates Firebase Auth users, maps DJ ownership to Firebase UIDs, creates public profile projections and handle reservations, and imports events, requests, payments, payouts, notifications, queue history, and email logs. Inline profile images and profile links pointing to the configured Supabase Storage origin are copied to Firebase Storage. External music artwork and preset image links remain external references. Other unused files in a source Storage bucket are not automatically copied.

Passwords, password hashes, and legacy magic-link tokens are intentionally excluded. Existing email/password users need to use **Reset password** on the new sign-in form. Import before users start creating new Firebase profiles; if a destination wallet exists outside the migration, the importer stops for reconciliation instead of merging money silently. Reruns skip records already imported from the same source. No live data import is performed by a frontend build or deployment.

## Verify before cutover

- Register a DJ, refresh the page, sign out, and sign back in with Google and email/password.
- Test an email link in the originating browser and in a different browser (the latter asks for the recipient email).
- Create a session, submit a guest request, update its queue status, and confirm another browser receives live updates.
- Upload an avatar and cover. Confirm another DJ cannot read private profiles, notifications, payments, or payouts.
- With Paystack test credentials, confirm one payment and replay its webhook/verification. The wallet must increase once. The browser cannot mark a request paid itself.
- Test payout success/failure webhooks. An uncertain transfer remains `processing` with funds reserved. Reconcile it with Paystack before retrying; do not issue a new transfer reference to resolve an unknown outcome.
- Compare imported source/destination counts, ownership, balances, and sample tracking tokens.

All Firestore browser writes are denied. Validated API routes perform writes with the Admin SDK; public profile documents exclude email and bank details. Private collections are readable only by their owner. Guest queues respect the session's public-queue toggle, while a fan can track an individual request with its tracking token.

References: [Firebase Admin setup](https://firebase.google.com/docs/admin/setup), [Firebase Hosting with Functions](https://firebase.google.com/docs/hosting/functions), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [email-link authentication](https://firebase.google.com/docs/auth/web/email-link-auth).

## Checks in this workspace

The SQLite dry run found three DJ profiles, three sessions, and two orphaned payments with no matching request; the latter will go to `migration_orphans`. The configured Supabase source hostname did not resolve during the export check, so its live contents have not been inspected or transferred. Local Admin credentials were subsequently configured. The audit verified public Firestore reads and denial of unauthenticated private DJ reads. No migration or deployment is performed by these fixes.

Unit tests cover monetary input, immutable profile fields, public/private profile separation, payment binding and replay handling, payout refunds, and reversals. The emulator rules test is included but requires a Java runtime and running emulators; Java was unavailable in this workspace.


## Feature repair deployment checklist

- Deploy the updated frontend and `api` function together. The new `reconcilePayouts` scheduled function verifies processing payouts every ten minutes. Deploying it provisions a Cloud Scheduler job; it does not run inside `npm run dev` or a Vercel deployment. Local/Vercel users can use **Check transfer status** in payout history; configure a trusted scheduled runner for unattended checks on those hosts.
- Set `ACR_ACCESS_KEY` and `ACR_ACCESS_SECRET` in Firebase Secret Manager with the commands above. Local `.env` secrets are not automatically uploaded. For a non-default ACR region, put `ACR_HOST=your-project-identify-host` in `functions/.env.vybecheck-6a8b7` (the default is `identify-eu-west-1.acrcloud.com`).
- Paystack webhooks still belong at `/api/payments/webhook`. **Check transfer status** verifies a saved transfer without sending money. **Recover missing transfer** first verifies it and only retries after an explicit provider 404, using the same reference after a two-minute grace period. Unknown/time-out results keep funds reserved. A record without a saved recipient requires operator investigation; do not manually refund an uncertain transfer.
- Transfers awaiting `otp` show that platform approval is required. The Paystack business owner can run `npm run payout:finalize -- payout-reference` from a trusted local terminal with server/Admin credentials, then enter the received OTP. The script first checks the saved payout and provider state; it does not expose a business-owner authorization endpoint to DJs. No OTP authorization or live transfer was performed while implementing these changes.
- Auto VIP applies to newly settled tips. Turning it off does not demote existing VIP requests. Accepted/up-next requests play before pending requests, and VIP leads within each group. Manual movement is within the accepted request's priority group. Search/genre filters affect display only.
- In GA4's web data stream, disable automatic page views based on browser history changes when using these explicit SPA page views, to avoid duplicates. The application sends screen names, song-request events, successful-login events, and verified purchases; explicit event parameters exclude personal details and tracking tokens. Validate the chosen property's Realtime/DebugView after deployment.

References: [Paystack transfer verification and finalization](https://paystack.com/docs/api/transfer/), [Firebase scheduled functions](https://firebase.google.com/docs/functions/schedule-functions), [GA4 page-view settings](https://developers.google.com/analytics/devguides/collection/ga4/views).
