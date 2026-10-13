# Auth0 Google sign-in with Firebase data

Google can use Auth0 Universal Login. Email/password, email links, GitHub, and Apple retain their existing Firebase login. Google also keeps its existing Firebase flow unless `VITE_SOCIAL_AUTH_PROVIDER=auth0` is set.

The browser obtains an Auth0 API access token through the Auth0 SPA SDK (authorization code with PKCE). `/api/auth/auth0/exchange` verifies its RS256 signature, issuer, audience, expiry, and Google subject. It fetches the profile from Auth0 and requires a matching subject and verified email, then issues a Firebase custom token. The browser signs into Firebase with this token and uses the existing profile API, Firestore listeners, Storage rules, and Firebase session persistence.

## Auth0 dashboard

1. Create a **Single Page Application**. Copy its Domain (hostname only) and Client ID.
2. Set Allowed Callback URLs, Allowed Logout URLs, Allowed Web Origins, and Allowed Origins (CORS) to `https://vybe-check-main-site.vercel.app` and your local origin (normally `http://localhost:3000`).
3. Enable the **google-oauth2** social connection for this application. Configure your own production Google OAuth credentials; do not use Auth0 development keys in production. Copy the Google callback URL shown by Auth0 into the Google OAuth client's authorized redirect URIs.
4. Create an Auth0 **API**, using an identifier such as `https://vybecheck-api` and **RS256** signing. The identifier is the audience; it need not be a deployed URL. Keep access tokens signed JWTs rather than encrypted tokens. Do not use the Auth0 Management API audience.

## Vercel Production variables

```dotenv
VITE_SOCIAL_AUTH_PROVIDER=auth0
VITE_AUTH0_DOMAIN=YOUR_TENANT.auth0.com
VITE_AUTH0_CLIENT_ID=YOUR_SPA_CLIENT_ID
VITE_AUTH0_AUDIENCE=https://vybecheck-api
AUTH0_DOMAIN=YOUR_TENANT.auth0.com
AUTH0_AUDIENCE=https://vybecheck-api
FIREBASE_PROJECT_ID=vybecheck-6a8b7
```

Set `FIREBASE_SERVICE_ACCOUNT_JSON` separately to the complete active service-account JSON in Vercel's secret environment settings. The bridge uses Admin Auth to find/create users and sign custom tokens; profile writes also need Admin Firestore access. Auth0 does not fix invalid Firebase Admin credentials. No Auth0 client secret is required by this SPA integration. Redeploy after setting all variables because `VITE_` values are included at build time. Keep private credentials out of `VITE_` variables.

For localhost, use the same Auth0 variables in `.env`, or keep `VITE_SOCIAL_AUTH_PROVIDER=firebase` to retain the original local Google flow. Local Admin credentials can use `GOOGLE_APPLICATION_CREDENTIALS` pointing to a file on your Mac. For Firebase Functions, configure `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` in the Functions environment; default managed Admin credentials require permission to sign Firebase custom tokens (Service Account Token Creator when needed).

## Existing accounts and validation

Existing Firebase Google accounts are matched by Google's provider user ID and keep their existing Firebase UID. New identities get a stable UID derived from the Auth0 issuer and subject. Accounts are never merged by email alone. An email already registered under another method returns a conflict; sign in using the original method and arrange explicit account linking before switching it.

After deploying, test an existing Google account (same profile, events, and wallet), a new Google account, logout/login and refresh, email/password login, private Firestore updates, and an avatar upload. Check that disabled Firebase accounts cannot use the bridge. The automated tests cover JWT signature, issuer, audience, expiry, connection restrictions, and stable identity mapping. A live Auth0 round trip requires the tenant configuration.

To return Google to the previous login flow, set `VITE_SOCIAL_AUTH_PROVIDER=firebase` and rebuild. This does not remove Firebase accounts or data.

References: [Auth0 SPA SDK](https://auth0.github.io/auth0-spa-js/), [Firebase custom-token authentication](https://firebase.google.com/docs/auth/admin/create-custom-tokens).
