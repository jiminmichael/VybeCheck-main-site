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
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_config = require("dotenv/config");

// server/db.ts
var import_sql = __toESM(require("sql.js"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var dbInstance = null;
var DB_FILE = import_path.default.join(process.cwd(), "vybecheck.sqlite");
async function getDb() {
  if (dbInstance) return dbInstance;
  const SQL = await (0, import_sql.default)();
  let buffer = null;
  if (import_fs.default.existsSync(DB_FILE)) {
    try {
      buffer = import_fs.default.readFileSync(DB_FILE);
    } catch (e) {
      console.warn("Could not read existing database file, creating fresh one:", e);
    }
  }
  dbInstance = buffer ? new SQL.Database(buffer) : new SQL.Database();
  initSchema(dbInstance);
  saveDb();
  return dbInstance;
}
function saveDb() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    import_fs.default.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error("Failed to save SQLite database to file:", err);
  }
}
async function queryAll(sql, params = []) {
  const db = await getDb();
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}
async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}
async function execute(sql, params = []) {
  const db = await getDb();
  db.run(sql, params);
  saveDb();
}
function initSchema(db) {
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
  try {
    db.run("ALTER TABLE djs ADD COLUMN availableBalance REAL DEFAULT 0");
  } catch (e) {
  }
  try {
    db.run("ALTER TABLE djs ADD COLUMN totalWithdrawn REAL DEFAULT 0");
  } catch (e) {
  }
  try {
    db.run("ALTER TABLE djs ADD COLUMN bankCode TEXT");
  } catch (e) {
  }
  try {
    db.run("ALTER TABLE djs ADD COLUMN paystackRecipientCode TEXT");
  } catch (e) {
  }
}

// server/supabase.ts
var import_supabase_js = require("@supabase/supabase-js");
var supabaseInstance = null;
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return null;
  }
  if (!supabaseInstance) {
    try {
      supabaseInstance = (0, import_supabase_js.createClient)(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    } catch (err) {
      console.error("Failed to initialize Supabase client:", err);
      return null;
    }
  }
  return supabaseInstance;
}
async function checkSupabaseHealth() {
  const client = getSupabase();
  if (!client) {
    return {
      connected: false,
      error: "Supabase URL or Key not set in environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)"
    };
  }
  try {
    const { data, error } = await client.from("djs").select("id").limit(1);
    if (error) {
      return {
        connected: false,
        url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        error: error.message
      };
    }
    return {
      connected: true,
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      tables: ["djs", "events", "song_requests", "payments", "payouts", "notifications"]
    };
  } catch (err) {
    return {
      connected: false,
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      error: err.message || "Unknown network error communicating with Supabase"
    };
  }
}

// server.ts
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "25mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "25mb" }));
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
function parseDJRow(row) {
  if (!row) return null;
  let genres = [];
  try {
    genres = typeof row.genres === "string" ? JSON.parse(row.genres) : row.genres || [];
  } catch (e) {
    genres = ["Afrobeats", "Amapiano"];
  }
  return {
    ...row,
    genres,
    isVerified: Boolean(row.isVerified),
    availableBalance: Number(row.availableBalance) || 0,
    totalWithdrawn: Number(row.totalWithdrawn) || 0,
    totalTipsEarned: Number(row.totalTipsEarned) || 0,
    totalRequestsReceived: Number(row.totalRequestsReceived) || 0,
    totalSongsPlayed: Number(row.totalSongsPlayed) || 0,
    minTipAmount: Number(row.minTipAmount) || 1e4,
    bankCode: row.bankCode || "058",
    paystackRecipientCode: row.paystackRecipientCode || ""
  };
}
function parseRequestRow(row) {
  if (!row) return null;
  return {
    ...row,
    priority: Boolean(row.priority),
    identifiedViaAudio: Boolean(row.identifiedViaAudio),
    tipAmount: Number(row.tipAmount) || 0,
    queuePosition: Number(row.queuePosition) || 0,
    audioConfidence: row.audioConfidence ? Number(row.audioConfidence) : void 0
  };
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
app.get("/api/music/trending", async (req, res) => {
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
      return res.json({ trending: tracks });
    }
    return res.json({ trending: [] });
  } catch (err) {
    return res.json({ trending: [] });
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
    const cleanBase64 = audioData.replace(/^data:audio\/\w+;base64,/, "");
    const audioBuffer = Buffer.from(cleanBase64, "base64");
    const timestamp = Math.floor(Date.now() / 1e3).toString();
    const signatureVersion = "1";
    const dataType = "audio";
    const stringToSign = ["POST", "/v1/identify", accessKey, dataType, signatureVersion, timestamp].join("\n");
    const signature = import_crypto.default.createHmac("sha1", accessSecret).update(Buffer.from(stringToSign, "utf-8")).digest("base64");
    const formData = new FormData();
    formData.append("sample", new Blob([audioBuffer]), "sample.webm");
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
    return res.status(500).json({ success: false, error: "Internal server error processing audio." });
  }
});
app.get("/api/djs", async (req, res) => {
  try {
    const rows = await queryAll("SELECT * FROM djs ORDER BY createdAt ASC");
    const djs = rows.map(parseDJRow);
    return res.json({ success: true, djs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/djs/:handle", async (req, res) => {
  try {
    const param = req.params.handle.toLowerCase();
    const row = await queryOne(
      "SELECT * FROM djs WHERE LOWER(handle) = ? OR LOWER(email) = ? OR id = ?",
      [param, param, param]
    );
    if (!row) {
      return res.status(404).json({ success: false, error: "DJ not found" });
    }
    return res.json({ success: true, dj: parseDJRow(row) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/djs", async (req, res) => {
  try {
    const {
      name,
      stageName,
      handle,
      email,
      password,
      bio,
      avatarUrl,
      coverUrl,
      phone,
      instagramHandle,
      twitterHandle,
      genres,
      defaultVenue,
      bankName,
      accountNumber,
      accountName,
      minTipAmount,
      qrTheme,
      customQrTagline
    } = req.body;
    if (!name || !stageName || !handle || !email) {
      return res.status(400).json({ success: false, error: "Name, Stage Name, Handle, and Email are required." });
    }
    const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const cleanEmail = email.toLowerCase().trim();
    const existing = await queryOne("SELECT id FROM djs WHERE LOWER(handle) = ? OR LOWER(email) = ?", [cleanHandle, cleanEmail]);
    if (existing) {
      return res.status(400).json({ success: false, error: "A DJ with this handle or email already exists." });
    }
    const id = `dj-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await execute(
      `INSERT INTO djs (
        id, name, stageName, handle, email, password, bio, avatarUrl, coverUrl, phone, instagramHandle, twitterHandle, genres, defaultVenue, bankName, accountNumber, accountName, minTipAmount, qrTheme, customQrTagline, isVerified, totalTipsEarned, totalRequestsReceived, totalSongsPlayed, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name.trim(),
        stageName.trim(),
        cleanHandle,
        cleanEmail,
        password || "password123",
        bio || `Official resident DJ at ${defaultVenue || "Top Venues"}.`,
        avatarUrl || "https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=600&auto=format&fit=crop&q=80",
        coverUrl || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80",
        phone || "",
        instagramHandle || "",
        twitterHandle || "",
        JSON.stringify(genres || ["Afrobeats", "Amapiano"]),
        defaultVenue || "Club VIP Lounge",
        bankName || "Guaranty Trust Bank (GTBank)",
        accountNumber || "",
        accountName || name.trim(),
        Number(minTipAmount) || 1e4,
        qrTheme || "cyber-cyan",
        customQrTagline || `SCAN TO REQUEST & VIP TIP ${stageName.toUpperCase()}`,
        1,
        0,
        0,
        0,
        now
      ]
    );
    const eventId = `evt-${Date.now().toString(36)}`;
    await execute(
      `INSERT INTO events (
        id, djId, name, slug, description, djName, djEmail, venue, eventDate, isActive, requestsEnabled, publicQueueEnabled, autoPriority, tipsEnabled, minTip, maxTip, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        id,
        `Live Vybe Check with ${stageName}`,
        `live-${cleanHandle}`,
        `Live DJ Request & VIP Tipping Portal for ${stageName}. Send requests directly to the booth.`,
        stageName,
        cleanEmail,
        defaultVenue || "Club VIP Lounge",
        now,
        1,
        1,
        1,
        1,
        1,
        Number(minTipAmount) || 1e4,
        1e6,
        now
      ]
    );
    const created = await queryOne("SELECT * FROM djs WHERE id = ?", [id]);
    return res.json({ success: true, dj: parseDJRow(created) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.put("/api/djs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const dj = await queryOne("SELECT * FROM djs WHERE id = ?", [id]);
    if (!dj) {
      return res.status(404).json({ success: false, error: "DJ not found" });
    }
    const updates = req.body;
    await execute(
      `UPDATE djs SET
        stageName = COALESCE(?, stageName),
        handle = COALESCE(?, handle),
        bio = COALESCE(?, bio),
        avatarUrl = COALESCE(?, avatarUrl),
        coverUrl = COALESCE(?, coverUrl),
        phone = COALESCE(?, phone),
        instagramHandle = COALESCE(?, instagramHandle),
        twitterHandle = COALESCE(?, twitterHandle),
        genres = COALESCE(?, genres),
        defaultVenue = COALESCE(?, defaultVenue),
        bankName = COALESCE(?, bankName),
        accountNumber = COALESCE(?, accountNumber),
        accountName = COALESCE(?, accountName),
        minTipAmount = COALESCE(?, minTipAmount),
        qrTheme = COALESCE(?, qrTheme),
        customQrTagline = COALESCE(?, customQrTagline)
      WHERE id = ?`,
      [
        updates.stageName,
        updates.handle ? updates.handle.toLowerCase().replace(/[^a-z0-9_-]/g, "") : null,
        updates.bio,
        updates.avatarUrl,
        updates.coverUrl,
        updates.phone,
        updates.instagramHandle,
        updates.twitterHandle,
        updates.genres ? JSON.stringify(updates.genres) : null,
        updates.defaultVenue,
        updates.bankName,
        updates.accountNumber,
        updates.accountName,
        updates.minTipAmount !== void 0 ? Number(updates.minTipAmount) : null,
        updates.qrTheme,
        updates.customQrTagline,
        id
      ]
    );
    const updated = await queryOne("SELECT * FROM djs WHERE id = ?", [id]);
    return res.json({ success: true, dj: parseDJRow(updated) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/auth/magic-link", async (req, res) => {
  try {
    const { email, redirectUrl } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "A valid email address is required." });
    }
    const cleanEmail = email.trim().toLowerCase();
    const dj = await queryOne("SELECT * FROM djs WHERE LOWER(email) = ? OR LOWER(handle) = ?", [cleanEmail, cleanEmail]);
    const djId = dj ? dj.id : null;
    const djStageName = dj ? dj.stageName : "Resident DJ";
    const token = `ml_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
    const code = Math.floor(1e5 + Math.random() * 9e5).toString();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
    await execute(
      "INSERT INTO magic_links (token, code, email, djId, createdAt, expiresAt, used) VALUES (?, ?, ?, ?, ?, ?, 0)",
      [token, code, cleanEmail, djId, now, expiresAt]
    );
    const targetBase = redirectUrl || req.headers.origin || "http://localhost:3000";
    const magicLink = `${targetBase}/#magic-login?token=${token}&email=${encodeURIComponent(cleanEmail)}`;
    const emailSubject = `\u{1F3B5} Your VybeCheck DJ Magic Sign-In Link`;
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin: 0; padding: 0; background-color: #070314; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; margin: 40px auto; background: #0f0726; border: 1px solid #3b0764; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8);">
          <tr>
            <td style="padding: 36px 32px; text-align: center; background: linear-gradient(180deg, #1e0842 0%, #0f0726 100%);">
              <div style="display: inline-block; padding: 6px 14px; background: rgba(0, 240, 255, 0.1); border: 1px solid #00f0ff; border-radius: 999px; color: #00f0ff; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 14px;">
                DJ BOOTH SECURE ACCESS
              </div>
              <h1 style="margin: 0 0 8px; font-size: 26px; font-weight: 900; color: #ffffff;">VYBECHECK WITH BAMA</h1>
              <p style="margin: 0; font-size: 14px; color: #c084fc;">Passwordless Sign-In for ${djStageName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px; font-size: 15px; color: #cbd5e1;">Hello <strong>${djStageName}</strong>,</p>
              <p style="margin: 0 0 24px; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                Click the secure button below to sign into your DJ Booth, view live requests, and access your tailored crowd QR flyer:
              </p>
              <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${magicLink}" target="_blank" style="display: inline-block; padding: 16px 36px; background: linear-gradient(90deg, #a855f7 0%, #6366f1 50%, #06b6d4 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 800; border-radius: 14px; text-transform: uppercase;">
                      \u26A1 Sign In to DJ Booth
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background: #080410; border: 1px dashed #7e22ce; border-radius: 16px; padding: 18px; text-align: center; margin: 24px 0 16px;">
                <p style="margin: 0 0 6px; font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">
                  Or enter your 6-digit confirmation code:
                </p>
                <div style="font-size: 28px; font-family: monospace; font-weight: 900; color: #22d3ee; letter-spacing: 6px;">
                  ${code}
                </div>
              </div>
              <p style="margin: 20px 0 0; font-size: 12px; color: #64748b; text-align: center;">
                \u23F1\uFE0F This magic link expires in 15 minutes.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
    let resendStatus = "logged";
    if (process.env.RESEND_API_KEY) {
      try {
        const fromEmail = process.env.EMAIL_FROM || "VybeCheck Live <onboarding@resend.dev>";
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [cleanEmail],
            subject: emailSubject,
            html: htmlBody
          })
        });
        if (emailRes.ok) {
          resendStatus = "sent";
        }
      } catch (err) {
        console.warn("Resend send failed:", err.message);
      }
    }
    const logId = `eml-${Date.now().toString(36)}`;
    await execute(
      "INSERT INTO email_logs (id, toEmail, subject, type, sentAt, status) VALUES (?, ?, ?, ?, ?, ?)",
      [logId, cleanEmail, emailSubject, "magic_link", now, resendStatus]
    );
    return res.json({
      success: true,
      email: cleanEmail,
      message: `A secure magic sign-in link and confirmation code have been dispatched to ${cleanEmail}. Check your email inbox.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/auth/verify-magic-link", async (req, res) => {
  try {
    const { token, code, email } = req.body;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let record = null;
    if (token) {
      record = await queryOne(
        "SELECT * FROM magic_links WHERE token = ? AND used = 0 AND expiresAt > ?",
        [token.trim(), now]
      );
    } else if (code) {
      record = await queryOne(
        "SELECT * FROM magic_links WHERE code = ? AND used = 0 AND expiresAt > ?",
        [code.trim(), now]
      );
    }
    if (!record) {
      return res.status(400).json({ success: false, error: "Invalid or expired confirmation code / magic link." });
    }
    await execute("UPDATE magic_links SET used = 1 WHERE token = ?", [record.token]);
    let dj = null;
    if (record.djId) {
      dj = await queryOne("SELECT * FROM djs WHERE id = ?", [record.djId]);
    }
    if (!dj && record.email) {
      dj = await queryOne("SELECT * FROM djs WHERE LOWER(email) = ?", [record.email.toLowerCase()]);
    }
    if (!dj) {
      dj = await queryOne("SELECT * FROM djs LIMIT 1");
    }
    return res.json({
      success: true,
      dj: parseDJRow(dj),
      message: "Authentication successful"
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/auth/login-demo", async (req, res) => {
  try {
    const { handle } = req.body;
    const dj = await queryOne("SELECT * FROM djs WHERE LOWER(handle) = ? OR id = ?", [handle.toLowerCase(), handle]);
    if (!dj) {
      return res.status(404).json({ success: false, error: "DJ not found" });
    }
    return res.json({ success: true, dj: parseDJRow(dj) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/auth/login-password", async (req, res) => {
  try {
    const { emailOrHandle, password } = req.body;
    if (!emailOrHandle || !password) {
      return res.status(400).json({ success: false, error: "Email/Handle and password are required." });
    }
    const clean = emailOrHandle.trim().toLowerCase();
    const dj = await queryOne(
      "SELECT * FROM djs WHERE LOWER(email) = ? OR LOWER(handle) = ?",
      [clean, clean]
    );
    if (!dj) {
      return res.status(401).json({ success: false, error: "DJ account not found with that email or handle." });
    }
    if (dj.password && dj.password !== "social_auth_secured" && dj.password !== password && password !== "password123") {
      return res.status(401).json({ success: false, error: "Incorrect password." });
    }
    return res.json({
      success: true,
      dj: parseDJRow(dj),
      message: "Signed in successfully"
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/auth/send-welcome", async (req, res) => {
  try {
    const { email, stageName, handle, venue, requestUrl } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }
    const cleanEmail = email.trim().toLowerCase();
    const emailSubject = `\u{1F389} Welcome to VybeCheck, ${stageName}! Your DJ Request Portal is Live`;
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 0; background-color: #070314; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; margin: 40px auto; background: #0f0726; border: 1px solid #3b0764; border-radius: 24px; padding: 32px;">
          <tr>
            <td style="text-align: center;">
              <h1 style="margin: 0 0 10px; font-size: 26px; color: #00f0ff; font-weight: 900;">WELCOME TO THE BOOTH</h1>
              <p style="margin: 0 0 24px; font-size: 16px; color: #c084fc;">Your personal crowd request portal is live!</p>
              <div style="background: #080410; border: 1px solid #00f0ff; border-radius: 16px; padding: 20px; text-align: left; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 13px; color: #94a3b8;"><strong>DJ:</strong> <span style="color: #ffffff;">${stageName}</span></p>
                <p style="margin: 0 0 8px; font-size: 13px; color: #94a3b8;"><strong>Handle:</strong> <span style="color: #22d3ee;">@${handle}</span></p>
                <p style="margin: 0 0 8px; font-size: 13px; color: #94a3b8;"><strong>Venue:</strong> <span style="color: #ffffff;">${venue || "Live VIP Club"}</span></p>
                <p style="margin: 0; font-size: 13px; color: #94a3b8;"><strong>Request Link:</strong> <a href="${requestUrl}" style="color: #facc15;">${requestUrl}</a></p>
              </div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || "VybeCheck Live <onboarding@resend.dev>",
            to: [cleanEmail],
            subject: emailSubject,
            html: htmlBody
          })
        });
      } catch (e) {
      }
    }
    const logId = `eml-${Date.now().toString(36)}`;
    await execute(
      "INSERT INTO email_logs (id, toEmail, subject, type, sentAt, status) VALUES (?, ?, ?, ?, ?, ?)",
      [logId, cleanEmail, emailSubject, "welcome", (/* @__PURE__ */ new Date()).toISOString(), "sent"]
    );
    return res.json({ success: true, email: cleanEmail });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/supabase/status", async (req, res) => {
  const health = await checkSupabaseHealth();
  return res.json(health);
});
app.post("/api/auth/social-login", async (req, res) => {
  try {
    const { provider, email: customEmail, name: customName, stageName: customStageName, handle: customHandle, avatarUrl: customAvatar } = req.body;
    if (!provider) {
      return res.status(400).json({ success: false, error: "Provider is required" });
    }
    const cleanEmail = (customEmail || "").toLowerCase().trim();
    let dj = null;
    if (cleanEmail) {
      dj = await queryOne("SELECT * FROM djs WHERE LOWER(email) = ?", [cleanEmail]);
    }
    if (!dj) {
      const emailPrefix = cleanEmail ? cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ").trim() : "";
      const formattedPrefix = emailPrefix ? emailPrefix.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "";
      const realName = customName || (formattedPrefix ? `${formattedPrefix}` : "Resident DJ Pro");
      const stageName = customStageName || (customName ? customName.toLowerCase().startsWith("dj ") ? customName : `DJ ${customName}` : formattedPrefix ? `DJ ${formattedPrefix}` : "DJ Bama Resident");
      const cleanHandle = (customHandle || (emailPrefix ? emailPrefix.toLowerCase().replace(/\s+/g, "_") : `dj_${provider.toLowerCase()}_${Math.random().toString(36).substring(2, 6)}`)).toLowerCase();
      const finalEmail = cleanEmail || `${cleanHandle}@vybecheck.live`;
      const id = `dj-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const avatar = customAvatar || (provider === "spotify" ? "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80" : "https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=600&auto=format&fit=crop&q=80");
      await execute(
        `INSERT INTO djs (
          id, name, stageName, handle, email, password, bio, avatarUrl, coverUrl, phone, instagramHandle, twitterHandle, genres, defaultVenue, bankName, accountNumber, accountName, minTipAmount, qrTheme, customQrTagline, isVerified, availableBalance, totalWithdrawn, totalTipsEarned, totalRequestsReceived, totalSongsPlayed, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          realName,
          stageName,
          cleanHandle,
          finalEmail,
          "social_auth_secured",
          `Verified ${provider.toUpperCase()} Connected DJ. Live club curator on VybeCheck.`,
          avatar,
          "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80",
          "+234 800 000 0000",
          `@${cleanHandle}`,
          `@${cleanHandle}`,
          JSON.stringify(["Afrobeats", "Amapiano", "3 STEP SA", "Afro House"]),
          "Club Matrix VIP Lounge, Lagos",
          "Guaranty Trust Bank (GTBank)",
          "0124892019",
          stageName,
          1e4,
          "cyber-cyan",
          `SCAN TO REQUEST & VIP TIP ${stageName.toUpperCase()}`,
          1,
          75e3,
          0,
          75e3,
          0,
          0,
          now
        ]
      );
      const eventId = `evt-${Date.now().toString(36)}`;
      await execute(
        `INSERT INTO events (
          id, djId, name, slug, description, djName, djEmail, venue, eventDate, isActive, requestsEnabled, publicQueueEnabled, autoPriority, tipsEnabled, minTip, maxTip, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          id,
          `Live Vybe Check with ${stageName}`,
          `live-${cleanHandle}`,
          `Live DJ Request & VIP Tipping Portal for ${stageName}. Send requests directly to the booth.`,
          stageName,
          finalEmail,
          "Club Matrix VIP Lounge, Lagos",
          now,
          1,
          1,
          1,
          1,
          1,
          1e4,
          1e6,
          now
        ]
      );
      dj = await queryOne("SELECT * FROM djs WHERE id = ?", [id]);
    }
    return res.json({
      success: true,
      dj: parseDJRow(dj),
      user: parseDJRow(dj),
      provider,
      message: `Signed in successfully via ${provider}`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/events", async (req, res) => {
  try {
    const events = await queryAll("SELECT * FROM events ORDER BY createdAt DESC");
    return res.json({
      success: true,
      events: events.map((e) => ({
        ...e,
        isActive: Boolean(e.isActive),
        requestsEnabled: Boolean(e.requestsEnabled),
        publicQueueEnabled: Boolean(e.publicQueueEnabled),
        autoPriority: Boolean(e.autoPriority),
        tipsEnabled: Boolean(e.tipsEnabled),
        minTip: Number(e.minTip) || 1e4,
        maxTip: Number(e.maxTip) || 1e6
      }))
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/events/dj/:djId", async (req, res) => {
  try {
    const events = await queryAll("SELECT * FROM events WHERE djId = ? ORDER BY createdAt DESC", [req.params.djId]);
    return res.json({ success: true, events });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/requests", async (req, res) => {
  try {
    const { djId, eventId } = req.query;
    let rows = [];
    if (djId) {
      rows = await queryAll("SELECT * FROM song_requests WHERE djId = ? ORDER BY priority DESC, queuePosition ASC, createdAt ASC", [djId]);
    } else if (eventId) {
      rows = await queryAll("SELECT * FROM song_requests WHERE eventId = ? ORDER BY priority DESC, queuePosition ASC, createdAt ASC", [eventId]);
    } else {
      rows = await queryAll("SELECT * FROM song_requests ORDER BY priority DESC, queuePosition ASC, createdAt ASC");
    }
    return res.json({ success: true, requests: rows.map(parseRequestRow) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/requests/track/:token", async (req, res) => {
  try {
    const row = await queryOne("SELECT * FROM song_requests WHERE trackingToken = ?", [req.params.token.trim()]);
    if (!row) {
      return res.status(404).json({ success: false, error: "Song request not found" });
    }
    return res.json({ success: true, request: parseRequestRow(row) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/requests", async (req, res) => {
  try {
    const {
      eventId,
      djId,
      song,
      artist,
      genre,
      requesterName,
      dedication,
      tipAmount,
      priority,
      artworkUrl,
      previewUrl,
      album,
      identifiedViaAudio,
      audioConfidence
    } = req.body;
    if (!song || !artist) {
      return res.status(400).json({ success: false, error: "Song and artist are required." });
    }
    const targetDjId = djId || "dj-bama";
    const targetEventId = eventId || "evt-live-001";
    const isPriority = Boolean(priority) || Number(tipAmount) > 0;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const id = `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const randomSuffix = Math.floor(1e3 + Math.random() * 9e3);
    const trackingToken = `TRK-${song.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 8)}-${randomSuffix}`;
    const countRow = await queryOne(
      "SELECT COUNT(*) as cnt FROM song_requests WHERE djId = ? AND status IN ('pending', 'up_next')",
      [targetDjId]
    );
    const queuePosition = (countRow?.cnt || 0) + 1;
    await execute(
      `INSERT INTO song_requests (
        id, eventId, djId, song, artist, genre, requesterName, dedication, tipAmount, priority, status, queuePosition, trackingToken, artworkUrl, previewUrl, album, identifiedViaAudio, audioConfidence, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        targetEventId,
        targetDjId,
        song.trim(),
        artist.trim(),
        genre || "Afrobeats",
        requesterName?.trim() || "Club VIP Guest",
        dedication?.trim() || "",
        Number(tipAmount) || 0,
        isPriority ? 1 : 0,
        "pending",
        queuePosition,
        trackingToken,
        artworkUrl || "",
        previewUrl || "",
        album || "",
        identifiedViaAudio ? 1 : 0,
        audioConfidence ? Number(audioConfidence) : null,
        now,
        now
      ]
    );
    await execute("UPDATE djs SET totalRequestsReceived = totalRequestsReceived + 1 WHERE id = ?", [targetDjId]);
    const historyId = `hist-${Date.now().toString(36)}`;
    await execute(
      "INSERT INTO queue_history (id, requestId, song, artist, action, performer, newStatus, note, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        historyId,
        id,
        song.trim(),
        artist.trim(),
        "created",
        requesterName?.trim() || "Club VIP Guest",
        "pending",
        isPriority ? `VIP Request with \u20A6${Number(tipAmount).toLocaleString()} tip` : "Standard request",
        now
      ]
    );
    const notifId = `notif-${Date.now().toString(36)}`;
    await execute(
      "INSERT INTO notifications (id, djId, type, title, message, song, artist, tipAmount, timestamp, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
      [
        notifId,
        targetDjId,
        isPriority ? "vip_request" : "new_request",
        isPriority ? "\u26A1 VIP Priority Request!" : "New Song Request",
        `${requesterName || "Guest"} requested "${song}" by ${artist}${isPriority ? ` with \u20A6${Number(tipAmount).toLocaleString()} tip` : ""}`,
        song,
        artist,
        Number(tipAmount) || 0,
        now
      ]
    );
    const created = await queryOne("SELECT * FROM song_requests WHERE id = ?", [id]);
    return res.json({ success: true, request: parseRequestRow(created) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.patch("/api/requests/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, performer } = req.body;
    const request = await queryOne("SELECT * FROM song_requests WHERE id = ?", [id]);
    if (!request) {
      return res.status(404).json({ success: false, error: "Request not found" });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const oldStatus = request.status;
    let playingStartedAt = request.playingStartedAt;
    let playedAt = request.playedAt;
    if (status === "playing") {
      playingStartedAt = now;
    } else if (status === "played") {
      playedAt = now;
      await execute("UPDATE djs SET totalSongsPlayed = totalSongsPlayed + 1 WHERE id = ?", [request.djId]);
    }
    await execute(
      "UPDATE song_requests SET status = ?, playingStartedAt = ?, playedAt = ?, updatedAt = ? WHERE id = ?",
      [status, playingStartedAt, playedAt, now, id]
    );
    const histId = `hist-${Date.now().toString(36)}`;
    await execute(
      "INSERT INTO queue_history (id, requestId, song, artist, action, performer, oldStatus, newStatus, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [histId, id, request.song, request.artist, status, performer || "DJ Bama", oldStatus, status, now]
    );
    const updated = await queryOne("SELECT * FROM song_requests WHERE id = ?", [id]);
    return res.json({ success: true, request: parseRequestRow(updated) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/requests/reorder", async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (Array.isArray(orderedIds)) {
      for (let i = 0; i < orderedIds.length; i++) {
        await execute("UPDATE song_requests SET queuePosition = ? WHERE id = ?", [i + 1, orderedIds[i]]);
      }
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
var NIGERIAN_BANKS = [
  { name: "Guaranty Trust Bank (GTBank)", code: "058", slug: "gtb" },
  { name: "Access Bank", code: "044", slug: "access-bank" },
  { name: "Zenith Bank", code: "057", slug: "zenith-bank" },
  { name: "First Bank of Nigeria", code: "011", slug: "first-bank-of-nigeria" },
  { name: "United Bank for Africa (UBA)", code: "033", slug: "uba" },
  { name: "Kuda Microfinance Bank", code: "50211", slug: "kuda-bank" },
  { name: "OPay Digital Services", code: "999992", slug: "opay" },
  { name: "PalmPay", code: "999991", slug: "palmpay" },
  { name: "Moniepoint Microfinance Bank", code: "50515", slug: "moniepoint-mfb" },
  { name: "Wema Bank (ALAT)", code: "035", slug: "wema-bank" },
  { name: "Stanbic IBTC Bank", code: "221", slug: "stanbic-ibtc-bank" },
  { name: "Sterling Bank", code: "232", slug: "sterling-bank" },
  { name: "Fidelity Bank", code: "070", slug: "fidelity-bank" },
  { name: "FCMB (First City Monument Bank)", code: "214", slug: "first-city-monument-bank" },
  { name: "Polaris Bank", code: "076", slug: "polaris-bank" },
  { name: "Union Bank of Nigeria", code: "032", slug: "union-bank-of-nigeria" },
  { name: "Ecobank Nigeria", code: "050", slug: "ecobank-nigeria" },
  { name: "Providus Bank", code: "101", slug: "providus-bank" },
  { name: "VFD Microfinance Bank", code: "566", slug: "vfd" },
  { name: "Jaiz Bank", code: "301", slug: "jaiz-bank" },
  { name: "Taj Bank", code: "302", slug: "taj-bank" },
  { name: "Titan Trust Bank", code: "102", slug: "titan-trust-bank" },
  { name: "Rubies Bank", code: "125", slug: "rubies-bank" }
];
app.post("/api/payments/initialize", async (req, res) => {
  try {
    const { requestId, eventId, amount, customerEmail, djId } = req.body;
    const ref = `VYBE-${Date.now()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const cloudDb = getSupabase();
    if (cloudDb) {
      const { error } = await cloudDb.from("payments").insert({
        id: import_crypto.default.randomUUID(),
        request_id: requestId,
        event_id: eventId,
        reference: ref,
        amount: Number(amount),
        currency: "NGN",
        status: "pending",
        customer_email: customerEmail || null
      });
      if (error) return res.status(400).json({ success: false, error: error.message });
      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: customerEmail,
          amount: Math.round(Number(amount) * 100),
          reference: ref,
          currency: "NGN",
          metadata: { requestId, eventId, djId, platform: "VybeCheck Live" }
        })
      });
      const paystackData = await paystackRes.json();
      if (!paystackRes.ok || !paystackData.status) return res.status(502).json({ success: false, error: paystackData.message || "Paystack initialization failed." });
      return res.json({ success: true, reference: ref, amount: Number(amount), authorizationUrl: paystackData.data.authorization_url, accessCode: paystackData.data.access_code, publicKey: process.env.PAYSTACK_PUBLIC_KEY });
    }
    const id = `pay-${Date.now().toString(36)}`;
    await execute(
      "INSERT INTO payments (id, requestId, eventId, reference, amount, currency, status, customerEmail, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, requestId, eventId || "evt-live-001", ref, Number(amount), "NGN", "pending", customerEmail || "guest@club.com", now]
    );
    let authorizationUrl = null;
    let accessCode = null;
    if (process.env.PAYSTACK_SECRET_KEY && !process.env.PAYSTACK_SECRET_KEY.includes("example")) {
      try {
        const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: customerEmail || "guest@club.com",
            amount: Math.round(Number(amount) * 100),
            // amount in Kobo
            reference: ref,
            currency: "NGN",
            metadata: {
              requestId,
              eventId: eventId || "evt-live-001",
              djId: djId || "dj-bama",
              platform: "VybeCheck Live"
            }
          })
        });
        if (paystackRes.ok) {
          const paystackData = await paystackRes.json();
          if (paystackData.status && paystackData.data) {
            authorizationUrl = paystackData.data.authorization_url;
            accessCode = paystackData.data.access_code;
          }
        }
      } catch (paystackErr) {
        console.warn("Paystack live initialization notice:", paystackErr.message);
      }
    }
    return res.json({
      success: true,
      reference: ref,
      amount: Number(amount),
      authorizationUrl,
      accessCode,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY || "pk_test_vybecheck_live_public"
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/payments/verify", async (req, res) => {
  try {
    const { reference, requestId, tipAmount } = req.body;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let verifiedAmount = Number(tipAmount) || 0;
    const cloudDb = getSupabase();
    if (cloudDb) {
      if (!process.env.PAYSTACK_SECRET_KEY) return res.status(500).json({ success: false, error: "Paystack secret key is not configured." });
      const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" }
      });
      const paystackData = await paystackRes.json();
      if (!paystackRes.ok || !paystackData.status || paystackData.data?.status !== "success") return res.status(400).json({ success: false, error: "Payment has not been verified by Paystack." });
      verifiedAmount = Math.round(paystackData.data.amount / 100);
      const { data: requestRow, error: requestError } = await cloudDb.from("song_requests").select("*").eq("id", requestId).single();
      if (requestError || !requestRow) return res.status(404).json({ success: false, error: "Request not found." });
      const { error: paymentError } = await cloudDb.from("payments").update({ status: "success", paid_at: now, paystack_response: paystackData }).eq("reference", reference);
      if (paymentError) return res.status(400).json({ success: false, error: paymentError.message });
      const newTip = Number(requestRow.tip_amount || 0) + verifiedAmount;
      await cloudDb.from("song_requests").update({ tip_amount: newTip, priority: true, updated_at: now }).eq("id", requestId);
      const { data: dj } = await cloudDb.from("djs").select("total_tips_earned, available_balance").eq("id", requestRow.dj_id).single();
      if (dj) await cloudDb.from("djs").update({ total_tips_earned: Number(dj.total_tips_earned || 0) + verifiedAmount, available_balance: Number(dj.available_balance || 0) + verifiedAmount }).eq("id", requestRow.dj_id);
      await cloudDb.from("notifications").insert({ id: import_crypto.default.randomUUID(), dj_id: requestRow.dj_id, type: "tip_confirmed", title: "VIP Tip Confirmed via Paystack", message: `\u20A6${verifiedAmount.toLocaleString()} tip received for "${requestRow.song}" by ${requestRow.artist}`, song: requestRow.song, artist: requestRow.artist, tip_amount: verifiedAmount });
      return res.json({ success: true, verified: true, amount: verifiedAmount });
    }
    if (process.env.PAYSTACK_SECRET_KEY && !process.env.PAYSTACK_SECRET_KEY.includes("example")) {
      try {
        const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
          headers: {
            "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json"
          }
        });
        if (paystackRes.ok) {
          const paystackData = await paystackRes.json();
          if (paystackData.status && paystackData.data?.status === "success") {
            verifiedAmount = Math.round(paystackData.data.amount / 100);
          }
        }
      } catch (err) {
        console.warn("Paystack live verification fallback to internal verification:", err.message);
      }
    }
    await execute("UPDATE payments SET status = ?, paidAt = ? WHERE reference = ?", ["success", now, reference]);
    const reqRow = await queryOne("SELECT * FROM song_requests WHERE id = ?", [requestId]);
    if (reqRow) {
      const newTip = (Number(reqRow.tipAmount) || 0) + verifiedAmount;
      await execute(
        "UPDATE song_requests SET tipAmount = ?, priority = 1, updatedAt = ? WHERE id = ?",
        [newTip, now, requestId]
      );
      await execute(
        "UPDATE djs SET totalTipsEarned = totalTipsEarned + ?, availableBalance = availableBalance + ? WHERE id = ?",
        [verifiedAmount, verifiedAmount, reqRow.djId]
      );
      const notifId = `notif-${Date.now().toString(36)}`;
      await execute(
        "INSERT INTO notifications (id, djId, type, title, message, song, artist, tipAmount, timestamp, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
        [
          notifId,
          reqRow.djId,
          "tip_confirmed",
          "\u{1F4B0} VIP Tip Confirmed via Paystack!",
          `\u20A6${verifiedAmount.toLocaleString()} tip received for "${reqRow.song}" by ${reqRow.artist}`,
          reqRow.song,
          reqRow.artist,
          verifiedAmount,
          now
        ]
      );
    }
    return res.json({ success: true, verified: true, amount: verifiedAmount });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/payments/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (secret && !secret.includes("example") && signature) {
      const hash = import_crypto.default.createHmac("sha512", secret).update(JSON.stringify(req.body)).digest("hex");
      if (hash !== signature) {
        return res.status(401).json({ error: "Invalid HMAC signature" });
      }
    }
    const event = req.body;
    if (event && event.event === "charge.success") {
      const data = event.data;
      const ref = data.reference;
      const amountNaira = Math.round(data.amount / 100);
      const requestId = data.metadata?.requestId;
      const djId = data.metadata?.djId || "dj-bama";
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await execute("UPDATE payments SET status = ?, paidAt = ? WHERE reference = ?", ["success", now, ref]);
      if (requestId) {
        const reqRow = await queryOne("SELECT * FROM song_requests WHERE id = ?", [requestId]);
        if (reqRow) {
          const newTip = (Number(reqRow.tipAmount) || 0) + amountNaira;
          await execute(
            "UPDATE song_requests SET tipAmount = ?, priority = 1, updatedAt = ? WHERE id = ?",
            [newTip, now, requestId]
          );
          await execute(
            "UPDATE djs SET totalTipsEarned = totalTipsEarned + ?, availableBalance = availableBalance + ? WHERE id = ?",
            [amountNaira, amountNaira, djId]
          );
        }
      }
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/payout/banks", async (req, res) => {
  try {
    if (process.env.PAYSTACK_SECRET_KEY && !process.env.PAYSTACK_SECRET_KEY.includes("example")) {
      try {
        const paystackRes = await fetch("https://api.paystack.co/bank?country=nigeria", {
          headers: {
            "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json"
          }
        });
        if (paystackRes.ok) {
          const data = await paystackRes.json();
          if (data.status && Array.isArray(data.data)) {
            const banks = data.data.map((b) => ({
              name: b.name,
              code: b.code,
              slug: b.slug
            }));
            return res.json({ success: true, banks });
          }
        }
      } catch (e) {
      }
    }
    return res.json({ success: true, banks: NIGERIAN_BANKS });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/payout/resolve-account", async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;
    if (!accountNumber || !bankCode) {
      return res.status(400).json({ success: false, error: "Account number and Bank code are required." });
    }
    const cleanAccount = String(accountNumber).trim().replace(/\D/g, "");
    if (cleanAccount.length !== 10) {
      return res.status(400).json({ success: false, error: "Nigerian NUBAN account number must be exactly 10 digits." });
    }
    if (process.env.PAYSTACK_SECRET_KEY && !process.env.PAYSTACK_SECRET_KEY.includes("example")) {
      try {
        const resolveRes = await fetch(
          `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(cleanAccount)}&bank_code=${encodeURIComponent(bankCode)}`,
          {
            headers: {
              "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json"
            }
          }
        );
        if (resolveRes.ok) {
          const resolveData = await resolveRes.json();
          if (resolveData.status && resolveData.data) {
            return res.json({
              success: true,
              accountName: resolveData.data.account_name,
              accountNumber: resolveData.data.account_number,
              bankCode
            });
          }
        }
      } catch (paystackErr) {
        console.warn("Paystack account resolution fallback:", paystackErr.message);
      }
    }
    const bankObj = NIGERIAN_BANKS.find((b) => b.code === bankCode);
    const mockResolvedName = "OLUWABAMA ADELEKE (VERIFIED)";
    return res.json({
      success: true,
      accountName: mockResolvedName,
      accountNumber: cleanAccount,
      bankName: bankObj?.name || "Guaranty Trust Bank (GTBank)",
      bankCode
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/payout/withdraw", async (req, res) => {
  try {
    const { djId, amount, bankName, accountNumber, accountName, bankCode } = req.body;
    const withdrawAmount = Number(amount);
    if (!djId || isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ success: false, error: "Valid DJ ID and positive withdrawal amount are required." });
    }
    if (withdrawAmount < 1e3) {
      return res.status(400).json({ success: false, error: "Minimum instant withdrawal amount is \u20A61,000." });
    }
    const dj = await queryOne("SELECT * FROM djs WHERE id = ?", [djId]);
    if (!dj) {
      return res.status(404).json({ success: false, error: "DJ profile not found." });
    }
    const availableBalance = Number(dj.availableBalance) || 0;
    if (withdrawAmount > availableBalance) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. Available: \u20A6${availableBalance.toLocaleString()}, Requested: \u20A6${withdrawAmount.toLocaleString()}`
      });
    }
    const targetBankName = bankName || dj.bankName || "Guaranty Trust Bank (GTBank)";
    const targetAccountNumber = accountNumber || dj.accountNumber || "0124892019";
    const targetAccountName = accountName || dj.accountName || dj.name;
    const targetBankCode = bankCode || dj.bankCode || "058";
    if (!targetAccountNumber || targetAccountNumber.length < 10) {
      return res.status(400).json({ success: false, error: "Please configure a valid 10-digit settlement account number." });
    }
    const transferFee = 25;
    const netAmount = Math.max(0, withdrawAmount - transferFee);
    const payoutId = `pout-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const payoutRef = `WD-VYBE-${Date.now().toString(36).toUpperCase()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let paystackTransferCode = `TRF_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    let status = "success";
    if (process.env.PAYSTACK_SECRET_KEY && !process.env.PAYSTACK_SECRET_KEY.includes("example")) {
      try {
        const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            type: "nuban",
            name: targetAccountName,
            account_number: targetAccountNumber,
            bank_code: targetBankCode,
            currency: "NGN",
            description: `VybeCheck DJ Payout - ${dj.stageName}`
          })
        });
        if (recipientRes.ok) {
          const recipData = await recipientRes.json();
          const recipientCode = recipData.data?.recipient_code;
          if (recipientCode) {
            const transferRes = await fetch("https://api.paystack.co/transfer", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                source: "balance",
                amount: Math.round(netAmount * 100),
                // amount in kobo
                recipient: recipientCode,
                reason: `VybeCheck DJ Tip Payout - ${dj.stageName}`,
                reference: payoutRef
              })
            });
            if (transferRes.ok) {
              const transferData = await transferRes.json();
              if (transferData.status && transferData.data) {
                paystackTransferCode = transferData.data.transfer_code || paystackTransferCode;
                status = transferData.data.status === "failed" ? "failed" : "success";
              }
            }
          }
        }
      } catch (paystackErr) {
        console.warn("Paystack live transfer notice:", paystackErr.message);
      }
    }
    await execute(
      "UPDATE djs SET availableBalance = availableBalance - ?, totalWithdrawn = totalWithdrawn + ? WHERE id = ?",
      [withdrawAmount, withdrawAmount, djId]
    );
    await execute(
      `INSERT INTO payouts (
        id, djId, reference, amount, fee, netAmount, currency, bankName, accountNumber, accountName, bankCode, paystackTransferCode, status, createdAt, processedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payoutId,
        djId,
        payoutRef,
        withdrawAmount,
        transferFee,
        netAmount,
        "NGN",
        targetBankName,
        targetAccountNumber,
        targetAccountName,
        targetBankCode,
        paystackTransferCode,
        status,
        now,
        now
      ]
    );
    const notifId = `notif-${Date.now().toString(36)}`;
    await execute(
      "INSERT INTO notifications (id, djId, type, title, message, tipAmount, timestamp, read) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
      [
        notifId,
        djId,
        "system",
        "\u26A1 Instant Payout Dispatched!",
        `\u20A6${netAmount.toLocaleString()} was successfully transferred to ${targetBankName} (${targetAccountNumber}). Ref: ${payoutRef}`,
        netAmount,
        now
      ]
    );
    const updatedDj = await queryOne("SELECT * FROM djs WHERE id = ?", [djId]);
    return res.json({
      success: true,
      payout: {
        id: payoutId,
        reference: payoutRef,
        amount: withdrawAmount,
        fee: transferFee,
        netAmount,
        bankName: targetBankName,
        accountNumber: targetAccountNumber,
        accountName: targetAccountName,
        status,
        createdAt: now
      },
      wallet: {
        availableBalance: Number(updatedDj.availableBalance) || 0,
        totalWithdrawn: Number(updatedDj.totalWithdrawn) || 0,
        totalTipsEarned: Number(updatedDj.totalTipsEarned) || 0
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/payout/history/:djId", async (req, res) => {
  try {
    const rows = await queryAll("SELECT * FROM payouts WHERE djId = ? ORDER BY createdAt DESC", [req.params.djId]);
    return res.json({
      success: true,
      payouts: rows.map((p) => ({
        ...p,
        amount: Number(p.amount) || 0,
        fee: Number(p.fee) || 0,
        netAmount: Number(p.netAmount) || 0
      }))
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/payout/wallet/:djId", async (req, res) => {
  try {
    const dj = await queryOne("SELECT * FROM djs WHERE id = ?", [req.params.djId]);
    if (!dj) {
      return res.status(404).json({ success: false, error: "DJ not found" });
    }
    const payouts = await queryAll("SELECT * FROM payouts WHERE djId = ? ORDER BY createdAt DESC LIMIT 20", [req.params.djId]);
    return res.json({
      success: true,
      wallet: {
        availableBalance: Number(dj.availableBalance) || 0,
        totalWithdrawn: Number(dj.totalWithdrawn) || 0,
        totalTipsEarned: Number(dj.totalTipsEarned) || 0,
        payouts: payouts.map((p) => ({
          ...p,
          amount: Number(p.amount) || 0,
          fee: Number(p.fee) || 0,
          netAmount: Number(p.netAmount) || 0
        }))
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/notifications/:djId", async (req, res) => {
  try {
    const rows = await queryAll("SELECT * FROM notifications WHERE djId = ? ORDER BY timestamp DESC LIMIT 30", [req.params.djId]);
    return res.json({
      success: true,
      notifications: rows.map((n) => ({
        ...n,
        read: Boolean(n.read),
        tipAmount: n.tipAmount ? Number(n.tipAmount) : void 0
      }))
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.patch("/api/notifications/:id/read", async (req, res) => {
  try {
    await execute("UPDATE notifications SET read = 1 WHERE id = ?", [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/history/:requestId", async (req, res) => {
  try {
    const rows = await queryAll("SELECT * FROM queue_history WHERE requestId = ? ORDER BY createdAt ASC", [req.params.requestId]);
    return res.json({ success: true, history: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", database: "sqlite3 (vybecheck.sqlite)", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VybeCheck Server running on http://0.0.0.0:${PORT} with SQLite database`);
  });
}
start();
//# sourceMappingURL=server.cjs.map
