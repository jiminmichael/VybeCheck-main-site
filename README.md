# VybeCheck

Live DJ song requests, queues, profiles, and Paystack tips.

The app uses React/Vite, Firebase Authentication, Cloud Firestore, Firebase Storage, and an Express API deployable to Firebase Functions. Firebase Hosting configuration is included for project `vybecheck-6a8b7`.

```sh
npm install
npm run dev
```

See [Firebase setup and migration](FIREBASE_SETUP.md) for service enablement, server credentials, deployment, emulator testing, and importing existing data.

```sh
npm run lint
npm test
npm run build
npm run build:functions
```

The old `vybecheck.sqlite` file and `supabase_schema.sql` are retained as migration source/reference only. Neither is used by the running application.

UI and accessibility regression checks are documented in [QA fixes and validation](QA_FIXES.md). Run `npm run test:ui` after installing the Playwright browser; the suite uses mock services and does not make live payments.
