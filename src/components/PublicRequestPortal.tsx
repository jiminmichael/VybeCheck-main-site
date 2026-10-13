import { nextSuggestionIndex } from '../services/suggestionNavigation';
import { TrackingActions } from './ui/TrackingActions';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  ChevronDown, 
  Search, 
  Play, 
  Pause, 
  Mic, 
  X, 
  Crown, 
  ShieldCheck, 
  Zap 
} from 'lucide-react';
import { Genre, SongRequestItem, EventItem, RealTrackSuggestion } from '../types';
import { store } from '../services/store';
import { musicService, AudioRecognitionResult } from '../services/musicService';
import { AudioRecognizerModal } from './AudioRecognizerModal';

const GENRES: Genre[] = [
  'Afrobeats',
  'Amapiano',
  '3 STEP SA',
  'Afro House',
  'Hip Hop',
  'R&B',
  'Dancehall',
  'House',
  'Electronic',
  'Other',
];

const TIP_TIERS = [
  { amount: 10000, label: '₦10,000', type: 'Priority', signature: false },
  { amount: 25000, label: '₦25,000', type: 'Priority', signature: false },
  { amount: 50000, label: '₦50,000', type: 'Priority', signature: false },
  { amount: 100000, label: '₦100,000', type: 'Signature', signature: true },
  { amount: 250000, label: '₦250,000', type: 'Signature', signature: true },
  { amount: 500000, label: '₦500,000', type: 'Signature', signature: true },
];

interface PublicRequestPortalProps {
  onTrackRequest: (token: string) => void;
  onLaunchPaystack: (req: SongRequestItem, tipAmount: number) => void;
}

export const PublicRequestPortal: React.FC<PublicRequestPortalProps> = ({
  onTrackRequest,
  onLaunchPaystack,
}) => {
  const [currentEvent, setCurrentEvent] = useState<EventItem | undefined>(store.getCurrentEvent());

  // Form State
  const [song, setSong] = useState('');
  const [artist, setArtist] = useState('');
  const [genre, setGenre] = useState<Genre>('Afrobeats');
  const [requesterName, setRequesterName] = useState('');
  const [dedication, setDedication] = useState('');
  const [honeypot, setHoneypot] = useState('');

  // Selected Track Metadata from Real Catalog or Audio AI
  const [selectedTrackMeta, setSelectedTrackMeta] = useState<RealTrackSuggestion | null>(null);
  const [isAudioIdentified, setIsAudioIdentified] = useState(false);
  const [audioConfidence, setAudioConfidence] = useState<number | undefined>(undefined);

  // Real-time suggestions & search state
  const [suggestions, setSuggestions] = useState<RealTrackSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [songError, setSongError] = useState(false);
  const searchVersion = useRef(0);
  const songInputRef = useRef<HTMLInputElement>(null);

  // Audio Preview state
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);

  // Audio Recognition Modal
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  
  // Submission & Success State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedRequest, setSubmittedRequest] = useState<SongRequestItem | null>(null);

  // Priority Section in Success View
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [selectedTip, setSelectedTip] = useState<number | null>(50000);
  const [customTip, setCustomTip] = useState('');

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to store events
  useEffect(() => {
    const unsubStore = store.subscribe(() => {
      setCurrentEvent(store.getCurrentEvent());
    });
    return unsubStore;
  }, []);

  // Audio Preview & Click-Outside setup
  useEffect(() => {
    const unsub = musicService.subscribePreview((trackId, isPlaying) => {
      setActivePreviewId(isPlaying ? trackId : null);
    });

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsub();
      document.removeEventListener('mousedown', handleClickOutside);
      musicService.stopPreview();
    };
  }, []);

  // Real-time search suggestions when song or artist changes
  const cancelSearch = () => {
    searchVersion.current++;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setIsLoadingSuggestions(false);
    setActiveSuggestion(-1);
  };
  useEffect(() => () => {
    searchVersion.current++;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, []);

  const handleSongInputChange = (value: string) => {
    cancelSearch();
    const version = searchVersion.current;
    setSong(value);
    if (songError && value.trim()) { setSongError(false); setErrorMessage(null); }
    setSelectedTrackMeta(null);
    setIsAudioIdentified(false);
    setSuggestions([]);
    setSearchError('');
    setHasSearched(false);
    if (value.trim().length < 2) { setShowSuggestions(false); return; }
    setShowSuggestions(true);
    setIsLoadingSuggestions(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await musicService.searchTracks(value.trim(), 6);
        if (version === searchVersion.current) { setSuggestions(results); setHasSearched(true); }
      } catch {
        if (version === searchVersion.current) setSearchError('Search is unavailable. Enter the song title and artist manually.');
      } finally {
        if (version === searchVersion.current) setIsLoadingSuggestions(false);
      }
    }, 200);
  };
  const handleSongKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); setShowSuggestions(false); setActiveSuggestion(-1); return; }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
      event.preventDefault(); setShowSuggestions(true);
      const index = nextSuggestionIndex(event.key, activeSuggestion, suggestions.length);
      setActiveSuggestion(index);
      document.getElementById(`song-option-${index}`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && showSuggestions && activeSuggestion >= 0) {
      event.preventDefault(); handleSelectSuggestion(suggestions[activeSuggestion]);
    }
  };

  const handleSelectSuggestion = (track: RealTrackSuggestion) => {
    cancelSearch(); setSongError(false); setErrorMessage(null); setSearchError('');
    setSong(track.song);
    setArtist(track.artist);
    setGenre(track.genre || 'Other');
    setSelectedTrackMeta(track);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleApplyAudioRecognition = (result: AudioRecognitionResult) => {
    cancelSearch(); setSongError(false); setErrorMessage(null); setSearchError(''); setShowSuggestions(false); setSuggestions([]);
    setSong(result.song);
    setArtist(result.artist);
    setGenre(result.genre || 'Other');
    setIsAudioIdentified(!result.isExample);
    setAudioConfidence(result.isExample ? undefined : result.confidence);
    setSelectedTrackMeta({
      id: `ai-${Date.now()}`,
      song: result.song,
      artist: result.artist,
      genre: result.genre,
      album: result.album,
      artworkUrl: result.artworkUrl,
      previewUrl: result.previewUrl,
      releaseYear: result.releaseYear,
      identifiedConfidence: result.confidence,
      matchNotes: result.matchNotes,
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!song.trim()) {
      setSongError(true); songInputRef.current?.focus();
      setErrorMessage('Please enter a song title or search an artist.');
      return;
    }

    if (!currentEvent) {
      setErrorMessage('Preparing the live session. Please try again shortly.');
      return;
    }

    setIsSubmitting(true);

    setTimeout(async () => {
      const res = await store.createRequest({
        eventId: currentEvent.id,
        song: song.trim(),
        artist: artist.trim() || 'Featured Artist',
        genre,
        requesterName: requesterName.trim() || 'Dancefloor Guest',
        dedication: dedication.trim() || undefined,
        tipAmount: 0,
        honeypot,
        artworkUrl: selectedTrackMeta?.artworkUrl,
        previewUrl: selectedTrackMeta?.previewUrl,
        album: selectedTrackMeta?.album,
        identifiedViaAudio: isAudioIdentified,
        audioConfidence: audioConfidence,
      });

      setIsSubmitting(false);

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to submit song request.');
      } else if (res.request) {
        setSubmittedRequest(res.request);
      }
    }, 350);
  };

  const handleConfirmPriority = () => {
    if (!submittedRequest || !currentEvent?.tipsEnabled) return;
    let tip = selectedTip || 50000;
    if (customTip) {
      const parsed = Number(customTip);
      if (!isNaN(parsed) && parsed > 0) {
        tip = parsed;
      }
    }
    if (!Number.isFinite(tip) || tip < currentEvent.minTip || tip > currentEvent.maxTip) { setErrorMessage(`Choose a tip between ₦${currentEvent.minTip.toLocaleString()} and ₦${currentEvent.maxTip.toLocaleString()}.`); return; }
    onLaunchPaystack(submittedRequest, tip);
  };

  const handleReset = () => {
    cancelSearch(); setSongError(false); setSuggestions([]); setSearchError(''); setHasSearched(false); setShowSuggestions(false);
    setSong('');
    setArtist('');
    setGenre('Afrobeats');
    setRequesterName('');
    setDedication('');
    setSelectedTrackMeta(null);
    setIsAudioIdentified(false);
    setAudioConfidence(undefined);
    setSubmittedRequest(null);
    setPriorityOpen(false);
    setErrorMessage(null);
  };

  return (
    <div className="max-w-[480px] mx-auto px-6 py-10 sm:py-16">
      {/* HERO SECTION */}
      <header className="pt-4 pb-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-6 h-[1px] bg-[#C6A15B]"></div>
          <span className="text-[11px] uppercase tracking-[0.25em] text-[#8F8C88] font-medium">
            VYBECHECKWITHBAMA
          </span>
        </div>

        <h1 className="font-['Syne'] text-[2.25rem] sm:text-[3rem] font-extrabold leading-[0.95] tracking-[-0.03em] text-[#F5F2ED]">
          REQUEST THE SOUND.<br />
          CHECK THE VYBE.
        </h1>

        <p className="mt-6 text-[#8F8C88] text-[15px] leading-[1.6]">
          Your moment.<br />
          Your sound.<br />
          <span className="text-[#F5F2ED] font-medium">One request away from the dance floor.</span>
        </p>
      </header>

      {/* REQUEST FORM / SUCCESS STATE */}
      {!submittedRequest ? (
        <form onSubmit={handleSubmit} className="bg-[rgba(255,255,255,0.06)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 sm:p-8 relative">
          {errorMessage && (
            <div id="request-error" role="alert" className="mb-6 p-3 rounded-lg bg-[rgba(139,58,58,0.2)] border border-[#8B3A3A] text-xs text-[#F5F2ED]">
              {errorMessage}
            </div>
          )}

          {/* Selected Track Pill */}
          {selectedTrackMeta && (
            <div className="mb-6 p-3 rounded-xl bg-[rgba(255,255,255,0.06)] border border-[rgba(77,124,254,0.3)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {selectedTrackMeta.artworkUrl && (
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 relative">
                    <img
                      src={selectedTrackMeta.artworkUrl}
                      alt={selectedTrackMeta.song}
                      className="w-full h-full object-cover"
                    />
                    {selectedTrackMeta.previewUrl && (
                      <button aria-label={`${activePreviewId === selectedTrackMeta.id ? "Pause" : "Play"} preview of ${selectedTrackMeta.song}`}
                        type="button"
                        onClick={() => musicService.playPreview(selectedTrackMeta.previewUrl!, selectedTrackMeta.id)}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center text-white"
                      >
                        {activePreviewId === selectedTrackMeta.id ? (
                          <Pause className="w-4 h-4 text-[#4D7CFE]" />
                        ) : (
                          <Play className="w-4 h-4 fill-[#4D7CFE] text-[#4D7CFE]" />
                        )}
                      </button>
                    )}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-['Syne'] font-bold text-[#F5F2ED] truncate">
                    {selectedTrackMeta.song}
                  </p>
                  <p className="text-[11px] text-[#8F8C88] truncate">
                    {selectedTrackMeta.artist}
                  </p>
                </div>
              </div>

              <button aria-label="Clear selected song"
                type="button"
                onClick={() => setSelectedTrackMeta(null)}
                className="p-1 text-[#8F8C88] hover:text-[#F5F2ED]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Form Group 1: Song Search */}
          <div className="mb-7" ref={dropdownRef}>
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="request-song" className="text-[11px] uppercase tracking-[0.25em] text-[#8F8C88] font-medium">
                WHAT DO YOU WANT TO HEAR?
              </label>

              {/* Inline Shazam Button */}
              <button aria-label="Audio Identify: recognize a song using microphone or upload"
                type="button"
                onClick={() => setIsAudioModalOpen(true)}
                className="text-[10px] uppercase tracking-wider text-[#4D7CFE] hover:text-white flex items-center gap-1 transition-colors"
                title="Identify song from mic"
              >
                <Mic className="w-3 h-3 text-[#4D7CFE]" />
                <span>Audio Identify</span>
              </button>
            </div>

            <div className="relative">
              <input
                id="request-song" ref={songInputRef} role="combobox" aria-autocomplete="list"
                aria-expanded={showSuggestions && suggestions.length > 0}
                aria-controls={showSuggestions && suggestions.length > 0 ? 'song-suggestions' : undefined}
                aria-activedescendant={showSuggestions && activeSuggestion >= 0 ? `song-option-${activeSuggestion}` : undefined}
                aria-invalid={songError} aria-describedby={`song-help song-search-status${songError ? ' request-error' : ''}`}
                onKeyDown={handleSongKeyDown}
                type="text"
                className="form-input pr-8"
                placeholder="Search song or artist"
                autoComplete="off"
                value={song}
                onChange={(e) => handleSongInputChange(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
              />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[#8F8C88] pointer-events-none">
                {isLoadingSuggestions ? (
                  <div className="w-4 h-4 border-2 border-[#4D7CFE] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </div>
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div id="song-suggestions" role="listbox" aria-label="Song suggestions" className="absolute left-4 right-4 mt-2 z-30 bg-[#0E0E12]/95 backdrop-blur-2xl border border-[rgba(255,255,255,0.14)] rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-[rgba(255,255,255,0.06)]">
                {suggestions.map((item, index) => (
                  <div
                    key={item.id} id={`song-option-${index}`} role="option" aria-selected={activeSuggestion === index}
                    onMouseDown={e => e.preventDefault()}
                    style={activeSuggestion === index ? { background: 'rgba(77,124,254,0.2)' } : undefined}
                    className="p-3 hover:bg-[rgba(255,255,255,0.06)] transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    onClick={() => handleSelectSuggestion(item)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.artworkUrl && (
                        <img
                          src={item.artworkUrl}
                          alt={item.song}
                          className="w-8 h-8 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#F5F2ED] truncate">
                          {item.song}
                        </p>
                        <p className="text-[10px] text-[#8F8C88] truncate">
                          {item.artist}
                        </p>
                      </div>
                    </div>

                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[#8F8C88]">
                      {item.genre}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p id="song-search-status" role="status" className="mt-2 text-xs text-[#8F8C88]">
              {isLoadingSuggestions ? 'Searching songs…' : searchError || (hasSearched && !suggestions.length ? 'No songs found. Enter the song title and artist manually.' : hasSearched ? `${suggestions.length} suggestions available. Use Up and Down arrows, then Enter to select.` : '')}
            </p>
            <div id="song-help" className="mt-2 text-xs text-[#8F8C88]">
              Search or enter a song title manually. Add the artist below.
            </div>
          </div>

          {/* Form Group 2: Artist (if custom entered) */}
          <div className="mb-7">
            <label htmlFor="publicrequestportal-artist-name" className="text-[11px] uppercase tracking-[0.25em] text-[#8F8C88] font-medium block mb-3">
              ARTIST NAME
            </label>
            <input id="publicrequestportal-artist-name"
              type="text"
              className="form-input"
              placeholder="e.g. Burna Boy, Asake, Tyla"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
            />
          </div>

          <div className="mb-8">
            <label htmlFor="request-genre" className="text-[11px] uppercase tracking-[0.25em] text-[#8F8C88] font-medium block mb-3">SELECT THE VYBE</label>
            <select id="request-genre" value={genre} onChange={e => setGenre(e.target.value as Genre)} className="form-input w-full bg-[#0E0E12]">
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* Guest Name & Dedication */}
          <div className="grid grid-cols-2 gap-4 mb-8 pt-2 border-t border-[rgba(255,255,255,0.06)]">
            <div>
              <label htmlFor="publicrequestportal-your-name-table" className="text-[10px] uppercase tracking-wider text-[#8F8C88] block mb-1">
                Your Name / Table
              </label>
              <input id="publicrequestportal-your-name-table"
                type="text"
                className="w-full bg-transparent border-b border-[rgba(255,255,255,0.14)] py-1.5 text-xs text-[#F5F2ED] focus:border-[#4D7CFE]"
                placeholder="e.g. Ade (Table 4)"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="publicrequestportal-dedication" className="text-[10px] uppercase tracking-wider text-[#8F8C88] block mb-1">
                Dedication
              </label>
              <input id="publicrequestportal-dedication"
                type="text"
                className="w-full bg-transparent border-b border-[rgba(255,255,255,0.14)] py-1.5 text-xs text-[#F5F2ED] focus:border-[#4D7CFE]"
                placeholder="Birthday shoutout"
                value={dedication}
                onChange={(e) => setDedication(e.target.value)}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !currentEvent?.requestsEnabled}
            className="btn btn-primary btn-full"
          >
            {isSubmitting ? 'Sending Request...' : 'Send Request'}
          </button>
        </form>
      ) : (
        /* SUCCESS STATE */
        <div className="bg-[rgba(255,255,255,0.06)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 sm:p-8 text-center">
          <div className="w-16 h-16 rounded-full border border-[#2E8B7A] flex items-center justify-center mx-auto mb-6 bg-[rgba(46,139,122,0.1)]">
            <Check className="w-7 h-7 text-[#2E8B7A]" />
          </div>

          <div className="text-[11px] uppercase tracking-[0.25em] text-[#2E8B7A] font-semibold mb-2">
            REQUEST RECEIVED
          </div>

          <h2 className="font-['Syne'] text-2xl font-bold text-[#F5F2ED] mb-1 tracking-tight">
            {submittedRequest.song}
          </h2>
          <p className="text-[#8F8C88] text-xs uppercase tracking-wider mb-8">
            {submittedRequest.artist} • {submittedRequest.genre}
          </p>

          <div className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] p-4 rounded-xl mb-6 flex justify-between items-center">
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#8F8C88]">
              IN THE QUEUE
            </span>
            <span className="font-['Syne'] text-3xl font-bold text-[#F5F2ED]">
              Pending
            </span>
          </div>

          <TrackingActions token={submittedRequest.trackingToken} />

          <button
            type="button"
            onClick={() => onTrackRequest(submittedRequest.trackingToken)}
            className="btn btn-ghost btn-full mb-3"
          >
            Track My Request
          </button>

          <button
            type="button"
            disabled={!currentEvent?.tipsEnabled}
            onClick={() => setPriorityOpen(!priorityOpen)}
            className="btn btn-gold btn-full mb-3"
          >
            {!currentEvent?.tipsEnabled ? 'Tips are paused' : currentEvent.autoPriority ? 'Make it a Priority' : 'Tip the DJ'}
          </button>

          {errorMessage && <p id="tip-error" role="alert" className="text-sm text-rose-300">{errorMessage}</p>}
          {/* PRIORITY & TIP SECTION */}
          {priorityOpen && currentEvent?.tipsEnabled && (
            <div className="mt-8 pt-8 border-t border-[rgba(255,255,255,0.08)] text-left">
              <span className="text-[11px] uppercase tracking-[0.25em] text-[#C6A15B] font-semibold block">
                PRIORITY ACCESS
              </span>
              <h3 className="font-['Syne'] text-xl font-bold text-[#F5F2ED] mt-2 mb-1">
                MAKE YOUR REQUEST COUNT
              </h3>
              <p className="text-[#8F8C88] text-sm mb-6">
                {currentEvent?.autoPriority ? 'Verified tips receive VIP priority. The DJ controls playback.' : 'Support the DJ. Tips do not change your queue priority in this session.'}
              </p>

              {/* Tip Grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {TIP_TIERS.map((tier) => {
                  const isSelected = selectedTip === tier.amount && !customTip;
                  return (
                    <button type="button" aria-pressed={isSelected}
                      key={tier.amount}
                      onClick={() => {
                        setSelectedTip(tier.amount);
                        setCustomTip(''); setErrorMessage(null);
                      }}
                      className={`p-4 rounded-xl text-center cursor-pointer transition-all border ${
                        isSelected
                          ? 'border-[#C6A15B] bg-[rgba(198,161,91,0.08)] shadow-[0_4px_20px_rgba(198,161,91,0.15)]'
                          : tier.signature
                          ? 'border-[rgba(198,161,91,0.3)] bg-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.14)]'
                          : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.14)]'
                      }`}
                    >
                      <div className={`font-['Syne'] text-base font-bold ${isSelected ? 'text-[#E6D3A3]' : 'text-[#F5F2ED]'}`}>
                        {tier.label}
                      </div>
                      <div className={`text-[9px] uppercase tracking-[0.2em] mt-1 ${tier.signature ? 'text-[#C6A15B]' : 'text-[#8F8C88]'}`}>
                        {tier.type}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Tip Input */}
              <label htmlFor="publicrequestportal-set-your-own-vybe" className="text-[11px] uppercase tracking-[0.25em] text-[#8F8C88] block mt-5 mb-2">
                SET YOUR OWN VYBE
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8F8C88] font-medium">
                  ₦
                </span>
                <input id="publicrequestportal-set-your-own-vybe" aria-describedby={`tip-help${errorMessage ? " tip-error" : ""}`}
                  type="number"
                  placeholder="Enter amount"
                  className="w-full bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] rounded-xl py-3 pl-8 pr-4 text-center text-sm text-[#F5F2ED] focus:border-[#C6A15B] outline-none"
                  value={customTip}
                  onChange={(e) => { setCustomTip(e.target.value); setErrorMessage(null); }}
                />
              </div>

              <div id="tip-help" className="mt-3 text-center text-xs text-[#8F8C88]">
                Allowed tips: ₦{currentEvent?.minTip.toLocaleString()}–₦{currentEvent?.maxTip.toLocaleString()}
              </div>

              <button
                type="button"
                onClick={handleConfirmPriority}
                className="btn btn-gold btn-full mt-5"
              >
                Continue to payment
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-[#8F8C88] hover:text-[#F5F2ED] mt-6 transition-colors"
          >
            Submit another request
          </button>
        </div>
      )}

      {/* Audio Recognition Modal */}
      <AudioRecognizerModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
        onSelectSong={handleApplyAudioRecognition}
      />
    </div>
  );
};
