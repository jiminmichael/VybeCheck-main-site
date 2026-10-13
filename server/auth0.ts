import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { adminAuth } from './firebase.js';
import { HttpError } from './domain.js';

export function auth0Configuration() {
  const domain = process.env.AUTH0_DOMAIN?.trim();
  const audience = process.env.AUTH0_AUDIENCE?.trim();
  if (!domain || !audience) throw new HttpError(503, 'Auth0 social sign-in is not configured on the server.');
  if (!/^[a-z0-9.-]+$/i.test(domain)) throw new HttpError(503, 'AUTH0_DOMAIN must be a hostname without a URL scheme or path.');
  return { issuer: `https://${domain}/`, audience };
}
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function verifyAuth0Token(token: string) {
  const { issuer, audience } = auth0Configuration();
  let keys = keySets.get(issuer);
  if (!keys) { keys = createRemoteJWKSet(new URL('.well-known/jwks.json', issuer)); keySets.set(issuer, keys); }
  return validateAuth0Jwt(token, keys, issuer, audience);
}
export async function validateAuth0Jwt(token: string, keys: JWTVerifyGetKey, issuer: string, audience: string) {
  try {
    const { payload } = await jwtVerify(token, keys, { issuer, audience, algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat'] });
    if (!payload.sub?.startsWith('google-oauth2|')) throw new HttpError(403, 'Use the Google connection to sign in.');
    return { subject: payload.sub, issuer };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const code = (error as { code?: string })?.code;
    if (code?.startsWith('ERR_JWT') || code?.startsWith('ERR_JWS') || code === 'ERR_JOSE_ALG_NOT_ALLOWED') {
      throw new HttpError(401, 'Your Auth0 sign-in could not be verified. Please sign in again.');
    }
    throw new HttpError(503, 'Auth0 verification is unavailable. Check the tenant domain and API configuration.');
  }
}
export function auth0FirebaseUid(issuer: string, subject: string) {
  return `auth0-${crypto.createHash('sha256').update(JSON.stringify([issuer, subject])).digest('hex')}`;
}
export async function exchangeAuth0Token(token: string) {
  const { subject, issuer } = await verifyAuth0Token(token);
  const response = await fetch(new URL('userinfo', issuer), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new HttpError(response.status === 401 ? 401 : 503, 'Auth0 could not retrieve your Google profile. Please sign in again.');
  const profile = await response.json();
  if (profile.sub !== subject || typeof profile.email !== 'string' || profile.email_verified !== true) {
    throw new HttpError(403, 'A verified Google email address is required.');
  }
  const auth = adminAuth();
  // Match Google's provider ID, never email alone: existing wallets keep their Firebase UID.
  let user;
  try { user = await auth.getUserByProviderUid('google.com', subject.slice('google-oauth2|'.length)); }
  catch (error) { if ((error as { code?: string }).code !== 'auth/user-not-found') throw error; }
  if (!user) {
    const uid = auth0FirebaseUid(issuer, subject);
    try { user = await auth.getUser(uid); }
    catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
      try {
        user = await auth.createUser({ uid, email: profile.email, emailVerified: true,
          ...(typeof profile.name === 'string' ? { displayName: profile.name.slice(0, 128) } : {}),
          ...(typeof profile.picture === 'string' && profile.picture.startsWith('https://') ? { photoURL: profile.picture } : {}) });
      } catch (createError) {
        const code = (createError as { code?: string }).code;
        if (code === 'auth/uid-already-exists') user = await auth.getUser(uid);
        else if (code === 'auth/email-already-exists') throw new HttpError(409, 'An account with this email already exists. Sign in with its original method and contact support to link Google.');
        else throw createError;
      }
    }
  }
  if (user.disabled) throw new HttpError(403, 'Your account has been disabled. Contact support.');
  return { customToken: await auth.createCustomToken(user.uid) };
}
