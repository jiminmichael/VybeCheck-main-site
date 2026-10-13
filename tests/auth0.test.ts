import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { auth0FirebaseUid, validateAuth0Jwt } from '../server/auth0.js';

test('Auth0 bridge accepts only signed, current Google tokens for the configured API and tenant', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const keys = createLocalJWKSet({ keys: [{ ...jwk, kid: 'test', alg: 'RS256' }] });
  const issuer = 'https://example.auth0.com/';
  const audience = 'https://vybecheck-api';
  const token = (iss = issuer, aud = audience, sub = 'google-oauth2|123', expires = '5m') =>
    new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer(iss).setAudience(aud).setSubject(sub).setIssuedAt().setExpirationTime(expires).sign(privateKey);
  assert.equal((await validateAuth0Jwt(await token(), keys, issuer, audience)).subject, 'google-oauth2|123');
  for (const invalid of [await token('https://other.auth0.com/'), await token(issuer, 'wrong-api'), await token(issuer, audience, 'google-oauth2|123', '-1m')]) {
    await assert.rejects(validateAuth0Jwt(invalid, keys, issuer, audience), { status: 401 });
  }
  await assert.rejects(validateAuth0Jwt(await token(issuer, audience, 'auth0|123'), keys, issuer, audience), { status: 403 });
  const { privateKey: foreignKey } = await generateKeyPair('RS256');
  const forged = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer(issuer).setAudience(audience).setSubject('google-oauth2|123').setIssuedAt().setExpirationTime('5m').sign(foreignKey);
  await assert.rejects(validateAuth0Jwt(forged, keys, issuer, audience), { status: 401 });
});

test('new Firebase UIDs are stable and isolated by Auth0 tenant and subject', () => {
  const uid = auth0FirebaseUid('https://one.auth0.com/', 'google-oauth2|123');
  assert.equal(uid, auth0FirebaseUid('https://one.auth0.com/', 'google-oauth2|123'));
  assert.notEqual(uid, auth0FirebaseUid('https://two.auth0.com/', 'google-oauth2|123'));
  assert.notEqual(uid, auth0FirebaseUid('https://one.auth0.com/', 'google-oauth2|456'));
  assert.ok(uid.length <= 128);
});
