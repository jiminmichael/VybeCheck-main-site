import test from 'node:test';
import assert from 'node:assert/strict';
import { FieldValue } from 'firebase-admin/firestore';
import { amountInKobo, documentId, profilePatch, publicProfile, validateVerifiedPayment } from '../server/domain';
import { settlePayment, settleTransfer, recordTransfer, reconcilePayout } from '../server/firebaseRoutes';

const payment = { reference: 'test-reference', requestId: 'request-1', djId: 'dj-1', amount: 100.25, amountKobo: 10025, status: 'pending' };
const verified = { reference: payment.reference, status: 'success', currency: 'NGN', amount: 10025, metadata: { requestId: 'request-1' } };

test('money validation rejects invalid precision, non-finite and negative amounts', () => {
  assert.equal(amountInKobo(100.25), 10025);
  for (const value of [0, -1, NaN, Infinity, 'bad', 12.345, 1_000_001]) assert.throws(() => amountInKobo(value));
});
test('document IDs cannot escape their collection', () => {
  assert.equal(documentId('a-valid-uid'), 'a-valid-uid');
  for (const value of ['../wallet', '/', '', null, '..']) assert.throws(() => documentId(value));
});
test('profile updates cannot overwrite ownership, identity, balances, or passwords', () => {
  assert.deepEqual(profilePatch({ stageName: 'DJ Test', availableBalance: 100000, id: 'another-dj', authUserId: 'attacker', email: 'attacker@example.com', password: 'secret', isVerified: true }), { stageName: 'DJ Test' });
  assert.throws(() => profilePatch({ avatarUrl: 'data:image/png;base64,test' }));
  assert.throws(() => profilePatch({ handle: '../other' }));
});
test('public profiles exclude email, bank details, and wallet balances', () => {
  const result = publicProfile({ id: 'dj-1', stageName: 'DJ Test', email: 'private@example.com', accountNumber: '1234567890', availableBalance: 1000, password: 'secret' });
  assert.deepEqual(result, { id: 'dj-1', stageName: 'DJ Test' });
});
test('payment verification binds provider amount, currency, reference and request to checkout', () => {
  assert.doesNotThrow(() => validateVerifiedPayment(payment, verified));
  for (const patch of [{ amount: 1 }, { currency: 'USD' }, { reference: 'other' }, { status: 'pending' }, { metadata: { requestId: 'another-request' } }]) {
    assert.throws(() => validateVerifiedPayment(payment, { ...verified, ...patch }));
  }
});

// Minimal transaction harness: commits atomically and serializes concurrent calls.
// The separate emulator suite is the place to validate actual Firestore isolation/rules.
function paymentDatabase() {
  const data = new Map<string, any>([
    ['payments/test-reference', { ...payment }],
    ['events/event-1', { autoPriority: true }],
    ['song_requests/request-1', { eventId: 'event-1', djId: 'dj-1', song: 'Test', artist: 'Artist' }],
    ['djs/dj-1', { availableBalance: 0 }],
  ]);
  const writes: any[] = [];
  let chain = Promise.resolve();
  const database = {
    collection: (name: string) => ({ doc: (id: string) => ({ id, path: `${name}/${id}`, get: async () => ({ data: () => data.get(`${name}/${id}`) }), update: async (patch: any) => { const path = `${name}/${id}`; data.set(path, { ...data.get(path), ...patch }); writes.push({ path, patch }); } }) }),
    runTransaction: (fn: any) => {
      const result = chain.then(async () => {
        const pending: any[] = [];
        const value = await fn({
          get: async (ref: any) => ({ data: () => data.get(ref.path) }),
          update: (ref: any, patch: any) => pending.push({ path: ref.path, patch }),
          set: (ref: any, patch: any) => pending.push({ path: ref.path, patch }),
        });
        pending.forEach(write => { data.set(write.path, { ...data.get(write.path), ...write.patch }); writes.push(write); });
        return value;
      });
      chain = result.then(() => {}, () => {});
      return result;
    },
  };
  return { database: database as any, data, writes };
}
test('concurrent verify/webhook retries credit one payment exactly once', async () => {
  const { database, writes } = paymentDatabase();
  const amounts = await Promise.all([settlePayment(verified, 'request-1', database), settlePayment(verified, 'request-1', database)]);
  assert.deepEqual(amounts, [100.25, 100.25]);
  const credits = writes.filter(w => w.path === 'djs/dj-1');
  assert.equal(credits.length, 1);
  assert(credits[0].patch.availableBalance.isEqual(FieldValue.increment(100.25)));
  assert.equal(writes.filter(w => w.path.startsWith('notifications/')).length, 1);
});
test('a checkout cannot credit a different request', async () => {
  const { database, writes } = paymentDatabase();
  await assert.rejects(settlePayment(verified, 'other-request', database), /Checkout not found/);
  assert.equal(writes.length, 0);
});
test('failed provider verification leaves every record unchanged', async () => {
  const { database, writes } = paymentDatabase();
  await assert.rejects(settlePayment({ ...verified, status: 'failed' }, 'request-1', database));
  assert.equal(writes.length, 0);
});

test('failed payout refunds reserved funds only once', async () => {
  const { database, data, writes } = paymentDatabase();
  data.set('payouts/payout-test', { djId: 'dj-1', amount: 1000, status: 'processing' });
  data.set('djs/dj-1', { availableBalance: 0, pendingPayoutReference: 'payout-test' });
  await settleTransfer('payout-test', 'failed', database);
  await settleTransfer('payout-test', 'failed', database);
  const refunds = writes.filter(w => w.path === 'djs/dj-1');
  assert.equal(refunds.length, 1);
  assert(refunds[0].patch.availableBalance.isEqual(FieldValue.increment(1000)));
  assert(refunds[0].patch.pendingPayoutReference.isEqual(FieldValue.delete()));
});
test('successful payout ignores stale failure and handles reversal once', async () => {
  const { database, data, writes } = paymentDatabase();
  data.set('payouts/payout-test', { djId: 'dj-1', amount: 1000, status: 'success' });
  await settleTransfer('payout-test', 'failed', database);
  assert.equal(writes.length, 0);
  await settleTransfer('payout-test', 'reversed', database);
  await settleTransfer('payout-test', 'reversed', database);
  const refunds = writes.filter(w => w.path === 'djs/dj-1');
  assert.equal(refunds.length, 1);
  assert(refunds[0].patch.totalWithdrawn.isEqual(FieldValue.increment(-1000)));
});


test('Auto VIP applies only when enabled and preserves existing priority', async () => {
  for (const [enabled, alreadyVip, expected] of [[false, false, false], [true, false, true], [false, true, true]]) {
    const { database, data } = paymentDatabase();
    data.set('events/event-1', { autoPriority: enabled });
    data.get('song_requests/request-1').priority = alreadyVip;
    await settlePayment(verified, 'request-1', database);
    assert.equal(data.get('song_requests/request-1').priority, expected);
  }
});
test('provider reconciliation validates payout reference, currency, and net amount before settling', async () => {
  for (const change of [{ reference: 'other' }, { currency: 'USD' }, { amount: 1 }]) {
    const { database, data, writes } = paymentDatabase();
    data.set('payouts/payout-test', { djId: 'dj-1', netAmount: 975, amount: 1000, status: 'processing' });
    await assert.rejects(recordTransfer('payout-test', { reference: 'payout-test', currency: 'NGN', amount: 97500, status: 'success', ...change }, database), /do not match/);
    assert.equal(writes.length, 0);
  }
});
test('OTP transfer keeps funds reserved; confirmed failure refunds once', async () => {
  const { database, data, writes } = paymentDatabase();
  data.set('payouts/payout-test', { djId: 'dj-1', netAmount: 975, amount: 1000, status: 'processing' });
  const transfer = { reference: 'payout-test', currency: 'NGN', amount: 97500, transfer_code: 'TRF_test', status: 'otp' };
  await recordTransfer('payout-test', transfer, database);
  assert.equal(data.get('payouts/payout-test').providerStatus, 'otp');
  assert.equal(writes.filter(w => w.path === 'djs/dj-1').length, 0);
  await recordTransfer('payout-test', { ...transfer, status: 'failed' }, database);
  await recordTransfer('payout-test', { ...transfer, status: 'failed' }, database);
  assert.equal(writes.filter(w => w.path === 'djs/dj-1').length, 1);
});
test('a timed-out reconciliation never refunds or sends a replacement transfer', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_fixture';
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.match(String(url), /\/transfer\/verify\/payout-test$/);
    assert.equal(options?.method, 'GET');
    throw new Error('timeout');
  };
  try {
    const { database, writes } = paymentDatabase();
    await assert.rejects(reconcilePayout('payout-test', database), /timeout/);
    assert.equal(writes.length, 0);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = originalKey;
  }
});
