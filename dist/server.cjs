var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_node_path = __toESM(require("node:path"), 1);
var import_vite = require("vite");

// server/app.ts
var import_node_crypto2 = __toESM(require("node:crypto"), 1);
var import_express2 = __toESM(require("express"), 1);

// server/domain.ts
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function apiErrorResponse(error) {
  if (error instanceof HttpError) return { status: error.status, message: error.message };
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Cloud Firestore API") && (message.includes("disabled") || message.includes("has not been used"))) {
    return { status: 503, message: "Cloud Firestore is not enabled for this Firebase project. Enable the Cloud Firestore API and create the default Firestore database in Firebase Console, then retry. If you just enabled it, allow a few minutes for activation." };
  }
  return { status: 500, message: "Server request failed. Check Firebase server configuration and logs." };
}
function text(value, label, max = 200, required = true) {
  if (typeof value !== "string" || required && !value.trim() || value.length > max) {
    throw new HttpError(400, `Invalid ${label}.`);
  }
  return value.trim();
}
function documentId(value) {
  const id = text(value, "document ID", 150);
  if (id.includes("/") || id === "." || id === "..") throw new HttpError(400, "Invalid document ID.");
  return id;
}
function amountInKobo(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e6 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-3) {
    throw new HttpError(400, "Enter a valid amount with at most two decimal places.");
  }
  return Math.round(amount * 100);
}
var profileFields = ["name", "stageName", "handle", "bio", "avatarUrl", "coverUrl", "phone", "instagramHandle", "twitterHandle", "genres", "defaultVenue", "minTipAmount", "qrTheme", "customQrTagline", "bankName", "bankCode", "accountNumber", "accountName"];
function profilePatch(input) {
  const patch = {};
  for (const key of profileFields) {
    if (input[key] === void 0) continue;
    if (key === "genres") {
      if (!Array.isArray(input[key]) || input[key].length > 20 || input[key].some((v) => typeof v !== "string" || v.length > 40)) throw new HttpError(400, "Invalid genres.");
      patch[key] = input[key];
    } else if (key === "minTipAmount") {
      const amount = Number(input[key]);
      if (!Number.isFinite(amount) || amount < 0 || amount > 1e6) throw new HttpError(400, "Invalid minimum tip.");
      patch[key] = amount;
    } else {
      patch[key] = text(input[key], key, key.endsWith("Url") ? 3e3 : 1e3, ["name", "stageName", "handle"].includes(key));
      if (key.endsWith("Url") && patch[key] && !/^https:\/\//.test(patch[key])) throw new HttpError(400, "Images must use HTTPS URLs.");
    }
  }
  if (patch.handle && !/^[a-z0-9_-]{3,40}$/.test(patch.handle)) throw new HttpError(400, "Use 3\u201340 lowercase letters, numbers, underscores or hyphens for your handle.");
  return patch;
}
function publicProfile(profile) {
  return Object.fromEntries(["id", "name", "stageName", "handle", "bio", "avatarUrl", "coverUrl", "genres", "defaultVenue", "minTipAmount", "qrTheme", "customQrTagline", "instagramHandle", "twitterHandle", "createdAt"].filter((k) => profile[k] !== void 0).map((k) => [k, profile[k]]));
}
function validateVerifiedPayment(payment, verified) {
  if (verified.status !== "success" || verified.currency !== "NGN" || verified.reference !== payment.reference || verified.amount !== payment.amountKobo || verified.metadata?.requestId !== payment.requestId) {
    throw new HttpError(400, "Payment details do not match this checkout.");
  }
}

// server/audio.ts
function decodeAudioDataUrl(value) {
  if (typeof value !== "string") throw new HttpError(400, "Upload a valid audio recording.");
  const match = /^data:(audio\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/]*={0,2})$/i.exec(value);
  if (!match) throw new HttpError(400, "Upload a valid base64 audio recording.");
  const mimeType = match[1].toLowerCase();
  const extensions = { "audio/webm": "webm", "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav", "audio/aac": "aac", "audio/flac": "flac" };
  if (!extensions[mimeType]) throw new HttpError(400, "Choose a WebM, MP4, MP3, Ogg, WAV, AAC, or FLAC recording.");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 15 * 1024 * 1024 || buffer.toString("base64").replace(/=+$/, "") !== match[2].replace(/=+$/, "")) throw new HttpError(400, "Audio must be valid and smaller than 15 MB.");
  return { buffer, mimeType, filename: `sample.${extensions[mimeType]}` };
}

// server/app.ts
var import_config = require("dotenv/config");

// src/services/queue.ts
function compareQueue(a, b) {
  return Number(b.status === "up_next") - Number(a.status === "up_next") || Number(b.priority) - Number(a.priority) || a.queuePosition - b.queuePosition || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}
function activeQueue(requests) {
  return requests.filter((r) => r.status === "pending" || r.status === "up_next").sort(compareQueue);
}

// server/firebaseRoutes.ts
var import_express = require("express");
var import_node_crypto = __toESM(require("node:crypto"), 1);
var import_firestore2 = require("firebase-admin/firestore");

// server/firebase.ts
var import_app = require("firebase-admin/app");
var import_auth = require("firebase-admin/auth");
var import_firestore = require("firebase-admin/firestore");
function adminApp() {
  if ((0, import_app.getApps)().length) return (0, import_app.getApps)()[0];
  const projectId = process.env.FIREBASE_PROJECT_ID || "vybecheck-6a8b7";
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return (0, import_app.initializeApp)({
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "vybecheck-6a8b7.firebasestorage.app",
    ...process.env.FIRESTORE_EMULATOR_HOST ? {} : {
      credential: serviceAccount ? (0, import_app.cert)(JSON.parse(serviceAccount)) : (0, import_app.applicationDefault)()
    }
  });
}
var adminAuth = () => (0, import_auth.getAuth)(adminApp());
var firestore = () => (0, import_firestore.getFirestore)(adminApp());

// server/firebaseRoutes.ts
var firebaseRoutes = (0, import_express.Router)();
var now = () => (/* @__PURE__ */ new Date()).toISOString();
var route = (fn) => (req, res, next) => void fn(req, res).catch(next);
async function identity(req) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Sign in to continue.");
  try {
    return await adminAuth().verifyIdToken(token, true);
  } catch {
    throw new HttpError(401, "Your session expired. Please sign in again.");
  }
}
async function owned(req, collection, id) {
  const user = await identity(req);
  const ref = firestore().collection(collection).doc(documentId(id));
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpError(404, "Record not found.");
  const data = snapshot.data();
  if ((collection === "djs" ? data.id : data.djId) !== user.uid) throw new HttpError(403, "You cannot modify this record.");
  return { ref, data, user };
}
var PaystackError = class extends HttpError {
  constructor(message, definitive, providerStatus) {
    super(502, message);
    this.definitive = definitive;
    this.providerStatus = providerStatus;
  }
};
async function paystack(path2, body) {
  if (!process.env.PAYSTACK_SECRET_KEY) throw new HttpError(503, "Payments are not configured.");
  const response = await fetch(`https://api.paystack.co${path2}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
    ...body ? { body: JSON.stringify(body) } : {},
    signal: AbortSignal.timeout(2e4)
  });
  const result = await response.json();
  if (!response.ok || !result.status) throw new PaystackError(
    result.message || "Paystack request failed.",
    response.status >= 400 && response.status < 500 && ![408, 409, 429].includes(response.status) && !/reference|duplicate|already/i.test(result.message || ""),
    response.status
  );
  return result.data;
}
function initialEvent(dj, id) {
  return {
    id,
    djId: dj.id,
    name: `${dj.stageName} Live Session`,
    slug: dj.handle,
    description: `Live requests for ${dj.stageName}`,
    djName: dj.stageName,
    djEmail: "",
    venue: dj.defaultVenue,
    eventDate: now(),
    createdAt: now(),
    isActive: true,
    requestsEnabled: true,
    publicQueueEnabled: true,
    autoPriority: true,
    tipsEnabled: true,
    minTip: dj.minTipAmount,
    maxTip: 1e6
  };
}
firebaseRoutes.post("/auth/profile", route(async (req, res) => {
  const user = await identity(req);
  const db = firestore();
  const djRef = db.collection("djs").doc(user.uid);
  const patch = profilePatch(req.body || {});
  const dj = await db.runTransaction(async (tx) => {
    const existing = await tx.get(djRef);
    if (existing.exists) return existing.data();
    if (!user.email) throw new HttpError(400, "An email address is required for your DJ account.");
    const handle = patch.handle || `dj-${user.uid.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24)}`;
    const handleRef = db.collection("handles").doc(handle);
    if ((await tx.get(handleRef)).exists) throw new HttpError(409, "This DJ handle is already taken. Choose another.");
    const profile = {
      name: user.name || user.email.split("@")[0],
      stageName: user.name || "DJ",
      handle,
      bio: "",
      avatarUrl: user.picture || "",
      genres: ["Afrobeats", "Amapiano"],
      defaultVenue: "Add your venue",
      minTipAmount: 1e4,
      ...patch,
      id: user.uid,
      email: user.email,
      authUserId: user.uid,
      isVerified: !!user.email_verified,
      availableBalance: 0,
      totalWithdrawn: 0,
      totalTipsEarned: 0,
      totalRequestsReceived: 0,
      totalSongsPlayed: 0,
      createdAt: now()
    };
    tx.create(djRef, profile);
    tx.create(handleRef, { djId: user.uid });
    tx.set(db.collection("public_djs").doc(user.uid), publicProfile(profile));
    tx.create(db.collection("events").doc(`initial-${user.uid}`), initialEvent(profile, `initial-${user.uid}`));
    return profile;
  });
  res.json({ success: true, dj });
}));
firebaseRoutes.put("/djs/:id", route(async (req, res) => {
  const { ref, user } = await owned(req, "djs", String(req.params.id));
  const patch = profilePatch(req.body);
  if (["bankCode", "accountNumber", "bankName"].some((key) => patch[key] !== void 0)) {
    if (patch.accountNumber || patch.bankCode || patch.bankName) {
      if (!/^\d{10}$/.test(patch.accountNumber || "") || !/^\d{3,10}$/.test(patch.bankCode || "")) throw new HttpError(400, "Select a bank and enter a 10-digit account number.");
      const banks = await paystack("/bank?country=nigeria");
      const bank = banks.find((b) => b.code === patch.bankCode);
      if (!bank) throw new HttpError(400, "Select a supported bank.");
      const account = await paystack(`/bank/resolve?account_number=${patch.accountNumber}&bank_code=${patch.bankCode}`);
      patch.bankName = bank.name;
      patch.accountName = account.account_name;
    } else patch.accountName = "";
  }
  const db = firestore();
  const dj = await db.runTransaction(async (tx) => {
    const old = (await tx.get(ref)).data();
    if (patch.handle && patch.handle !== old.handle) {
      const target = db.collection("handles").doc(patch.handle);
      if ((await tx.get(target)).exists) throw new HttpError(409, "This DJ handle is already taken.");
      tx.create(target, { djId: user.uid });
      tx.delete(db.collection("handles").doc(old.handle));
    }
    const updated = { ...old, ...patch };
    tx.update(ref, patch);
    tx.set(db.collection("public_djs").doc(user.uid), publicProfile(updated));
    return updated;
  });
  res.json({ success: true, dj });
}));
firebaseRoutes.post("/events", route(async (req, res) => {
  const user = await identity(req);
  const dj = (await firestore().collection("djs").doc(user.uid).get()).data();
  if (!dj) throw new HttpError(404, "Create your DJ profile first.");
  const ref = firestore().collection("events").doc();
  const event = { ...initialEvent(dj, ref.id), name: text(req.body.name, "event name"), venue: text(req.body.venue, "venue"), slug: `${dj.handle}-${ref.id}` };
  await ref.create(event);
  res.json({ success: true, event });
}));
firebaseRoutes.patch("/events/:id", route(async (req, res) => {
  const { ref } = await owned(req, "events", String(req.params.id));
  const patch = {};
  for (const key of ["isActive", "requestsEnabled", "publicQueueEnabled", "autoPriority", "tipsEnabled"]) {
    if (req.body[key] !== void 0) {
      if (typeof req.body[key] !== "boolean") throw new HttpError(400, `Invalid ${key}.`);
      patch[key] = req.body[key];
    }
  }
  for (const key of ["name", "venue", "description"]) if (req.body[key] !== void 0) patch[key] = text(req.body[key], key, 1e3, false);
  for (const key of ["minTip", "maxTip"]) if (req.body[key] !== void 0) {
    const n = Number(req.body[key]);
    if (!Number.isFinite(n) || n < 0 || n > 1e6) throw new HttpError(400, "Invalid tip limit.");
    patch[key] = n;
  }
  await ref.update(patch);
  res.json({ success: true });
}));
firebaseRoutes.post("/requests", route(async (req, res) => {
  if (req.body.honeypot) throw new HttpError(400, "Spam submission detected.");
  const eventId = documentId(req.body.eventId);
  const song = text(req.body.song, "song");
  const artist = text(req.body.artist, "artist");
  const db = firestore();
  const ref = db.collection("song_requests").doc();
  const eventRef = db.collection("events").doc(eventId);
  const request = await db.runTransaction(async (tx) => {
    const event = (await tx.get(eventRef)).data();
    if (!event?.isActive || !event.requestsEnabled) throw new HttpError(400, "This session is not accepting requests.");
    const djRef = db.collection("djs").doc(event.djId);
    const dj = (await tx.get(djRef)).data();
    if (!dj) throw new HttpError(404, "DJ not found.");
    const request2 = {
      id: ref.id,
      djId: event.djId,
      eventId,
      song,
      artist,
      genre: text(req.body.genre || "Other", "genre", 40),
      requesterName: text(req.body.requesterName || "Anonymous Fan", "name", 100),
      dedication: text(req.body.dedication || "", "dedication", 1e3, false),
      tipAmount: 0,
      priority: false,
      status: "pending",
      queuePosition: Date.now(),
      trackingToken: import_node_crypto.default.randomUUID(),
      createdAt: now(),
      updatedAt: now()
    };
    for (const key of ["artworkUrl", "previewUrl", "album"]) if (req.body[key]) request2[key] = text(req.body[key], key, 3e3);
    if (req.body.identifiedViaAudio === true) request2.identifiedViaAudio = true;
    if (Number.isFinite(req.body.audioConfidence)) request2.audioConfidence = req.body.audioConfidence;
    tx.create(ref, request2);
    tx.update(djRef, { totalRequestsReceived: import_firestore2.FieldValue.increment(1) });
    const notification = db.collection("notifications").doc();
    tx.create(notification, { id: notification.id, djId: event.djId, type: "new_request", title: "New song request", message: `${song} by ${artist}`, song, artist, read: false, timestamp: now() });
    return request2;
  });
  res.json({ success: true, request });
}));
firebaseRoutes.get("/requests/track/:token", route(async (req, res) => {
  const docs = await firestore().collection("song_requests").where("trackingToken", "==", documentId(req.params.token)).limit(1).get();
  if (docs.empty) throw new HttpError(404, "Request not found.");
  const request = docs.docs[0].data();
  const queue = await firestore().collection("song_requests").where("eventId", "==", request.eventId).get();
  const rank = activeQueue(queue.docs.map((d) => d.data())).findIndex((r) => r.id === request.id) + 1;
  res.json({ success: true, request: { ...request, queueRank: rank || null } });
}));
firebaseRoutes.patch("/requests/:id/status", route(async (req, res) => {
  const { ref, user } = await owned(req, "song_requests", String(req.params.id));
  const status = req.body.status;
  if (!["pending", "up_next", "playing", "played", "rejected"].includes(status)) throw new HttpError(400, "Invalid request status.");
  const db = firestore();
  await db.runTransaction(async (tx) => {
    const request = (await tx.get(ref)).data();
    const eventRef = db.collection("events").doc(request.eventId);
    const event = (await tx.get(eventRef)).data();
    const previousRef = event?.playingRequestId && event.playingRequestId !== ref.id ? db.collection("song_requests").doc(event.playingRequestId) : null;
    const previous = previousRef ? (await tx.get(previousRef)).data() : null;
    const rejectionReason = status === "rejected" ? text(req.body.reason || "", "rejection reason", 500, false) : "";
    const patch = { status, rejectionReason, updatedAt: now() };
    if (status === "playing") {
      patch.playingStartedAt = now();
      if (previous?.status === "playing" && previousRef) {
        tx.update(previousRef, { status: "played", playedAt: now(), updatedAt: now() });
        tx.update(db.collection("djs").doc(user.uid), { totalSongsPlayed: import_firestore2.FieldValue.increment(1) });
      }
      tx.update(eventRef, { playingRequestId: ref.id });
    } else if (event?.playingRequestId === ref.id) tx.update(eventRef, { playingRequestId: import_firestore2.FieldValue.delete() });
    if (status === "played") {
      patch.playedAt = now();
      if (request.status !== "played") tx.update(db.collection("djs").doc(user.uid), { totalSongsPlayed: import_firestore2.FieldValue.increment(1) });
    }
    tx.update(ref, patch);
    const history = db.collection("queue_history").doc();
    tx.create(history, { id: history.id, requestId: ref.id, djId: user.uid, song: request.song, artist: request.artist, action: status, note: rejectionReason, performer: user.uid, oldStatus: request.status, newStatus: status, createdAt: now() });
  });
  res.json({ success: true });
}));
firebaseRoutes.post("/requests/reorder", route(async (req, res) => {
  const user = await identity(req);
  if (!Array.isArray(req.body.orderedIds) || req.body.orderedIds.length > 450) throw new HttpError(400, "Invalid queue.");
  const ids = [...new Set(req.body.orderedIds.map(documentId))];
  const db = firestore();
  await db.runTransaction(async (tx) => {
    const refs = ids.map((id) => db.collection("song_requests").doc(id));
    const docs = refs.length ? await tx.getAll(...refs) : [];
    if (docs.some((d) => !d.exists || d.data()?.djId !== user.uid)) throw new HttpError(403, "You can only reorder your own requests.");
    docs.forEach((d, i) => tx.update(d.ref, { queuePosition: i + 1 }));
  });
  res.json({ success: true });
}));
firebaseRoutes.patch("/notifications/:id/read", route(async (req, res) => {
  const { ref } = await owned(req, "notifications", String(req.params.id));
  await ref.update({ read: true });
  res.json({ success: true });
}));
firebaseRoutes.post("/payments/initialize", route(async (req, res) => {
  const db = firestore();
  const requestId = documentId(req.body.requestId);
  const request = (await db.collection("song_requests").doc(requestId).get()).data();
  if (!request) throw new HttpError(404, "Song request not found.");
  const event = (await db.collection("events").doc(request.eventId).get()).data();
  const amountKobo = amountInKobo(req.body.amount);
  if (!event?.tipsEnabled || amountKobo < event.minTip * 100 || amountKobo > event.maxTip * 100) throw new HttpError(400, "Tip is outside this event\u2019s allowed range.");
  const email = text(req.body.customerEmail, "email", 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  const reference = `VYBE-${import_node_crypto.default.randomUUID()}`;
  await db.collection("payments").doc(reference).create({ id: reference, reference, requestId, eventId: request.eventId, djId: request.djId, amount: amountKobo / 100, amountKobo, currency: "NGN", customerEmail: email, status: "pending", createdAt: now() });
  const data = await paystack("/transaction/initialize", { email, amount: amountKobo, reference, currency: "NGN", metadata: { requestId, eventId: request.eventId, djId: request.djId } });
  res.json({ success: true, reference, accessCode: data.access_code, authorizationUrl: data.authorization_url });
}));
async function settlePayment(verified, requestedId, db = firestore()) {
  const ref = db.collection("payments").doc(documentId(verified.reference));
  return db.runTransaction(async (tx) => {
    const payment = (await tx.get(ref)).data();
    if (!payment || requestedId && requestedId !== payment.requestId) throw new HttpError(400, "Checkout not found for this request.");
    validateVerifiedPayment(payment, verified);
    if (payment.status === "success") return payment.amount;
    const requestRef = db.collection("song_requests").doc(payment.requestId);
    const request = (await tx.get(requestRef)).data();
    const djRef = db.collection("djs").doc(payment.djId);
    const dj = (await tx.get(djRef)).data();
    const event = request?.eventId ? (await tx.get(db.collection("events").doc(request.eventId))).data() : void 0;
    if (!request || !dj || request.djId !== payment.djId) throw new HttpError(400, "Checkout owner mismatch.");
    tx.update(ref, { status: "success", paidAt: now() });
    tx.update(requestRef, { tipAmount: import_firestore2.FieldValue.increment(payment.amount), priority: request.priority === true || event?.autoPriority === true, updatedAt: now() });
    tx.update(djRef, { availableBalance: import_firestore2.FieldValue.increment(payment.amount), totalTipsEarned: import_firestore2.FieldValue.increment(payment.amount) });
    const notification = db.collection("notifications").doc(`payment-${ref.id}`);
    tx.set(notification, { id: notification.id, djId: payment.djId, type: "tip_confirmed", title: "Tip confirmed", message: `\u20A6${payment.amount} received for ${request.song}`, song: request.song, artist: request.artist, tipAmount: payment.amount, timestamp: now(), read: false });
    return payment.amount;
  });
}
firebaseRoutes.post("/payments/verify", route(async (req, res) => {
  const reference = documentId(req.body.reference);
  const verified = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  const amount = await settlePayment(verified, documentId(req.body.requestId));
  res.json({ success: true, verified: true, amount });
}));
async function settleTransfer(reference, status, db = firestore()) {
  if (!["success", "failed", "reversed"].includes(status)) return;
  const ref = db.collection("payouts").doc(documentId(reference));
  await db.runTransaction(async (tx) => {
    const payout = (await tx.get(ref)).data();
    if (!payout || payout.status === "failed" || payout.status === "success" && status !== "reversed") return;
    const djRef = db.collection("djs").doc(payout.djId);
    const dj = (await tx.get(djRef)).data();
    if (!dj) throw new HttpError(404, "Payout owner missing.");
    const success = status === "success";
    tx.update(ref, { status: success ? "success" : "failed", processedAt: now(), ...success ? {} : { failureReason: status } });
    const cleared = dj.pendingPayoutReference === reference ? { pendingPayoutReference: import_firestore2.FieldValue.delete() } : {};
    if (success) tx.update(djRef, { ...cleared, totalWithdrawn: import_firestore2.FieldValue.increment(payout.amount) });
    else tx.update(djRef, { ...cleared, availableBalance: import_firestore2.FieldValue.increment(payout.amount), ...payout.status === "success" ? { totalWithdrawn: import_firestore2.FieldValue.increment(-payout.amount) } : {} });
  });
}
async function recordTransfer(reference, transfer, db = firestore()) {
  const ref = db.collection("payouts").doc(documentId(reference));
  const payout = (await ref.get()).data();
  if (!payout || transfer.reference !== reference || transfer.currency !== "NGN" || transfer.amount !== Math.round(payout.netAmount * 100)) throw new HttpError(502, "Transfer details do not match this payout.");
  await ref.update({ providerStatus: transfer.status, ...transfer.transfer_code ? { paystackTransferCode: transfer.transfer_code } : {}, lastCheckedAt: now() });
  await settleTransfer(reference, transfer.status, db);
}
async function reconcilePayout(reference, db = firestore()) {
  const transfer = await paystack(`/transfer/verify/${encodeURIComponent(documentId(reference))}`);
  await recordTransfer(reference, transfer, db);
}
firebaseRoutes.post("/payout/:reference/retry", route(async (req, res) => {
  const { ref, data } = await owned(req, "payouts", String(req.params.reference));
  if (data.status !== "processing") return res.json({ success: true, payout: data });
  try {
    await reconcilePayout(ref.id);
  } catch (error) {
    if (!(error instanceof PaystackError) || error.providerStatus !== 404) throw error;
    if (Date.now() - Date.parse(data.createdAt) < 12e4) throw new HttpError(409, "Allow two minutes for the original transfer to reach the provider, then check again.");
    if (!data.paystackRecipientCode) throw new HttpError(409, "Contact payout support to reconcile this transfer before retrying.");
    const transfer = await paystack("/transfer", { source: "balance", amount: Math.round(data.netAmount * 100), recipient: data.paystackRecipientCode, reference: ref.id, currency: "NGN", reason: "VybeCheck DJ withdrawal" });
    await recordTransfer(ref.id, transfer);
  }
  res.json({ success: true, payout: (await ref.get()).data() });
}));
firebaseRoutes.post("/payout/:reference/reconcile", route(async (req, res) => {
  const { ref, data } = await owned(req, "payouts", String(req.params.reference));
  if (data.status === "processing" || data.status === "pending") await reconcilePayout(ref.id);
  res.json({ success: true, payout: (await ref.get()).data() });
}));
firebaseRoutes.post("/payments/webhook", route(async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.headers["x-paystack-signature"];
  const raw = req.rawBody;
  if (!secret || typeof signature !== "string" || !/^[a-f0-9]{128}$/i.test(signature) || !raw) throw new HttpError(401, "Invalid webhook signature.");
  const expected = import_node_crypto.default.createHmac("sha512", secret).update(raw).digest();
  if (!import_node_crypto.default.timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new HttpError(401, "Invalid webhook signature.");
  const { event, data } = req.body;
  if (event === "charge.success") await settlePayment(data);
  if (["transfer.success", "transfer.failed", "transfer.reversed"].includes(event)) await settleTransfer(data.reference, event.split(".")[1]);
  res.json({ received: true });
}));
firebaseRoutes.get("/payout/banks", route(async (_req, res) => {
  const data = await paystack("/bank?country=nigeria");
  res.json({ success: true, banks: data.map((b) => ({ name: b.name, code: b.code, slug: b.slug })) });
}));
firebaseRoutes.post("/payout/resolve-account", route(async (req, res) => {
  await identity(req);
  const account = text(req.body.accountNumber, "account number", 10);
  if (!/^\d{10}$/.test(account)) throw new HttpError(400, "Enter a 10-digit bank account number.");
  const bank = text(req.body.bankCode, "bank code", 10);
  const data = await paystack(`/bank/resolve?account_number=${encodeURIComponent(account)}&bank_code=${encodeURIComponent(bank)}`);
  res.json({ success: true, accountName: data.account_name, accountNumber: data.account_number });
}));
firebaseRoutes.post("/payout/withdraw", route(async (req, res) => {
  const user = await identity(req);
  const amountKobo = amountInKobo(req.body.amount);
  if (amountKobo < 1e5) throw new HttpError(400, "Minimum withdrawal is \u20A61,000.");
  const accountNumber = text(req.body.accountNumber, "account number", 10);
  if (!/^\d{10}$/.test(accountNumber)) throw new HttpError(400, "Enter a 10-digit account number.");
  const bankCode = text(req.body.bankCode, "bank code", 10);
  const bankName = text(req.body.bankName, "bank name");
  const reference = documentId(req.body.reference);
  if (!/^payout-[a-f0-9-]{36}$/.test(reference)) throw new HttpError(400, "Invalid payout reference.");
  const db = firestore();
  const ref = db.collection("payouts").doc(reference);
  const djRef = db.collection("djs").doc(user.uid);
  const result = await db.runTransaction(async (tx) => {
    const existing = (await tx.get(ref)).data();
    if (existing) {
      if (existing.djId !== user.uid) throw new HttpError(403, "Invalid payout owner.");
      return { existing: true, payout: existing };
    }
    const dj = (await tx.get(djRef)).data();
    const amount = amountKobo / 100;
    if (!dj || !Number.isFinite(dj.availableBalance) || dj.availableBalance < amount) throw new HttpError(400, "Insufficient wallet balance.");
    if (dj.pendingPayoutReference) throw new HttpError(409, "Your previous payout is awaiting confirmation. Check your payout history before withdrawing again.");
    const payout2 = { id: reference, reference, djId: user.uid, amount, fee: 25, netAmount: amount - 25, currency: "NGN", bankCode, bankName, accountNumber, accountName: "", status: "processing", createdAt: now() };
    tx.create(ref, payout2);
    tx.update(djRef, { availableBalance: import_firestore2.FieldValue.increment(-amount), pendingPayoutReference: reference });
    return { existing: false, payout: payout2 };
  });
  if (!result.existing) {
    let transferAttempted = false;
    try {
      const account = await paystack(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
      const recipient = await paystack("/transferrecipient", { type: "nuban", name: account.account_name, account_number: accountNumber, bank_code: bankCode, currency: "NGN" });
      await ref.update({ accountName: account.account_name, paystackRecipientCode: recipient.recipient_code });
      transferAttempted = true;
      const transfer = await paystack("/transfer", { source: "balance", amount: amountKobo - 2500, recipient: recipient.recipient_code, reference, reason: "VybeCheck DJ withdrawal" });
      await recordTransfer(reference, transfer, db);
    } catch (error) {
      if (!transferAttempted || error instanceof PaystackError && error.definitive) await settleTransfer(reference, "failed");
      else await ref.update({ failureReason: "Transfer awaiting provider confirmation. Do not retry with a new reference." });
    }
  }
  if (result.existing && result.payout.status === "processing") await reconcilePayout(reference, db);
  const payout = (await ref.get()).data();
  const wallet = (await djRef.get()).data();
  res.json({ success: true, payout, wallet: { availableBalance: wallet?.availableBalance, totalWithdrawn: wallet?.totalWithdrawn } });
}));
firebaseRoutes.get("/payout/history/:djId", route(async (req, res) => {
  const user = await identity(req);
  if (req.params.djId !== user.uid) throw new HttpError(403, "Not your wallet.");
  const docs = await firestore().collection("payouts").where("djId", "==", user.uid).get();
  res.json({ success: true, payouts: docs.docs.map((d) => d.data()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
}));
firebaseRoutes.get("/firebase/status", route(async (_req, res) => {
  await firestore().collection("events").limit(1).get();
  res.json({ success: true, connected: true, database: "Cloud Firestore" });
}));
firebaseRoutes.use((err, _req, res, _next) => {
  console.error("Firebase API:", err.message);
  const failure = apiErrorResponse(err);
  res.status(failure.status).json({ success: false, error: failure.message });
});

// server/app.ts
var app = (0, import_express2.default)();
app.use(import_express2.default.json({ limit: "25mb", verify: (req, _res, buffer) => {
  req.rawBody = buffer;
} }));
app.use(import_express2.default.urlencoded({ extended: true, limit: "25mb" }));
app.use("/api", firebaseRoutes);
function mapGenre(rawGenre = "", song = "", artist = "") {
  const combined = `${rawGenre} ${song} ${artist}`.toLowerCase();
  if (combined.includes("amapiano") || combined.includes("kabza") || combined.includes("tyler icu") || combined.includes("kelvin momo") || combined.includes("young stunna") || combined.includes("focalistic") || combined.includes("musa keys") || combined.includes("txc") || combined.includes("tito m")) {
    return "Amapiano";
  }
  if (combined.includes("3 step") || combined.includes("3-step") || combined.includes("thakzin") || combined.includes("oskar") || combined.includes("m\xF6rda") || combined.includes("shimza")) {
    return "3 STEP SA";
  }
  if (combined.includes("afro house") || combined.includes("afro-house") || combined.includes("zakes") || combined.includes("black coffee") || combined.includes("sun-el") || combined.includes("caiiro") || combined.includes("da capo") || combined.includes("house")) {
    return "Afro House";
  }
  if (combined.includes("afrobeats") || combined.includes("afropop") || combined.includes("afro-pop") || combined.includes("burna") || combined.includes("wizkid") || combined.includes("davido") || combined.includes("asake") || combined.includes("rema") || combined.includes("ayra starr") || combined.includes("shallipopi") || combined.includes("omah lay") || combined.includes("seyi vibez") || combined.includes("ruger") || combined.includes("victony") || combined.includes("kizz daniel") || combined.includes("tiwa savage") || combined.includes("odumodublvck")) {
    return "Afrobeats";
  }
  if (combined.includes("dancehall") || combined.includes("reggae") || combined.includes("popcaan") || combined.includes("shenseea") || combined.includes("vybz")) {
    return "Dancehall";
  }
  if (combined.includes("hip hop") || combined.includes("hip-hop") || combined.includes("rap") || combined.includes("trap")) {
    return "Hip Hop";
  }
  if (combined.includes("r&b") || combined.includes("soul")) {
    return "R&B";
  }
  if (combined.includes("electronic") || combined.includes("edm") || combined.includes("techno")) {
    return "Electronic";
  }
  return "Afrobeats";
}
app.get("/api/music/search", async (req, res) => {
  try {
    const query = (req.query.q || "").trim();
    if (!query || query.length < 2) {
      return res.json({ results: [] });
    }
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 20);
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}&media=music`;
    const itunesRes = await fetch(searchUrl, {
      headers: { "Accept": "application/json" }
    });
    if (!itunesRes.ok) {
      throw new Error(`iTunes API responded with status ${itunesRes.status}`);
    }
    const itunesData = await itunesRes.json();
    const items = itunesData.results || [];
    const formattedTracks = items.map((item) => {
      const artwork = (item.artworkUrl100 || "").replace("100x100bb", "600x600bb").replace("100x100", "600x600");
      return {
        id: `track-${item.trackId || item.collectionId || Math.random().toString(36).substring(2, 8)}`,
        song: item.trackName || item.collectionName || query,
        artist: item.artistName || "Unknown Artist",
        genre: mapGenre(item.primaryGenreName, item.trackName, item.artistName),
        album: item.collectionName || "",
        artworkUrl: artwork,
        previewUrl: item.previewUrl || "",
        releaseYear: item.releaseDate ? new Date(item.releaseDate).getFullYear() : void 0,
        durationMs: item.trackTimeMillis || 0
      };
    });
    return res.json({ results: formattedTracks });
  } catch (error) {
    console.error("Error searching music catalog:", error.message);
    return res.status(500).json({ error: "Failed to search music catalog", details: error.message });
  }
});
app.get("/api/music/suggestions", async (req, res) => {
  try {
    const defaultQueries = ["Burna Boy", "Tyla Amapiano", "Asake", "Shallipopi", "Davido", "Tyler ICU"];
    const randomTerm = defaultQueries[Math.floor(Math.random() * defaultQueries.length)];
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(randomTerm)}&entity=song&limit=8&media=music`;
    const itunesRes = await fetch(searchUrl);
    if (itunesRes.ok) {
      const data = await itunesRes.json();
      const tracks = (data.results || []).map((item) => ({
        id: `trend-${item.trackId}`,
        song: item.trackName,
        artist: item.artistName,
        genre: mapGenre(item.primaryGenreName, item.trackName, item.artistName),
        album: item.collectionName,
        artworkUrl: (item.artworkUrl100 || "").replace("100x100bb", "600x600bb"),
        previewUrl: item.previewUrl,
        releaseYear: item.releaseDate ? new Date(item.releaseDate).getFullYear() : void 0
      }));
      return res.json({ suggestions: tracks });
    }
    return res.json({ suggestions: [] });
  } catch (err) {
    return res.json({ suggestions: [] });
  }
});
app.post("/api/music/identify", async (req, res) => {
  try {
    const { audioData } = req.body;
    if (!audioData) {
      return res.status(400).json({ error: "Please provide audio data." });
    }
    const host = process.env.ACR_HOST || "identify-eu-west-1.acrcloud.com";
    const accessKey = process.env.ACR_ACCESS_KEY;
    const accessSecret = process.env.ACR_ACCESS_SECRET;
    if (!accessKey || !accessSecret) {
      console.error("CRITICAL ERROR: ACRCloud keys missing in .env");
      return res.status(500).json({ error: "Audio recognition engine offline. Check server environment variables." });
    }
    const { buffer: audioBuffer, mimeType, filename } = decodeAudioDataUrl(audioData);
    const timestamp = Math.floor(Date.now() / 1e3).toString();
    const signatureVersion = "1";
    const dataType = "audio";
    const stringToSign = ["POST", "/v1/identify", accessKey, dataType, signatureVersion, timestamp].join("\n");
    const signature = import_node_crypto2.default.createHmac("sha1", accessSecret).update(Buffer.from(stringToSign, "utf-8")).digest("base64");
    const formData = new FormData();
    formData.append("sample", new Blob([audioBuffer], { type: mimeType }), filename);
    formData.append("sample_bytes", audioBuffer.length.toString());
    formData.append("access_key", accessKey);
    formData.append("data_type", dataType);
    formData.append("signature_version", signatureVersion);
    formData.append("signature", signature);
    formData.append("timestamp", timestamp);
    const acrResponse = await fetch(`https://${host}/v1/identify`, {
      method: "POST",
      body: formData
    });
    const data = await acrResponse.json();
    if (data.status?.code === 0 && data.metadata && data.metadata.music) {
      const track = data.metadata.music[0];
      const songName = track.title;
      const artistName = track.artists ? track.artists[0].name : "Unknown Artist";
      let finalArtworkUrl = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80";
      let audioPreviewUrl = "";
      let releaseYear = (/* @__PURE__ */ new Date()).getFullYear();
      try {
        const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(`${songName} ${artistName}`)}&entity=song&limit=1`;
        const catRes = await fetch(searchUrl);
        if (catRes.ok) {
          const catData = await catRes.json();
          if (catData.results && catData.results.length > 0) {
            finalArtworkUrl = (catData.results[0].artworkUrl100 || "").replace("100x100bb", "600x600bb");
            audioPreviewUrl = catData.results[0].previewUrl || "";
            if (catData.results[0].releaseDate) {
              releaseYear = new Date(catData.results[0].releaseDate).getFullYear();
            }
          }
        }
      } catch (catErr) {
        console.warn("Could not fetch Apple Music artwork, defaulting to placeholder.");
      }
      return res.json({
        success: true,
        track: {
          song: songName,
          artist: artistName,
          genre: mapGenre(track.genres ? track.genres[0].name : "", songName, artistName),
          album: track.album ? track.album.name : "Single",
          artworkUrl: finalArtworkUrl,
          previewUrl: audioPreviewUrl,
          releaseYear,
          confidence: track.score || 100,
          matchNotes: "Acoustic fingerprint matched perfectly."
        }
      });
    }
    return res.status(400).json({
      success: false,
      error: "No match found. The club might be too loud, get closer to the speaker."
    });
  } catch (error) {
    console.error("ACRCloud error:", error.message);
    return res.status(error instanceof HttpError ? error.status : 500).json({ success: false, error: error instanceof HttpError ? error.message : "Internal server error processing audio." });
  }
});
app.get("/api/health", (_req, res) => res.json({ status: "ok", database: "Cloud Firestore" }));
app.use("/api", (_req, res) => res.status(404).json({ success: false, error: "Endpoint not found." }));
var app_default = app;

// server.ts
var import_express3 = __toESM(require("express"), 1);
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({ server: { middlewareMode: true }, appType: "spa" });
    app_default.use(vite.middlewares);
  } else {
    const dist = import_node_path.default.join(process.cwd(), "dist");
    app_default.use(import_express3.default.static(dist));
    app_default.get("*", (_req, res) => res.sendFile(import_node_path.default.join(dist, "index.html")));
  }
  const port = Number(process.env.PORT || 3e3);
  app_default.listen(port, "0.0.0.0", () => console.log(`VybeCheck running at http://localhost:${port} with Firebase`));
}
void start();
//# sourceMappingURL=server.cjs.map
