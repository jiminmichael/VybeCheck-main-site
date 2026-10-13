import { Auth0Client } from '@auth0/auth0-spa-js';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from './firebase';
import { readApiResponse } from './apiResponse';

const env = (import.meta as any).env || {};
export const usesAuth0Social = env.VITE_SOCIAL_AUTH_PROVIDER === 'auth0';
let client: Auth0Client | undefined;
function auth0Client() {
  const domain = env.VITE_AUTH0_DOMAIN;
  const clientId = env.VITE_AUTH0_CLIENT_ID;
  const audience = env.VITE_AUTH0_AUDIENCE;
  if (!domain || !clientId || !audience) throw new Error('Auth0 social sign-in is not configured. Set the Auth0 domain, Client ID, and API audience.');
  return client ||= new Auth0Client({ domain, clientId, cacheLocation: 'memory',
    authorizationParams: { audience, scope: 'openid profile email', redirect_uri: window.location.origin } });
}
export async function signInWithAuth0Google() {
  const client = auth0Client();
  await client.loginWithPopup({ authorizationParams: { connection: 'google-oauth2', prompt: 'select_account' } });
  const token = await client.getTokenSilently();
  const response = await fetch('/api/auth/auth0/exchange', { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
  const result = await readApiResponse<{ customToken: string }>(response, '/api/auth/auth0/exchange');
  return signInWithCustomToken(auth, result.customToken);
}
export async function clearAuth0Session() {
  if (client) await client.logout({ openUrl: false });
}
