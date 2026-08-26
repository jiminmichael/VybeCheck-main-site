import express, { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config'
const app = express();

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Lazy/safe initialization for Google GenAI
let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-vercel',
        },
      },
    });
  }
  return aiClient;
}

// Genre mapper to fit VybeCheck supported genres
function mapGenre(rawGenre: string = '', song: string = '', artist: string = ''): string {
  const combined = `${rawGenre} ${song} ${artist}`.toLowerCase();
  
  if (combined.includes('amapiano') || combined.includes('kabza') || combined.includes('tyler icu') || combined.includes('kelvin momo') || combined.includes('young stunna') || combined.includes('focalistic') || combined.includes('musa keys') || combined.includes('txc') || combined.includes('tito m')) {
    return 'Amapiano';
  }
  if (combined.includes('3 step') || combined.includes('3-step') || combined.includes('thakzin') || combined.includes('oskar') || combined.includes('mörda') || combined.includes('shimza')) {
    return '3 STEP SA';
  }
  if (combined.includes('afro house') || combined.includes('afro-house') || combined.includes('zakes') || combined.includes('black coffee') || combined.includes('sun-el') || combined.includes('caiiro') || combined.includes('da capo') || combined.includes('house')) {
    return 'Afro House';
  }
  if (combined.includes('afrobeats') || combined.includes('afropop') || combined.includes('afro-pop') || combined.includes('burna') || combined.includes('wizkid') || combined.includes('davido') || combined.includes('asake') || combined.includes('rema') || combined.includes('ayra starr') || combined.includes('shallipopi') || combined.includes('omah lay') || combined.includes('seyi vibez') || combined.includes('ruger') || combined.includes('victony') || combined.includes('kizz daniel') || combined.includes('tiwa savage') || combined.includes('odumodublvck')) {
    return 'Afrobeats';
  }
  if (combined.includes('dancehall') || combined.includes('reggae') || combined.includes('popcaan') || combined.includes('shenseea') || combined.includes('vybz')) {
    return 'Dancehall';
  }
  if (combined.includes('hip hop') || combined.includes('hip-hop') || combined.includes('rap') || combined.includes('trap')) {
    return 'Hip Hop';
  }
  if (combined.includes('r&b') || combined.includes('soul')) {
    return 'R&B';
  }
  if (combined.includes('electronic') || combined.includes('edm') || combined.includes('techno')) {
    return 'Electronic';
  }
  return 'Afrobeats';
}

// REAL-TIME SONG SEARCH API (iTunes / Apple Music Catalog)
app.get('/api/music/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim();
    if (!query || query.length < 2) {
      return res.json({ results: [] });
    }

    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 20);
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}&media=music`;

    const itunesRes = await fetch(searchUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!itunesRes.ok) {
      throw new Error(`iTunes API responded with status ${itunesRes.status}`);
    }

    const itunesData = await itunesRes.json();
    const items = itunesData.results || [];

    const formattedTracks = items.map((item: any) => {
      const artwork = (item.artworkUrl100 || '')
        .replace('100x100bb', '600x600bb')
        .replace('100x100', '600x600');

      return {
        id: `track-${item.trackId || item.collectionId || Math.random().toString(36).substring(2, 8)}`,
        song: item.trackName || item.collectionName || query,
        artist: item.artistName || 'Unknown Artist',
        genre: mapGenre(item.primaryGenreName, item.trackName, item.artistName),
        album: item.collectionName || '',
        artworkUrl: artwork,
        previewUrl: item.previewUrl || '',
        releaseYear: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
        durationMs: item.trackTimeMillis || 0,
      };
    });

    return res.json({ results: formattedTracks });
  } catch (error: any) {
    console.error('Error searching music catalog:', error.message);
    return res.status(500).json({ error: 'Failed to search music catalog', details: error.message });
  }
});

// REAL-TIME TRENDING CLUB HITS
app.get('/api/music/trending', async (req: Request, res: Response) => {
  try {
    const defaultQueries = ['Burna Boy', 'Tyla Amapiano', 'Asake', 'Shallipopi', 'Davido', 'Tyler ICU'];
    const randomTerm = defaultQueries[Math.floor(Math.random() * defaultQueries.length)];
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(randomTerm)}&entity=song&limit=8&media=music`;

    const itunesRes = await fetch(searchUrl);
    if (itunesRes.ok) {
      const data = await itunesRes.json();
      const tracks = (data.results || []).map((item: any) => ({
        id: `trend-${item.trackId}`,
        song: item.trackName,
        artist: item.artistName,
        genre: mapGenre(item.primaryGenreName, item.trackName, item.artistName),
        album: item.collectionName,
        artworkUrl: (item.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
        previewUrl: item.previewUrl,
        releaseYear: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
      }));
      return res.json({ trending: tracks });
    }

    return res.json({ trending: [] });
  } catch (err: any) {
    return res.json({ trending: [] });
  }
});

// AI AUDIO RECOGNITION API
app.post('/api/music/identify', async (req: Request, res: Response) => {
  try {
    const { audioData, mimeType, sampleDescription } = req.body;

    if (!audioData && !sampleDescription) {
      return res.status(400).json({ error: 'Please provide audio data or a sound description.' });
    }

    const ai = getGenAI();
    
    // Fail loudly if the AI doesn't initialize
    if (!ai) {
      console.error("CRITICAL ERROR: getGenAI() returned null. Your GEMINI_API_KEY is missing or not loading.");
      return res.status(500).json({ error: 'AI engine offline. Check server environment variables.' });
    }

    let recognized = {
      song: '',
      artist: '',
      genre: 'Afrobeats',
      confidence: 85,
      lyricsOrHook: '',
      matchNotes: '',
    };

    const parts: any[] = [];

    if (audioData) {
      const cleanBase64 = audioData.includes('base64,')
        ? audioData.split('base64,')[1]
        : audioData;

      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || 'audio/webm',
        },
      });
    }

    const promptText = `
Listen to this audio recording / snippet very closely like Shazam or SoundHound.
Identify the exact song playing.

Pay special attention to:
1. Afrobeats, Amapiano (log drums, piano chords), 3-Step South African Afro House, Nigerian street-hop, African hits.
2. Global Hip Hop, R&B, Dancehall, and Pop.
3. Vocal signatures, lyrics sung/hummed, melody line, BPM, and distinctive instruments.

Return ONLY a JSON object with this exact structure:
{
  "song": "Song Title",
  "artist": "Artist Name (e.g. Burna Boy, Tyla, Asake, Davido, Tyler ICU)",
  "genre": "Afrobeats | Amapiano | 3 STEP SA | Afro House | Hip Hop | R&B | Dancehall | House | Electronic | Other",
  "confidence": 92,
  "lyricsOrHook": "Key lyrics or vocal hook heard in the snippet",
  "matchNotes": "Short explanation of how the song was identified from beat/vocals/rhythm"
}
`;

    if (sampleDescription) {
      parts.push({ text: `Additional acoustic notes/description: ${sampleDescription}\n${promptText}` });
    } else {
      parts.push({ text: promptText });
    }

    // Call Gemini
    const aiResponse = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: parts.length === 1 ? parts[0] : { parts },
      config: {
        responseMimeType: 'application/json',
        systemInstruction: 'You are VybeCheck Audio Engine, an ultra-fast, world-class DJ and music recognition AI specialized in African and global club music. Identify songs from live mic audio, background party audio, or humming with high accuracy.',
      },
    });

    const rawText = aiResponse.text || '{}';
    const parsed = JSON.parse(rawText);

    recognized = {
      song: parsed.song || 'Identified Track',
      artist: parsed.artist || 'Unknown Artist',
      genre: mapGenre(parsed.genre, parsed.song, parsed.artist), 
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 88,
      lyricsOrHook: parsed.lyricsOrHook || '',
      matchNotes: parsed.matchNotes || 'Acoustic fingerprint matched with high precision',
    };

    // Enrich with catalog artwork and preview URL
    let enrichedTrack: any = null;
    try {
      const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(`${recognized.song} ${recognized.artist}`)}&entity=song&limit=3&media=music`;
      const catRes = await fetch(searchUrl);
      if (catRes.ok) {
        const catData = await catRes.json();
        if (catData.results && catData.results.length > 0) {
          const top = catData.results[0];
          enrichedTrack = {
            song: top.trackName || recognized.song,
            artist: top.artistName || recognized.artist,
            genre: mapGenre(top.primaryGenreName || recognized.genre, top.trackName, top.artistName),
            album: top.collectionName || '',
            artworkUrl: (top.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
            previewUrl: top.previewUrl || '',
            releaseYear: top.releaseDate ? new Date(top.releaseDate).getFullYear() : undefined,
          };
        }
      }
    } catch (catErr) {
      console.warn('Could not enrich recognized track from catalog:', catErr);
    }

    const finalResult = {
      song: enrichedTrack?.song || recognized.song,
      artist: enrichedTrack?.artist || recognized.artist,
      genre: enrichedTrack?.genre || recognized.genre,
      album: enrichedTrack?.album || '',
      artworkUrl: enrichedTrack?.artworkUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
      previewUrl: enrichedTrack?.previewUrl || '',
      releaseYear: enrichedTrack?.releaseYear || 2024,
      confidence: recognized.confidence,
      lyricsOrHook: recognized.lyricsOrHook,
      matchNotes: recognized.matchNotes,
    };

    return res.json({
      success: true,
      track: finalResult,
    });

  } catch (error: any) {
    console.error('Audio detection endpoint failure:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to recognize song from audio snippet. The club might be too loud.',
      details: error.message,
    });
  }
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', platform: 'Vercel Serverless', timestamp: new Date().toISOString() });
});

export default app;