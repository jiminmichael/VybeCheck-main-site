import 'dotenv/config';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import initSqlJs from 'sql.js';
import { getStorage } from 'firebase-admin/storage';
import { adminApp, adminAuth, firestore } from '../server/firebase';
import { publicProfile } from '../server/domain';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const source = args.find(a => a.startsWith('--source='))?.split('=')[1];
const tables = ['djs', 'events', 'song_requests', 'payments', 'payouts', 'notifications', 'queue_history', 'email_logs'];
if (!['sqlite', 'supabase'].includes(source || '')) throw new Error('Choose --source=sqlite or --source=supabase. Dry run is the default; --apply writes to Firebase.');
if (apply && args.find(a => a.startsWith('--project='))?.split('=')[1] !== (process.env.FIREBASE_PROJECT_ID || 'vybecheck-6a8b7')) throw new Error('Pass --project=vybecheck-6a8b7 explicitly to confirm the migration destination.');

const records: Record<string, any[]> = {};
if (source === 'sqlite') {
  const SQL = await initSqlJs();
  const path = args.find(a => a.startsWith('--file='))?.slice(7) || 'vybecheck.sqlite';
  const sqlite = new SQL.Database(await fs.readFile(path));
  for (const table of tables) {
    const exists = sqlite.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`);
    if (!exists.length) { records[table] = []; continue; }
    const result = sqlite.exec(`SELECT * FROM ${table}`)[0];
    records[table] = result ? result.values.map(values => Object.fromEntries(result.columns.map((column, i) => [column, values[i]]))) : [];
  }
  sqlite.close();
} else {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Source export requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment.');
  for (const table of tables) {
    records[table] = [];
    for (let offset = 0; ; offset += 1000) {
      const response = await fetch(`${url}/rest/v1/${table}?select=*&order=id.asc&limit=1000&offset=${offset}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (response.status === 404 && table === 'email_logs') break;
      if (!response.ok) throw new Error(`Source export failed for ${table}: HTTP ${response.status}`);
      const rows = await response.json();
      records[table].push(...rows);
      if (rows.length < 1000) break;
    }
  }
}
const sensitive = new Set(['password', 'passwordHash', 'accessToken', 'refreshToken']);
const booleans = new Set(['isActive', 'requestsEnabled', 'publicQueueEnabled', 'autoPriority', 'tipsEnabled', 'priority', 'identifiedViaAudio', 'read', 'isVerified']);
function normalize(row: any) {
  const result: Record<string, any> = {};
  for (const [original, value] of Object.entries(row)) {
    const key = original.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (sensitive.has(key) || value === null) continue;
    result[key] = booleans.has(key) ? value === true || value === 1 || value === 'true' : value;
  }
  if (typeof result.genres === 'string') result.genres = JSON.parse(result.genres);
  for (const key of ['availableBalance', 'totalWithdrawn', 'totalTipsEarned', 'totalRequestsReceived', 'totalSongsPlayed', 'minTipAmount', 'tipAmount', 'queuePosition', 'minTip', 'maxTip', 'amount', 'fee', 'netAmount']) if (result[key] !== undefined) result[key] = Number(result[key]);
  return result;
}
for (const table of tables) records[table] = records[table].map(normalize);
const djs = records.djs;
const ids = new Map<string, string>();
const handles = new Set<string>();
const emails = new Set<string>();
for (const dj of djs) {
  if (!dj.email || !dj.handle || !dj.id) throw new Error('A source DJ is missing an ID, email, or handle. Repair the source first.');
  const email = dj.email.toLowerCase().trim();
  if (emails.has(email) || handles.has(dj.handle.toLowerCase())) throw new Error('Duplicate source DJ email or handle. Resolve before importing.');
  emails.add(email); handles.add(dj.handle.toLowerCase());
  ids.set(dj.id, dj.authUserId || `migrated-${crypto.createHash('sha256').update(`${source}:${dj.id}`).digest('hex').slice(0, 28)}`);
}
// Preserve unlinked historical rows outside active collections for reconciliation.
const orphaned: { table: string; record: any; reason: string }[] = [];
const eventIds = new Set(records.events.map(row => row.id));
const requestIds = new Set(records.song_requests.map(row => row.id));
for (const table of tables.filter(table => table !== 'djs')) {
  records[table] = records[table].filter(row => {
    let reason = '';
    if (['events', 'song_requests', 'payouts', 'notifications'].includes(table) && !ids.has(row.djId)) reason = 'Missing DJ';
    if (table === 'song_requests' && !eventIds.has(row.eventId)) reason = 'Missing event';
    if (['payments', 'queue_history'].includes(table) && !requestIds.has(row.requestId)) reason = 'Missing request';
    if (reason) {
      orphaned.push({ table, record: row, reason });
      if (table === 'events') eventIds.delete(row.id);
      if (table === 'song_requests') requestIds.delete(row.id);
    }
    return !reason;
  });
}
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', source, destination: process.env.FIREBASE_PROJECT_ID || 'vybecheck-6a8b7', counts: Object.fromEntries(tables.map(t => [t, records[t].length])), orphanedRecords: orphaned.map(row => ({ table: row.table, reason: row.reason })), passwordMigration: 'Passwords and legacy login tokens are excluded. Existing email users must reset their Firebase password.' }, null, 2));
if (!apply) process.exit(0);

const db = firestore();
const auth = adminAuth();
const report: Record<string, number> = { created: 0, skipped: 0 };
async function createIfMissing(table: string, id: string, data: any) {
  if (!id || id.includes('/')) throw new Error(`Invalid destination document ID in ${table}.`);
  try { await db.collection(table).doc(id).create(data); report.created++; }
  catch (error: any) { if (error.code === 6) report.skipped++; else throw error; }
}
async function migrateImage(uid: string, type: string, value?: string) {
  if (!value) return '';
  const supabaseOrigin = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  let buffer: Buffer;
  let contentType: string;
  if (value.startsWith('data:image/')) {
    const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s);
    if (!match) throw new Error('Unsupported profile image. Convert to JPEG, PNG, or WebP.');
    contentType = match[1]; buffer = Buffer.from(match[2], 'base64');
  } else if (supabaseOrigin && value.startsWith(`${supabaseOrigin}/storage/v1/object/`)) {
    const response = await fetch(value);
    if (!response.ok) throw new Error('Could not download a source profile image.');
    contentType = response.headers.get('content-type')?.split(';')[0] || '';
    if (!/^image\/(png|jpeg|webp)$/.test(contentType)) throw new Error('Unsupported source image type.');
    buffer = Buffer.from(await response.arrayBuffer());
  } else return value; // Third-party catalog/preset links are references, not owned storage.
  if (buffer.length > 5 * 1024 * 1024) throw new Error('Profile image exceeds 5 MB.');
  const bucket = getStorage(adminApp()).bucket();
  const objectPath = `profiles/${uid}/migrated-${type}-${crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)}`;
  const file = bucket.file(objectPath);
  let token: string;
  if ((await file.exists())[0]) token = String((await file.getMetadata())[0].metadata?.firebaseStorageDownloadTokens);
  else {
    token = crypto.randomUUID();
    await file.save(buffer, { metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } } });
  }
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}
for (const dj of djs) {
  let uid = ids.get(dj.id)!;
  let user;
  try { user = await auth.getUserByEmail(dj.email.toLowerCase()); uid = user.uid; }
  catch (error: any) {
    if (error.code !== 'auth/user-not-found') throw error;
    user = await auth.createUser({ uid, email: dj.email.toLowerCase(), displayName: dj.name || dj.stageName, emailVerified: false });
  }
  ids.set(dj.id, uid);
  const handleRef = db.collection('handles').doc(dj.handle.toLowerCase());
  const existingHandle = (await handleRef.get()).data();
  if (existingHandle && existingHandle.djId !== uid) throw new Error('Destination handle is already owned by another user.');
  const existing = await db.collection('djs').doc(uid).get();
  if (existing.exists) {
    // Never merge a pre-existing wallet silently; only rerun an import from this source ID.
    if (existing.data()?.migrationSource !== `${source}:${dj.id}`) throw new Error('Destination profile already exists outside this migration. Reconcile its wallet before importing.');
  }
  const profile = { bio: '', genres: [], defaultVenue: 'Add your venue', minTipAmount: 10000,
    availableBalance: 0, totalWithdrawn: 0, totalTipsEarned: 0, totalRequestsReceived: 0, totalSongsPlayed: 0,
    createdAt: new Date().toISOString(), ...dj, id: uid, authUserId: uid, email: user.email, handle: dj.handle.toLowerCase(), isVerified: user.emailVerified,
    migrationSource: `${source}:${dj.id}`, avatarUrl: await migrateImage(uid, 'avatar', dj.avatarUrl), coverUrl: await migrateImage(uid, 'cover', dj.coverUrl) };
  await createIfMissing('djs', uid, profile);
  await createIfMissing('handles', profile.handle, { djId: uid });
  await createIfMissing('public_djs', uid, publicProfile(profile));
}
const requestMap = new Map(records.song_requests.map(r => [r.id, r]));
for (const table of tables.filter(t => t !== 'djs')) {
  for (const row of records[table]) {
    if (row.djId) row.djId = ids.get(row.djId);
    if (table === 'events') row.djEmail = '';
    if (table === 'payments' || table === 'queue_history') {
      const request = requestMap.get(row.requestId);
      // Requests may already have their djId translated by the loop above.
      row.djId ||= ids.get(request?.djId) || request?.djId;
      if (!row.djId) throw new Error(`${table} has an orphaned request. Resolve before importing.`);
    }
    if (table === 'payments') row.amountKobo = Math.round(row.amount * 100);
    const id = ['payments', 'payouts'].includes(table) ? row.reference : row.id;
    await createIfMissing(table, id, { ...row, id });
  }
}
for (const item of orphaned) {
  const id = crypto.createHash('sha256').update(`${source}:${item.table}:${item.record.id}`).digest('hex');
  await createIfMissing('migration_orphans', id, { ...item, source });
}
console.log(JSON.stringify({ complete: true, quarantined: orphaned.length, ...report }));
