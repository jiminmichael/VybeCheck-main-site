# Hosting

Firebase Hosting + Functions is now the primary deployment path. Follow [Firebase setup](FIREBASE_SETUP.md).

For an existing Vercel deployment during cutover, `api/index.ts` exports the same Firebase-backed Express app. Set `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `PAYSTACK_SECRET_KEY` and `GEMINI_API_KEY` in Vercel's server environment. Never expose Admin/Paystack credentials with a `VITE_` prefix. Add the Vercel/custom hostname to Firebase Authentication's Authorized domains and deploy the Firestore and Storage rules separately.

The frontend Firebase web configuration is bundled from `src/services/firebase.ts`, with optional `VITE_FIREBASE_*` overrides. Supabase and SQLite are no longer runtime dependencies.
