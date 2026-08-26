import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: any = null;
const DB_FILE = path.join(process.cwd(), 'vybecheck.sqlite');

export async function getDb() {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  let buffer: Buffer | null = null;

  if (fs.existsSync(DB_FILE)) {
    try {
      buffer = fs.readFileSync(DB_FILE);
    } catch (e) {
      console.warn('Could not read existing database file, creating fresh one:', e);
    }
  }

  dbInstance = buffer ? new SQL.Database(buffer) : new SQL.Database();
  initSchema(dbInstance);
  saveDb();
  return dbInstance;
}

export function saveDb() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to save SQLite database to file:', err);
  }
}

export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(sql: string, params: any[] = []): Promise<void> {
  const db = await getDb();
  db.run(sql, params);
  saveDb();
}

function initSchema(db: any) {
  db.run(`
    CREATE TABLE IF NOT EXISTS djs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      stageName TEXT NOT NULL,
      handle TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      bio TEXT,
      avatarUrl TEXT,
      coverUrl TEXT,
      phone TEXT,
      instagramHandle TEXT,
      twitterHandle TEXT,
      genres TEXT,
      defaultVenue TEXT,
      bankName TEXT,
      accountNumber TEXT,
      accountName TEXT,
      bankCode TEXT,
      paystackRecipientCode TEXT,
      minTipAmount REAL DEFAULT 10000,
      qrTheme TEXT DEFAULT 'cyber-cyan',
      customQrTagline TEXT,
      isVerified INTEGER DEFAULT 1,
      availableBalance REAL DEFAULT 0,
      totalWithdrawn REAL DEFAULT 0,
      totalTipsEarned REAL DEFAULT 0,
      totalRequestsReceived INTEGER DEFAULT 0,
      totalSongsPlayed INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payouts (
      id TEXT PRIMARY KEY,
      djId TEXT NOT NULL,
      reference TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      fee REAL DEFAULT 0,
      netAmount REAL NOT NULL,
      currency TEXT DEFAULT 'NGN',
      bankName TEXT NOT NULL,
      accountNumber TEXT NOT NULL,
      accountName TEXT NOT NULL,
      bankCode TEXT,
      paystackTransferCode TEXT,
      status TEXT DEFAULT 'success',
      failureReason TEXT,
      createdAt TEXT NOT NULL,
      processedAt TEXT,
      FOREIGN KEY (djId) REFERENCES djs(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      djId TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      djName TEXT NOT NULL,
      djEmail TEXT NOT NULL,
      venue TEXT NOT NULL,
      eventDate TEXT NOT NULL,
      isActive INTEGER DEFAULT 1,
      requestsEnabled INTEGER DEFAULT 1,
      publicQueueEnabled INTEGER DEFAULT 1,
      autoPriority INTEGER DEFAULT 1,
      tipsEnabled INTEGER DEFAULT 1,
      minTip REAL DEFAULT 10000,
      maxTip REAL DEFAULT 1000000,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (djId) REFERENCES djs(id)
    );

    CREATE TABLE IF NOT EXISTS song_requests (
      id TEXT PRIMARY KEY,
      eventId TEXT NOT NULL,
      djId TEXT NOT NULL,
      song TEXT NOT NULL,
      artist TEXT NOT NULL,
      genre TEXT NOT NULL,
      requesterName TEXT,
      dedication TEXT,
      tipAmount REAL DEFAULT 0,
      priority INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      queuePosition INTEGER DEFAULT 0,
      trackingToken TEXT UNIQUE NOT NULL,
      ipAddress TEXT,
      artworkUrl TEXT,
      previewUrl TEXT,
      album TEXT,
      identifiedViaAudio INTEGER DEFAULT 0,
      audioConfidence REAL,
      playingStartedAt TEXT,
      playedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (eventId) REFERENCES events(id),
      FOREIGN KEY (djId) REFERENCES djs(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      requestId TEXT NOT NULL,
      eventId TEXT NOT NULL,
      reference TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'NGN',
      status TEXT DEFAULT 'pending',
      customerEmail TEXT,
      createdAt TEXT NOT NULL,
      paidAt TEXT,
      FOREIGN KEY (requestId) REFERENCES song_requests(id)
    );

    CREATE TABLE IF NOT EXISTS queue_history (
      id TEXT PRIMARY KEY,
      requestId TEXT NOT NULL,
      song TEXT NOT NULL,
      artist TEXT NOT NULL,
      action TEXT NOT NULL,
      performer TEXT NOT NULL,
      oldStatus TEXT,
      newStatus TEXT,
      note TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      djId TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      song TEXT,
      artist TEXT,
      tipAmount REAL,
      timestamp TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      FOREIGN KEY (djId) REFERENCES djs(id)
    );

    CREATE TABLE IF NOT EXISTS magic_links (
      token TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      email TEXT NOT NULL,
      djId TEXT,
      createdAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      used INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      toEmail TEXT NOT NULL,
      subject TEXT NOT NULL,
      type TEXT NOT NULL,
      sentAt TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `);

  // Run soft migrations for existing SQLite database files
  try { db.run('ALTER TABLE djs ADD COLUMN availableBalance REAL DEFAULT 0'); } catch (e) {}
  try { db.run('ALTER TABLE djs ADD COLUMN totalWithdrawn REAL DEFAULT 0'); } catch (e) {}
  try { db.run('ALTER TABLE djs ADD COLUMN bankCode TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE djs ADD COLUMN paystackRecipientCode TEXT'); } catch (e) {}

}
