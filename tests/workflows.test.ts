import { resolveEventId } from '../src/services/eventResolution';
import { parseSavedCheckout } from '../src/services/checkout';
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeAudioDataUrl } from '../server/audio';
import { activeQueue } from '../src/services/queue';
import type { SongRequestItem } from '../src/types';
import { savedTrackingToken, saveTrackingToken } from '../src/services/tracking';

test('recordings with codec parameters decode to the original bytes and preserve format', () => {
  for (const [mime, ext] of [['audio/webm;codecs=opus', 'webm'], ['audio/mp4;codecs=mp4a.40.2', 'mp4'], ['audio/ogg', 'ogg'], ['audio/x-wav', 'wav']]) {
    const result = decodeAudioDataUrl(`data:${mime};base64,AQID`);
    assert.deepEqual([...result.buffer], [1, 2, 3]);
    assert.equal(result.filename, `sample.${ext}`);
  }
});
test('invalid audio is rejected before calling recognition provider', () => {
  for (const value of [null, '', 'data:text/html;base64,AQID', 'data:audio/webm;base64,', 'data:audio/webm;base64,abc!', 'data:audio/webm;base64,A']) assert.throws(() => decodeAudioDataUrl(value));
});
test('playback order accepts queued songs first, then VIP and manual position within status', () => {
  const item = (id: string, status: string, priority: boolean, queuePosition: number) => ({ id, status, priority, queuePosition, createdAt: '2026-01-01' } as SongRequestItem);
  const requests = [item('pending-vip', 'pending', true, 0), item('standard', 'up_next', false, 1), item('vip-later', 'up_next', true, 3), item('vip-first', 'up_next', true, 2), item('played', 'played', true, 0)];
  assert.deepEqual(activeQueue(requests).map(r => r.id), ['vip-first', 'vip-later', 'standard', 'pending-vip']);
  assert.equal(requests.length, 5);
});
test('tracking survives restoration and unavailable browser storage is harmless', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) } });
  try {
    assert.equal(savedTrackingToken(), '');
    saveTrackingToken('my-request-token');
    assert.equal(savedTrackingToken(), 'my-request-token');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('Storage blocked'); } });
    assert.doesNotThrow(() => saveTrackingToken('another'));
    assert.equal(savedTrackingToken(), '');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete (globalThis as any).localStorage;
  }
});


test('resuming checkout retains its original amount and tolerates legacy checkout records', () => {
  const checkout = { reference: 'VYBE-test', authorizationUrl: 'https://checkout.paystack.com/test', amount: 2500 };
  assert.deepEqual(parseSavedCheckout(JSON.stringify(checkout)), checkout);
  const { amount, ...legacy } = checkout;
  assert.deepEqual(parseSavedCheckout(JSON.stringify(legacy)), legacy);
  for (const input of ['invalid', '[]', 'null', JSON.stringify({ ...checkout, authorizationUrl: 'javascript:alert(1)' }), JSON.stringify({ ...checkout, authorizationUrl: 'https://paystack.com.example.com' })]) assert.equal(parseSavedCheckout(input), null);
});

test('unknown QR handles never retain a previously selected DJ; handles resolve after profiles arrive', () => {
  const events = [{ id: 'a', slug: 'event-a', djId: 'dj-a', isActive: true }, { id: 'b', slug: 'event-b', djId: 'dj-b', isActive: true }] as any;
  const djs = [{ id: 'dj-b', handle: 'dj-b' }] as any;
  assert.equal(resolveEventId(events, djs, 'typo', 'a'), '');
  assert.equal(resolveEventId(events, [], 'dj-b', 'a'), '');
  assert.equal(resolveEventId(events, djs, 'dj-b', ''), 'b');
  assert.equal(resolveEventId(events, djs, 'event-a', ''), 'a');
  assert.equal(resolveEventId(events, djs, '', '', 'dj-b'), 'b');
});
