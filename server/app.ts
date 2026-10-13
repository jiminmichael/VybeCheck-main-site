import crypto from 'node:crypto';
import express from 'express';
import type { Request, Response } from 'express';
import { decodeAudioDataUrl } from './audio';
import { HttpError } from './domain';
import 'dotenv/config';
import { firebaseRoutes } from './firebaseRoutes';

const app = express();
app.use(express.json({ limit: '25mb', verify: (req, _res, buffer) => { (req as any).rawBody = buffer; } }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/api', firebaseRoutes);
// Genre mapper for music classification
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

// Suggested tracks from catalog searches; not a popularity chart.
app.get('/api/music/suggestions', async (req: Request, res: Response) => {
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
      return res.json({ suggestions: tracks });
    }
    return res.json({ suggestions: [] });
  } catch (err: any) {
    return res.json({ suggestions: [] });
  }
});

// ACRCloud Audio Recognition with Apple Music Enrichment
app.post('/api/music/identify', async (req: Request, res: Response) => {
  try {
    const { audioData } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: 'Please provide audio data.' });
    }

    const host = process.env.ACR_HOST || 'identify-eu-west-1.acrcloud.com';
    const accessKey = process.env.ACR_ACCESS_KEY;
    const accessSecret = process.env.ACR_ACCESS_SECRET;

    if (!accessKey || !accessSecret) {
      console.error('CRITICAL ERROR: ACRCloud keys missing in .env');
      return res.status(500).json({ error: 'Audio recognition engine offline. Check server environment variables.' });
    }

    // Clean base64 string and convert to Buffer
    const { buffer: audioBuffer, mimeType, filename } = decodeAudioDataUrl(audioData);

    // Build HMAC-SHA1 signature
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signatureVersion = '1';
    const dataType = 'audio';
    
    const stringToSign = ['POST', '/v1/identify', accessKey, dataType, signatureVersion, timestamp].join('\n');
    const signature = crypto
      .createHmac('sha1', accessSecret)
      .update(Buffer.from(stringToSign, 'utf-8'))
      .digest('base64');

    // Build multipart form data
    const formData = new FormData();
    formData.append('sample', new Blob([audioBuffer], { type: mimeType }), filename);
    formData.append('sample_bytes', audioBuffer.length.toString());
    formData.append('access_key', accessKey);
    formData.append('data_type', dataType);
    formData.append('signature_version', signatureVersion);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp);

    // Send to ACRCloud
    const acrResponse = await fetch(`https://${host}/v1/identify`, {
      method: 'POST',
      body: formData as any
    });

    const data = await acrResponse.json();

    // Match verification and Apple Music artwork enrichment
    if (data.status?.code === 0 && data.metadata && data.metadata.music) {
      const track = data.metadata.music[0];
      const songName = track.title;
      const artistName = track.artists ? track.artists[0].name : 'Unknown Artist';
      
      let finalArtworkUrl = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80';
      let audioPreviewUrl = '';
      let releaseYear = new Date().getFullYear();

      try {
        const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(`${songName} ${artistName}`)}&entity=song&limit=1`;
        const catRes = await fetch(searchUrl);
        if (catRes.ok) {
          const catData = await catRes.json();
          if (catData.results && catData.results.length > 0) {
            finalArtworkUrl = (catData.results[0].artworkUrl100 || '').replace('100x100bb', '600x600bb');
            audioPreviewUrl = catData.results[0].previewUrl || '';
            if (catData.results[0].releaseDate) {
              releaseYear = new Date(catData.results[0].releaseDate).getFullYear();
            }
          }
        }
      } catch (catErr) {
        console.warn('Could not fetch Apple Music artwork, defaulting to placeholder.');
      }

      return res.json({
        success: true,
        track: {
          song: songName,
          artist: artistName,
          genre: mapGenre(track.genres ? track.genres[0].name : '', songName, artistName),
          album: track.album ? track.album.name : 'Single',
          artworkUrl: finalArtworkUrl,
          previewUrl: audioPreviewUrl,
          releaseYear: releaseYear,
          confidence: track.score || 100,
          matchNotes: 'Acoustic fingerprint matched perfectly.'
        }
      });
    }

    return res.status(400).json({ 
      success: false, 
      error: "No match found. The club might be too loud, get closer to the speaker." 
    });

  } catch (error: any) {
    console.error('ACRCloud error:', error.message);
    return res.status(error instanceof HttpError ? error.status : 500).json({ success: false, error: error instanceof HttpError ? error.message : 'Internal server error processing audio.' });
  }
});

// -------------------------------------------------------------
// DJ MANAGEMENT & SQLITE PERSISTENCE
// -------------------------------------------------------------

// Get all DJs

app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: 'Cloud Firestore' }));
app.use('/api', (_req, res) => res.status(404).json({ success: false, error: 'Endpoint not found.' }));
export default app;
