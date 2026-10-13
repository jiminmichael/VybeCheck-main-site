import { activeQueue } from '../src/services/queue';
import type { SongRequestItem } from '../src/types';
import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, firestore } from './firebase';
import { HttpError, apiErrorResponse, text, documentId, amountInKobo, profilePatch, publicProfile, validateVerifiedPayment } from './domain';

export const firebaseRoutes = Router();
const now = () => new Date().toISOString();
const route = (fn: (req: Request, res: Response) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => void fn(req, res).catch(next);
async function identity(req: Request): Promise<DecodedIdToken> {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, 'Sign in to continue.');
  try { return await adminAuth().verifyIdToken(token, true); }
  catch { throw new HttpError(401, 'Your session expired. Please sign in again.'); }
}
async function owned(req: Request, collection: string, id: string) {
  const user = await identity(req);
  const ref = firestore().collection(collection).doc(documentId(id));
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpError(404, 'Record not found.');
  const data = snapshot.data()!;
  if ((collection === 'djs' ? data.id : data.djId) !== user.uid) throw new HttpError(403, 'You cannot modify this record.');
  return { ref, data, user };
}
export class PaystackError extends HttpError {
  constructor(message: string, public definitive: boolean, public providerStatus?: number) { super(502, message); }
}
async function paystack(path: string, body?: unknown) {
  if (!process.env.PAYSTACK_SECRET_KEY) throw new HttpError(503, 'Payments are not configured.');
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok || !result.status) throw new PaystackError(result.message || 'Paystack request failed.',
    response.status >= 400 && response.status < 500 && ![408, 409, 429].includes(response.status) && !/reference|duplicate|already/i.test(result.message || ''), response.status);
  return result.data;
}
function initialEvent(dj: any, id: string) {
  return { id, djId: dj.id, name: `${dj.stageName} Live Session`, slug: dj.handle,
    description: `Live requests for ${dj.stageName}`, djName: dj.stageName, djEmail: '',
    venue: dj.defaultVenue, eventDate: now(), createdAt: now(), isActive: true,
    requestsEnabled: true, publicQueueEnabled: true, autoPriority: true, tipsEnabled: true,
    minTip: dj.minTipAmount, maxTip: 1_000_000 };
}

firebaseRoutes.post('/auth/profile', route(async (req, res) => {
  const user = await identity(req);
  const db = firestore();
  const djRef = db.collection('djs').doc(user.uid);
  const patch = profilePatch(req.body || {});
  const dj = await db.runTransaction(async tx => {
    const existing = await tx.get(djRef);
    if (existing.exists) return existing.data();
    if (!user.email) throw new HttpError(400, 'An email address is required for your DJ account.');
    const handle = patch.handle || `dj-${user.uid.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24)}`;
    const handleRef = db.collection('handles').doc(handle);
    if ((await tx.get(handleRef)).exists) throw new HttpError(409, 'This DJ handle is already taken. Choose another.');
    const profile = { name: user.name || user.email.split('@')[0], stageName: user.name || 'DJ', handle,
      bio: '', avatarUrl: user.picture || '', genres: ['Afrobeats', 'Amapiano'], defaultVenue: 'Add your venue', minTipAmount: 10000,
      ...patch, id: user.uid, email: user.email, authUserId: user.uid, isVerified: !!user.email_verified,
      availableBalance: 0, totalWithdrawn: 0, totalTipsEarned: 0, totalRequestsReceived: 0, totalSongsPlayed: 0, createdAt: now() };
    tx.create(djRef, profile);
    tx.create(handleRef, { djId: user.uid });
    tx.set(db.collection('public_djs').doc(user.uid), publicProfile(profile));
    tx.create(db.collection('events').doc(`initial-${user.uid}`), initialEvent(profile, `initial-${user.uid}`));
    return profile;
  });
  res.json({ success: true, dj });
}));

firebaseRoutes.put('/djs/:id', route(async (req, res) => {
  const { ref, user } = await owned(req, 'djs', String(req.params.id));
  const patch = profilePatch(req.body);
  if (['bankCode', 'accountNumber', 'bankName'].some(key => patch[key] !== undefined)) {
    if (patch.accountNumber || patch.bankCode || patch.bankName) {
      if (!/^\d{10}$/.test(patch.accountNumber || '') || !/^\d{3,10}$/.test(patch.bankCode || '')) throw new HttpError(400, 'Select a bank and enter a 10-digit account number.');
      const banks = await paystack('/bank?country=nigeria');
      const bank = banks.find((b: any) => b.code === patch.bankCode);
      if (!bank) throw new HttpError(400, 'Select a supported bank.');
      const account = await paystack(`/bank/resolve?account_number=${patch.accountNumber}&bank_code=${patch.bankCode}`);
      patch.bankName = bank.name;
      patch.accountName = account.account_name;
    } else patch.accountName = '';
  }
  const db = firestore();
  const dj = await db.runTransaction(async tx => {
    const old = (await tx.get(ref)).data()!;
    if (patch.handle && patch.handle !== old.handle) {
      const target = db.collection('handles').doc(patch.handle);
      if ((await tx.get(target)).exists) throw new HttpError(409, 'This DJ handle is already taken.');
      tx.create(target, { djId: user.uid });
      tx.delete(db.collection('handles').doc(old.handle));
    }
    const updated = { ...old, ...patch };
    tx.update(ref, patch);
    tx.set(db.collection('public_djs').doc(user.uid), publicProfile(updated));
    return updated;
  });
  res.json({ success: true, dj });
}));

firebaseRoutes.post('/events', route(async (req, res) => {
  const user = await identity(req);
  const dj = (await firestore().collection('djs').doc(user.uid).get()).data();
  if (!dj) throw new HttpError(404, 'Create your DJ profile first.');
  const ref = firestore().collection('events').doc();
  const event = { ...initialEvent(dj, ref.id), name: text(req.body.name, 'event name'), venue: text(req.body.venue, 'venue'), slug: `${dj.handle}-${ref.id}` };
  await ref.create(event);
  res.json({ success: true, event });
}));

firebaseRoutes.patch('/events/:id', route(async (req, res) => {
  const { ref } = await owned(req, 'events', String(req.params.id));
  const patch: Record<string, any> = {};
  for (const key of ['isActive', 'requestsEnabled', 'publicQueueEnabled', 'autoPriority', 'tipsEnabled']) {
    if (req.body[key] !== undefined) {
      if (typeof req.body[key] !== 'boolean') throw new HttpError(400, `Invalid ${key}.`);
      patch[key] = req.body[key];
    }
  }
  for (const key of ['name', 'venue', 'description']) if (req.body[key] !== undefined) patch[key] = text(req.body[key], key, 1000, false);
  for (const key of ['minTip', 'maxTip']) if (req.body[key] !== undefined) {
    const n = Number(req.body[key]);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new HttpError(400, 'Invalid tip limit.');
    patch[key] = n;
  }
  await ref.update(patch);
  res.json({ success: true });
}));

firebaseRoutes.post('/requests', route(async (req, res) => {
  if (req.body.honeypot) throw new HttpError(400, 'Spam submission detected.');
  const eventId = documentId(req.body.eventId);
  const song = text(req.body.song, 'song');
  const artist = text(req.body.artist, 'artist');
  const db = firestore();
  const ref = db.collection('song_requests').doc();
  const eventRef = db.collection('events').doc(eventId);
  const request = await db.runTransaction(async tx => {
    const event = (await tx.get(eventRef)).data();
    if (!event?.isActive || !event.requestsEnabled) throw new HttpError(400, 'This session is not accepting requests.');
    const djRef = db.collection('djs').doc(event.djId);
    const dj = (await tx.get(djRef)).data();
    if (!dj) throw new HttpError(404, 'DJ not found.');
    const request: Record<string, any> = { id: ref.id, djId: event.djId, eventId, song, artist,
      genre: text(req.body.genre || 'Other', 'genre', 40), requesterName: text(req.body.requesterName || 'Anonymous Fan', 'name', 100),
      dedication: text(req.body.dedication || '', 'dedication', 1000, false), tipAmount: 0, priority: false,
      status: 'pending', queuePosition: Date.now(), trackingToken: crypto.randomUUID(), createdAt: now(), updatedAt: now() };
    for (const key of ['artworkUrl', 'previewUrl', 'album']) if (req.body[key]) request[key] = text(req.body[key], key, 3000);
    if (req.body.identifiedViaAudio === true) request.identifiedViaAudio = true;
    if (Number.isFinite(req.body.audioConfidence)) request.audioConfidence = req.body.audioConfidence;
    tx.create(ref, request);
    tx.update(djRef, { totalRequestsReceived: FieldValue.increment(1) });
    const notification = db.collection('notifications').doc();
    tx.create(notification, { id: notification.id, djId: event.djId, type: 'new_request', title: 'New song request', message: `${song} by ${artist}`, song, artist, read: false, timestamp: now() });
    return request;
  });
  res.json({ success: true, request });
}));

firebaseRoutes.get('/requests/track/:token', route(async (req, res) => {
  const docs = await firestore().collection('song_requests').where('trackingToken', '==', documentId(req.params.token)).limit(1).get();
  if (docs.empty) throw new HttpError(404, 'Request not found.');
  const request = docs.docs[0].data();
  const queue = await firestore().collection('song_requests').where('eventId', '==', request.eventId).get();
  const rank = activeQueue(queue.docs.map(d => d.data() as SongRequestItem)).findIndex(r => r.id === request.id) + 1;
  res.json({ success: true, request: { ...request, queueRank: rank || null } });
}));

firebaseRoutes.patch('/requests/:id/status', route(async (req, res) => {
  const { ref, user } = await owned(req, 'song_requests', String(req.params.id));
  const status = req.body.status;
  if (!['pending', 'up_next', 'playing', 'played', 'rejected'].includes(status)) throw new HttpError(400, 'Invalid request status.');
  const db = firestore();
  await db.runTransaction(async tx => {
    const request = (await tx.get(ref)).data()!;
    const eventRef = db.collection('events').doc(request.eventId);
    const event = (await tx.get(eventRef)).data();
    const previousRef = event?.playingRequestId && event.playingRequestId !== ref.id ? db.collection('song_requests').doc(event.playingRequestId) : null;
    const previous = previousRef ? (await tx.get(previousRef)).data() : null;
    const rejectionReason = status === 'rejected' ? text(req.body.reason || '', 'rejection reason', 500, false) : '';
    const patch: Record<string, any> = { status, rejectionReason, updatedAt: now() };
    if (status === 'playing') {
      patch.playingStartedAt = now();
      if (previous?.status === 'playing' && previousRef) {
        tx.update(previousRef, { status: 'played', playedAt: now(), updatedAt: now() });
        tx.update(db.collection('djs').doc(user.uid), { totalSongsPlayed: FieldValue.increment(1) });
      }
      tx.update(eventRef, { playingRequestId: ref.id });
    } else if (event?.playingRequestId === ref.id) tx.update(eventRef, { playingRequestId: FieldValue.delete() });
    if (status === 'played') {
      patch.playedAt = now();
      if (request.status !== 'played') tx.update(db.collection('djs').doc(user.uid), { totalSongsPlayed: FieldValue.increment(1) });
    }
    tx.update(ref, patch);
    const history = db.collection('queue_history').doc();
    tx.create(history, { id: history.id, requestId: ref.id, djId: user.uid, song: request.song, artist: request.artist, action: status, note: rejectionReason, performer: user.uid, oldStatus: request.status, newStatus: status, createdAt: now() });
  });
  res.json({ success: true });
}));

firebaseRoutes.post('/requests/reorder', route(async (req, res) => {
  const user = await identity(req);
  if (!Array.isArray(req.body.orderedIds) || req.body.orderedIds.length > 450) throw new HttpError(400, 'Invalid queue.');
  const ids = [...new Set<string>(req.body.orderedIds.map(documentId))];
  const db = firestore();
  await db.runTransaction(async tx => {
    const refs = ids.map(id => db.collection('song_requests').doc(id));
    const docs = refs.length ? await tx.getAll(...refs) : [];
    if (docs.some(d => !d.exists || d.data()?.djId !== user.uid)) throw new HttpError(403, 'You can only reorder your own requests.');
    docs.forEach((d, i) => tx.update(d.ref, { queuePosition: i + 1 }));
  });
  res.json({ success: true });
}));

firebaseRoutes.patch('/notifications/:id/read', route(async (req, res) => {
  const { ref } = await owned(req, 'notifications', String(req.params.id));
  await ref.update({ read: true });
  res.json({ success: true });
}));

firebaseRoutes.post('/payments/initialize', route(async (req, res) => {
  const db = firestore();
  const requestId = documentId(req.body.requestId);
  const request = (await db.collection('song_requests').doc(requestId).get()).data();
  if (!request) throw new HttpError(404, 'Song request not found.');
  const event = (await db.collection('events').doc(request.eventId).get()).data();
  const amountKobo = amountInKobo(req.body.amount);
  if (!event?.tipsEnabled || amountKobo < event.minTip * 100 || amountKobo > event.maxTip * 100) throw new HttpError(400, 'Tip is outside this event’s allowed range.');
  const email = text(req.body.customerEmail, 'email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  const reference = `VYBE-${crypto.randomUUID()}`;
  await db.collection('payments').doc(reference).create({ id: reference, reference, requestId, eventId: request.eventId, djId: request.djId, amount: amountKobo / 100, amountKobo, currency: 'NGN', customerEmail: email, status: 'pending', createdAt: now() });
  const data = await paystack('/transaction/initialize', { email, amount: amountKobo, reference, currency: 'NGN', metadata: { requestId, eventId: request.eventId, djId: request.djId } });
  res.json({ success: true, reference, accessCode: data.access_code, authorizationUrl: data.authorization_url });
}));

export async function settlePayment(verified: any, requestedId?: string, db = firestore()) {
  const ref = db.collection('payments').doc(documentId(verified.reference));
  return db.runTransaction(async tx => {
    const payment = (await tx.get(ref)).data();
    if (!payment || (requestedId && requestedId !== payment.requestId)) throw new HttpError(400, 'Checkout not found for this request.');
    validateVerifiedPayment(payment, verified);
    if (payment.status === 'success') return payment.amount;
    const requestRef = db.collection('song_requests').doc(payment.requestId);
    const request = (await tx.get(requestRef)).data();
    const djRef = db.collection('djs').doc(payment.djId);
    const dj = (await tx.get(djRef)).data();
    const event = request?.eventId ? (await tx.get(db.collection('events').doc(request.eventId))).data() : undefined;
    if (!request || !dj || request.djId !== payment.djId) throw new HttpError(400, 'Checkout owner mismatch.');
    tx.update(ref, { status: 'success', paidAt: now() });
    tx.update(requestRef, { tipAmount: FieldValue.increment(payment.amount), priority: request.priority === true || event?.autoPriority === true, updatedAt: now() });
    tx.update(djRef, { availableBalance: FieldValue.increment(payment.amount), totalTipsEarned: FieldValue.increment(payment.amount) });
    const notification = db.collection('notifications').doc(`payment-${ref.id}`);
    tx.set(notification, { id: notification.id, djId: payment.djId, type: 'tip_confirmed', title: 'Tip confirmed', message: `₦${payment.amount} received for ${request.song}`, song: request.song, artist: request.artist, tipAmount: payment.amount, timestamp: now(), read: false });
    return payment.amount;
  });
}

firebaseRoutes.post('/payments/verify', route(async (req, res) => {
  const reference = documentId(req.body.reference);
  const verified = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  const amount = await settlePayment(verified, documentId(req.body.requestId));
  res.json({ success: true, verified: true, amount });
}));

export async function settleTransfer(reference: string, status: string, db = firestore()) {
  if (!['success', 'failed', 'reversed'].includes(status)) return;
  const ref = db.collection('payouts').doc(documentId(reference));
  await db.runTransaction(async tx => {
    const payout = (await tx.get(ref)).data();
    if (!payout || payout.status === 'failed' || (payout.status === 'success' && status !== 'reversed')) return;
    const djRef = db.collection('djs').doc(payout.djId);
    const dj = (await tx.get(djRef)).data();
    if (!dj) throw new HttpError(404, 'Payout owner missing.');
    const success = status === 'success';
    tx.update(ref, { status: success ? 'success' : 'failed', processedAt: now(), ...(success ? {} : { failureReason: status }) });
    const cleared = dj.pendingPayoutReference === reference ? { pendingPayoutReference: FieldValue.delete() } : {};
    if (success) tx.update(djRef, { ...cleared, totalWithdrawn: FieldValue.increment(payout.amount) });
    else tx.update(djRef, { ...cleared, availableBalance: FieldValue.increment(payout.amount), ...(payout.status === 'success' ? { totalWithdrawn: FieldValue.increment(-payout.amount) } : {}) });
  });
}

// Only provider-verified outcomes settle reserved funds; a timeout/404 never refunds them.
export async function recordTransfer(reference: string, transfer: any, db = firestore()) {
  const ref = db.collection('payouts').doc(documentId(reference));
  const payout = (await ref.get()).data();
  if (!payout || transfer.reference !== reference || transfer.currency !== 'NGN' || transfer.amount !== Math.round(payout.netAmount * 100)) throw new HttpError(502, 'Transfer details do not match this payout.');
  await ref.update({ providerStatus: transfer.status, ...(transfer.transfer_code ? { paystackTransferCode: transfer.transfer_code } : {}), lastCheckedAt: now() });
  await settleTransfer(reference, transfer.status, db);
}
export async function reconcilePayout(reference: string, db = firestore()) {
  const transfer = await paystack(`/transfer/verify/${encodeURIComponent(documentId(reference))}`);
  await recordTransfer(reference, transfer, db);
}
export async function reconcilePendingPayouts() {
  const db = firestore();
  const pending = await db.collection('payouts').where('status', '==', 'processing').get();
  // Bound concurrency so one slow provider response does not block every other payout.
  for (let offset = 0; offset < pending.docs.length; offset += 10) {
    await Promise.all(pending.docs.slice(offset, offset + 10).map(async payout => {
      try { await reconcilePayout(payout.id, db); }
      catch (error) { console.error('Payout reconciliation pending:', payout.id, error instanceof Error ? error.message : 'Provider unavailable'); }
    }));
  }
}
// Operator-only CLI uses this for OTP sent to the Paystack business owner.
export async function finalizePayout(reference: string, otp: string) {
  await reconcilePayout(reference);
  const payout = (await firestore().collection('payouts').doc(documentId(reference)).get()).data();
  if (payout?.status !== 'processing' || payout.providerStatus !== 'otp' || !payout.paystackTransferCode) throw new HttpError(400, 'This payout is not awaiting OTP approval.');
  const transfer = await paystack('/transfer/finalize_transfer', { transfer_code: payout.paystackTransferCode, otp: text(otp, 'OTP', 20) });
  await recordTransfer(reference, transfer);
}
firebaseRoutes.post('/payout/:reference/retry', route(async (req, res) => {
  const { ref, data } = await owned(req, 'payouts', String(req.params.reference));
  if (data.status !== 'processing') return res.json({ success: true, payout: data });
  // Always reconcile first. Reuse the reference only after a provider 404, never on a timeout.
  try { await reconcilePayout(ref.id); }
  catch (error) {
    if (!(error instanceof PaystackError) || error.providerStatus !== 404) throw error;
    if (Date.now() - Date.parse(data.createdAt) < 120_000) throw new HttpError(409, 'Allow two minutes for the original transfer to reach the provider, then check again.');
    if (!data.paystackRecipientCode) throw new HttpError(409, 'Contact payout support to reconcile this transfer before retrying.');
    const transfer = await paystack('/transfer', { source: 'balance', amount: Math.round(data.netAmount * 100), recipient: data.paystackRecipientCode, reference: ref.id, currency: 'NGN', reason: 'VybeCheck DJ withdrawal' });
    await recordTransfer(ref.id, transfer);
  }
  res.json({ success: true, payout: (await ref.get()).data() });
}));

firebaseRoutes.post('/payout/:reference/reconcile', route(async (req, res) => {
  const { ref, data } = await owned(req, 'payouts', String(req.params.reference));
  if (data.status === 'processing' || data.status === 'pending') await reconcilePayout(ref.id);
  res.json({ success: true, payout: (await ref.get()).data() });
}));

firebaseRoutes.post('/payments/webhook', route(async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.headers['x-paystack-signature'];
  const raw = (req as any).rawBody as Buffer | undefined;
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{128}$/i.test(signature) || !raw) throw new HttpError(401, 'Invalid webhook signature.');
  const expected = crypto.createHmac('sha512', secret).update(raw).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new HttpError(401, 'Invalid webhook signature.');
  const { event, data } = req.body;
  if (event === 'charge.success') await settlePayment(data);
  if (['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(event)) await settleTransfer(data.reference, event.split('.')[1]);
  res.json({ received: true });
}));

firebaseRoutes.get('/payout/banks', route(async (_req, res) => {
  const data = await paystack('/bank?country=nigeria');
  res.json({ success: true, banks: data.map((b: any) => ({ name: b.name, code: b.code, slug: b.slug })) });
}));
firebaseRoutes.post('/payout/resolve-account', route(async (req, res) => {
  await identity(req);
  const account = text(req.body.accountNumber, 'account number', 10);
  if (!/^\d{10}$/.test(account)) throw new HttpError(400, 'Enter a 10-digit bank account number.');
  const bank = text(req.body.bankCode, 'bank code', 10);
  const data = await paystack(`/bank/resolve?account_number=${encodeURIComponent(account)}&bank_code=${encodeURIComponent(bank)}`);
  res.json({ success: true, accountName: data.account_name, accountNumber: data.account_number });
}));

firebaseRoutes.post('/payout/withdraw', route(async (req, res) => {
  const user = await identity(req);
  const amountKobo = amountInKobo(req.body.amount);
  if (amountKobo < 100_000) throw new HttpError(400, 'Minimum withdrawal is ₦1,000.');
  const accountNumber = text(req.body.accountNumber, 'account number', 10);
  if (!/^\d{10}$/.test(accountNumber)) throw new HttpError(400, 'Enter a 10-digit account number.');
  const bankCode = text(req.body.bankCode, 'bank code', 10);
  const bankName = text(req.body.bankName, 'bank name');
  const reference = documentId(req.body.reference);
  if (!/^payout-[a-f0-9-]{36}$/.test(reference)) throw new HttpError(400, 'Invalid payout reference.');
  const db = firestore();
  const ref = db.collection('payouts').doc(reference);
  const djRef = db.collection('djs').doc(user.uid);
  // Reserve funds before any transfer. The same reference can never send twice.
  const result = await db.runTransaction(async tx => {
    const existing = (await tx.get(ref)).data();
    if (existing) {
      if (existing.djId !== user.uid) throw new HttpError(403, 'Invalid payout owner.');
      return { existing: true, payout: existing };
    }
    const dj = (await tx.get(djRef)).data();
    const amount = amountKobo / 100;
    if (!dj || dj.availableBalance < amount) throw new HttpError(400, 'Insufficient wallet balance.');
    if (dj.pendingPayoutReference) throw new HttpError(409, 'Your previous payout is awaiting confirmation. Check your payout history before withdrawing again.');
    const payout = { id: reference, reference, djId: user.uid, amount, fee: 25, netAmount: amount - 25, currency: 'NGN', bankCode, bankName, accountNumber, accountName: '', status: 'processing', createdAt: now() };
    tx.create(ref, payout);
    tx.update(djRef, { availableBalance: FieldValue.increment(-amount), pendingPayoutReference: reference });
    return { existing: false, payout };
  });
  if (!result.existing) {
    let transferAttempted = false;
    try {
      const account = await paystack(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
      const recipient = await paystack('/transferrecipient', { type: 'nuban', name: account.account_name, account_number: accountNumber, bank_code: bankCode, currency: 'NGN' });
      await ref.update({ accountName: account.account_name, paystackRecipientCode: recipient.recipient_code });
      transferAttempted = true;
      const transfer = await paystack('/transfer', { source: 'balance', amount: amountKobo - 2500, recipient: recipient.recipient_code, reference, reason: 'VybeCheck DJ withdrawal' });
      await recordTransfer(reference, transfer, db);
    } catch (error) {
      // An uncertain transfer must stay reserved until a verified webhook/reconciliation.
      if (!transferAttempted || (error instanceof PaystackError && error.definitive)) await settleTransfer(reference, 'failed');
      else await ref.update({ failureReason: 'Transfer awaiting provider confirmation. Do not retry with a new reference.' });
      // Return the persisted payout, including definitive failure, to clear client retry state.
    }
  }
  if (result.existing && result.payout.status === 'processing') await reconcilePayout(reference, db);
  const payout = (await ref.get()).data();
  const wallet = (await djRef.get()).data();
  res.json({ success: true, payout, wallet: { availableBalance: wallet?.availableBalance, totalWithdrawn: wallet?.totalWithdrawn } });
}));

firebaseRoutes.get('/payout/history/:djId', route(async (req, res) => {
  const user = await identity(req);
  if (req.params.djId !== user.uid) throw new HttpError(403, 'Not your wallet.');
  const docs = await firestore().collection('payouts').where('djId', '==', user.uid).get();
  res.json({ success: true, payouts: docs.docs.map(d => d.data()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
}));

firebaseRoutes.get('/firebase/status', route(async (_req, res) => {
  await firestore().collection('events').limit(1).get();
  res.json({ success: true, connected: true, database: 'Cloud Firestore' });
}));
firebaseRoutes.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Firebase API:', err.message);
  const failure = apiErrorResponse(err);
  res.status(failure.status).json({ success: false, error: failure.message });
});
