import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('Firebase Admin starts without native require(esm) support', () => {
  const result = spawnSync(process.execPath, ['--no-experimental-require-module', '-e', "require('firebase-admin/auth'); require('firebase-admin/firestore');"], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('the compatible JWKS dependency retrieves a usable RSA public key', async () => {
  const { createRequire } = await import('node:module');
  const { dirname, join } = await import('node:path');
  const { generateKeyPairSync, sign, verify } = await import('node:crypto');
  const require = createRequire(import.meta.url);
  const { retrieveSigningKeys } = require(join(dirname(require.resolve('jwks-rsa')), 'utils.js'));
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const keys = await retrieveSigningKeys([{ ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' }]);
  assert.equal(keys.length, 1);
  assert.equal(keys[0].kid, 'test-key');
  const message = Buffer.from('verify Firebase signing key compatibility');
  assert.equal(verify('RSA-SHA256', message, keys[0].getPublicKey(), sign('RSA-SHA256', message, privateKey)), true);
});
