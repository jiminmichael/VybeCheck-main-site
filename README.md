# VybeCheck

Live DJ song requests, queues, profiles, and Paystack tips.

The app uses React/Vite, Firebase Authentication, Cloud Firestore, Firebase Storage, and an Express API deployable to Firebase Functions. Firebase Hosting configuration is included for project `vybecheck-6a8b7`.

```sh
npm install
npm run dev
```

See [Auth0 social sign-in setup](AUTH0_SETUP.md) to enable Auth0 for Google while keeping Firebase data and sessions.

See [Firebase setup and migration](FIREBASE_SETUP.md) for service enablement, server credentials, deployment, emulator testing, and importing existing data.

```sh
npm run lint
npm test
npm run build
npm run build:functions
```

The old `vybecheck.sqlite` file and `supabase_schema.sql` are retained as migration source/reference only. Neither is used by the running application.
