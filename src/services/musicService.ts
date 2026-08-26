import { RealTrackSuggestion, Genre } from '../types';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AudioRecognitionResult {
  song: string;
  artist: string;
  genre: Genre;
  album?: string;
  artworkUrl?: string;
  previewUrl?: string;
  releaseYear?: number;
  confidence: number;
  lyricsOrHook?: string;
  matchNotes?: string;
}

class MusicService {
  private cache: Map<string, RealTrackSuggestion[]> = new Map();
  private activeAudio: HTMLAudioElement | null = null;
  private currentPlayingPreviewId: string | null = null;
  private previewListeners: Set<(trackId: string | null, isPlaying: boolean) => void> = new Set();

  /**
   * Search real tracks in real-time
   */
  public async searchTracks(query: string, limit = 10): Promise<RealTrackSuggestion[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      return [];
    }

    const cacheKey = `${trimmed.toLowerCase()}_${limit}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        const results: RealTrackSuggestion[] = data.results || [];
        this.cache.set(cacheKey, results);
        return results;
      }
    } catch (err) {
      console.warn('Backend music search failed, falling back to direct catalog query:', err);
    }

    // Direct fallback if backend proxy had network issue
    try {
      const directUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&entity=song&limit=${limit}&media=music`;
      const fallbackRes = await fetch(directUrl);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        const tracks: RealTrackSuggestion[] = (fallbackData.results || []).map((item: any) => ({
          id: `track-${item.trackId || Math.random().toString(36).substring(2, 8)}`,
          song: item.trackName || trimmed,
          artist: item.artistName || 'Unknown Artist',
          genre: this.inferGenre(item.primaryGenreName, item.trackName, item.artistName),
          album: item.collectionName || '',
          artworkUrl: (item.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
          previewUrl: item.previewUrl || '',
          releaseYear: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
          durationMs: item.trackTimeMillis,
        }));
        this.cache.set(cacheKey, tracks);
        return tracks;
      }
    } catch (fallbackErr) {
      console.error('All music search strategies failed:', fallbackErr);
    }

    return [];
  }

  /**
   * Fetch trending real party & club tracks
   */
  public async getTrendingTracks(): Promise<RealTrackSuggestion[]> {
    try {
      const res = await fetch('/api/music/trending');
      if (res.ok) {
        const data = await res.json();
        if (data.trending && data.trending.length > 0) {
          return data.trending;
        }
      }
    } catch (err) {}

    // Curated high-energy Afrobeats & Amapiano real tracks default
    return [
      {
        id: 'trend-burna-cityboys',
        song: 'City Boys',
        artist: 'Burna Boy',
        genre: 'Afrobeats',
        album: 'I Told Them...',
        artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/a4/9c/04/a49c043e-b8ba-0a4e-dbe7-f3ffdfebae8e/23UMGIM81561.rgb.jpg/600x600bb.jpg',
        releaseYear: 2023,
      },
      {
        id: 'trend-tyla-water',
        song: 'Water',
        artist: 'Tyla',
        genre: 'Amapiano',
        album: 'TYLA',
        artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/91/3d/8c/913d8cb3-36ea-dff7-9556-9a259972ba73/196871578335.jpg/600x600bb.jpg',
        releaseYear: 2023,
      },
      {
        id: 'trend-davido-unavailable',
        song: 'Unavailable (feat. Musa Keys)',
        artist: 'Davido',
        genre: 'Afrobeats',
        album: 'Timeless',
        artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/05/cf/8d/05cf8d71-5582-7473-b3eb-460cf64d3e5b/196871038594.jpg/600x600bb.jpg',
        releaseYear: 2023,
      },
      {
        id: 'trend-tylericu-mnike',
        song: 'Mnike (feat. DJ Maphorisa, Nandipha808)',
        artist: 'Tyler ICU & Tumelo.za',
        genre: 'Amapiano',
        album: 'Mnike - Single',
        artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/37/f3/d8/37f3d8a7-96a9-e854-e659-dbdb0f936f45/197188737224.jpg/600x600bb.jpg',
        releaseYear: 2023,
      },
      {
        id: 'trend-asake-lonely',
        song: 'Lonely At The Top',
        artist: 'Asake',
        genre: 'Afrobeats',
        album: 'Work of Art',
        artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/d9/bc/11/d9bc1133-7be1-8e99-4d69-cb1efc5fca91/197188849743.jpg/600x600bb.jpg',
        releaseYear: 2023,
      },
      {
        id: 'trend-shallipopi-cast',
        song: 'Cast (feat. ODUMODUBLVCK)',
        artist: 'Shallipopi',
        genre: 'Afrobeats',
        album: 'Presido La Pluto',
        artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/58/5b/ec/585bec8b-70c8-47bc-e177-3e1dfb003a89/197189578147.jpg/600x600bb.jpg',
        releaseYear: 2023,
      }
    ];
  }

  /**
   * Identify audio recording via AI Audio Recognition
   */
  public async identifyAudio(audioBlob: Blob, sampleDescription?: string): Promise<AudioRecognitionResult> {
    const base64Audio = await this.blobToBase64(audioBlob);

    const response = await fetch('/api/music/identify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioData: base64Audio,
        mimeType: audioBlob.type || 'audio/webm',
        sampleDescription: sampleDescription || 'Live mic recording from venue crowd',
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to identify song from audio');
    }

    const data = await response.json();
    if (!data.success || !data.track) {
      throw new Error(data.error || 'No matching song found');
    }

    return data.track as AudioRecognitionResult;
  }

  /**
   * Toggle 30s Audio Preview Playback
   */
  public playPreview(previewUrl: string, trackId: string) {
    if (this.currentPlayingPreviewId === trackId && this.activeAudio && !this.activeAudio.paused) {
      this.stopPreview();
      return;
    }

    this.stopPreview();

    if (!previewUrl) return;

    try {
      this.activeAudio = new Audio(previewUrl);
      this.currentPlayingPreviewId = trackId;
      this.notifyPreviewListeners(trackId, true);

      this.activeAudio.play().catch((err) => {
        console.warn('Audio preview autoplay blocked by browser:', err);
        this.stopPreview();
      });

      this.activeAudio.onended = () => {
        this.stopPreview();
      };
    } catch (e) {
      this.stopPreview();
    }
  }

  public stopPreview() {
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio = null;
    }
    const prevId = this.currentPlayingPreviewId;
    this.currentPlayingPreviewId = null;
    if (prevId) {
      this.notifyPreviewListeners(null, false);
    }
  }

  public subscribePreview(fn: (trackId: string | null, isPlaying: boolean) => void) {
    this.previewListeners.add(fn);
    return () => this.previewListeners.delete(fn);
  }

  private notifyPreviewListeners(trackId: string | null, isPlaying: boolean) {
    this.previewListeners.forEach((fn) => fn(trackId, isPlaying));
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private inferGenre(rawGenre: string = '', song: string = '', artist: string = ''): Genre {
    const combined = `${rawGenre} ${song} ${artist}`.toLowerCase();
    if (combined.includes('amapiano') || combined.includes('kabza') || combined.includes('tyler icu') || combined.includes('kelvin momo') || combined.includes('txc')) return 'Amapiano';
    if (combined.includes('3 step') || combined.includes('3-step') || combined.includes('thakzin')) return '3 STEP SA';
    if (combined.includes('afro house') || combined.includes('zakes') || combined.includes('black coffee')) return 'Afro House';
    if (combined.includes('dancehall') || combined.includes('reggae')) return 'Dancehall';
    if (combined.includes('hip hop') || combined.includes('rap')) return 'Hip Hop';
    if (combined.includes('r&b') || combined.includes('soul')) return 'R&B';
    if (combined.includes('house') || combined.includes('electronic') || combined.includes('techno')) return 'House';
    return 'Afrobeats';
  }
}

export const musicService = new MusicService();
