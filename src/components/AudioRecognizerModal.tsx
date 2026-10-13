import { Dialog } from './ui/Dialog';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Play, 
  Pause, 
  Radio, 
  Upload, 
  Disc3, 
  Zap 
} from 'lucide-react';
import { musicService, AudioRecognitionResult } from '../services/musicService';

interface AudioRecognizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSong: (result: AudioRecognitionResult) => void;
}

export const AudioRecognizerModal: React.FC<AudioRecognizerModalProps> = ({
  isOpen,
  onClose,
  onSelectSong,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [listenProgress, setListenProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedSong, setDetectedSong] = useState<AudioRecognitionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [visualizerBars, setVisualizerBars] = useState<number[]>([30, 60, 45, 90, 75, 40, 65, 80, 50, 70, 85, 40]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const openRef = useRef(isOpen);
  openRef.current = isOpen;
  const recognitionVersion = useRef(0);

  useEffect(() => {
    openRef.current = isOpen;
    const unsub = musicService.subscribePreview((trackId, isPlaying) => {
      setIsPlayingPreview(isPlaying);
    });
    return () => {
      unsub();
      openRef.current = false; recognitionVersion.current++;
      stopListening();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      recognitionVersion.current++;
      stopListening();
      setDetectedSong(null);
      setErrorMsg(null);
      setIsAnalyzing(false);
      setListenProgress(0);
      musicService.stopPreview();
    }
  }, [isOpen]);

  const startVisualizer = () => {
    animIntervalRef.current = setInterval(() => {
      setVisualizerBars(Array.from({ length: 14 }, () => Math.floor(Math.random() * 80) + 20));
    }, 120);
  };

  const stopVisualizer = () => {
    if (animIntervalRef.current) {
      clearInterval(animIntervalRef.current);
      animIntervalRef.current = null;
    }
    setVisualizerBars([20, 30, 25, 40, 35, 20, 30, 45, 25, 35, 40, 20]);
  };

  const startListening = async () => {
    setErrorMsg(null);
    setDetectedSong(null);
    setListenProgress(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!openRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        if (openRef.current) await processAudioForIdentification(audioBlob);
      };

      mediaRecorder.start();
      setIsListening(true);
      startVisualizer();

      let progress = 0;
      timerRef.current = setInterval(() => {
        progress += 20;
        setListenProgress(Math.min(progress, 100));

        if (progress >= 100) {
          stopListening();
        }
      }, 1000);
    } catch {
      setErrorMsg('Microphone access unavailable. You can upload an audio sample or test quick anthems below.');
      setIsListening(false);
      stopVisualizer();
    }
  };

  const stopListening = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopVisualizer();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsListening(false);
  };

  const processAudioForIdentification = async (audioBlob: Blob) => {
    const version = ++recognitionVersion.current;
    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const result = await musicService.identifyAudio(audioBlob);
      if (openRef.current && version === recognitionVersion.current) setDetectedSong(result);
    } catch (err: any) {
      if (openRef.current && version === recognitionVersion.current) setErrorMsg(err.message || 'Could not recognize the song. Please try holding your device closer.');
    } finally {
      if (openRef.current && version === recognitionVersion.current) setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    if (!/^audio\//.test(file.type) || file.size > 10 * 1024 * 1024 || !file.size) { setErrorMsg('Choose an audio file up to 10 MB (MP3, WAV, MP4, OGG, WebM, AAC, or FLAC).'); return; }
    setErrorMsg(null);
    setDetectedSong(null);
    void processAudioForIdentification(file);
  };

  const handleSongExample = async (sampleTitle: string, sampleArtist: string, sampleGenre: any) => {
    setErrorMsg(null);
    setDetectedSong(null);
    setIsAnalyzing(true);

    try {
      const tracks = await musicService.searchTracks(`${sampleTitle} ${sampleArtist}`, 1);
      const top = tracks[0];

      setDetectedSong({
        song: top ? top.song : sampleTitle,
        artist: top ? top.artist : sampleArtist,
        genre: sampleGenre,
        album: top?.album || 'Club Hit',
        artworkUrl: top?.artworkUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
        previewUrl: top?.previewUrl || '',
        releaseYear: top?.releaseYear ? Number(top.releaseYear) : 2024,
        confidence: 0,
        isExample: true,
        lyricsOrHook: 'Song example selected from the catalog.',
        matchNotes: 'This is a song example, not an audio recognition result.',
      });
    } catch {
      setErrorMsg('Failed to analyze sample.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog label="Audio song recognition" onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-[#0E0E12] border border-[rgba(255,255,255,0.14)] w-full max-w-md rounded-2xl p-6 sm:p-8 relative shadow-2xl space-y-6">
        {/* Close Button */}
        <button aria-label="Close dialog"
          onClick={onClose}
          className="absolute top-5 right-5 text-[#8F8C88] hover:text-[#F5F2ED]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#C6A15B] font-semibold block">
            AI AUDIO RECOGNITION
          </span>
          <h2 className="font-['Syne'] text-xl font-bold text-[#F5F2ED]">
            Listen to Ambient Music
          </h2>
          <p className="text-xs text-[#8F8C88] max-w-xs mx-auto">
            Hold your phone toward the speaker or hum the melody.
          </p>
        </div>

        {/* Main Recognition Viewport */}
        {!detectedSong && (
          <div className="flex flex-col items-center justify-center py-2 space-y-6">
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              disabled={isAnalyzing}
              className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all ${
                isListening
                  ? 'bg-[#8B3A3A] border-2 border-rose-400 text-white animate-pulse'
                  : isAnalyzing
                  ? 'bg-[rgba(91,63,209,0.2)] border-2 border-[#5B3FD1] text-[#4D7CFE]'
                  : 'bg-[rgba(91,63,209,0.25)] border border-[#5B3FD1] text-[#F5F2ED] hover:scale-105'
              }`}
            >
              {isListening ? (
                <>
                  <Mic className="w-7 h-7 animate-bounce" />
                  <span className="text-[9px] uppercase font-bold tracking-wider mt-1">Listening</span>
                </>
              ) : isAnalyzing ? (
                <>
                  <Disc3 className="w-7 h-7 animate-spin" />
                  <span className="text-[9px] uppercase font-bold tracking-wider mt-1">Matching</span>
                </>
              ) : (
                <>
                  <Mic className="w-7 h-7" />
                  <span className="text-[9px] uppercase font-bold tracking-wider mt-1">Tap Listen</span>
                </>
              )}
            </button>

            {/* Audio Waveform Bars */}
            {isListening && (
              <div className="w-full max-w-xs flex items-center justify-center gap-1.5 h-10 px-4 bg-[rgba(255,255,255,0.04)] rounded-xl border border-[rgba(255,255,255,0.06)]">
                {visualizerBars.map((height, i) => (
                  <div
                    key={i}
                    className="w-1 bg-[#4D7CFE] rounded-full transition-all duration-100"
                    style={{ height: `${height}%` }}
                  ></div>
                ))}
              </div>
            )}

            <div className="w-full space-y-2">
              <label htmlFor="audio-sample" className="block text-xs text-[#E6D3A3]">Upload an audio sample</label>
              <input id="audio-sample" type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/webm,audio/aac,audio/flac" onChange={handleFileUpload}
                disabled={isAnalyzing || isListening} aria-describedby={`audio-upload-help${errorMsg ? ' audio-error' : ''}`} className="block w-full text-xs" />
              <p id="audio-upload-help" className="text-xs text-[#8F8C88]">Choose a short recording up to 10 MB. Uploaded samples use the same recognition service as the microphone.</p>
              {isAnalyzing && <p role="status" className="text-xs">Identifying audio…</p>}
            </div>
            {/* Quick Anthem Samples */}
            <div className="w-full pt-4 border-t border-[rgba(255,255,255,0.08)] text-center space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-[#8F8C88] block">
                Song examples (no audio analysis):
              </span>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSongExample('City Boys', 'Burna Boy', 'Afrobeats')}
                  className="py-1 px-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.06)] text-xs text-[#8F8C88] hover:text-[#F5F2ED]"
                >
                  City Boys
                </button>
                <button
                  type="button"
                  onClick={() => handleSongExample('Water', 'Tyla', 'Amapiano')}
                  className="py-1 px-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.06)] text-xs text-[#8F8C88] hover:text-[#F5F2ED]"
                >
                  Water
                </button>
                <button
                  type="button"
                  onClick={() => handleSongExample('Mnike', 'Tyler ICU', 'Amapiano')}
                  className="py-1 px-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.06)] text-xs text-[#8F8C88] hover:text-[#F5F2ED]"
                >
                  Mnike
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {errorMsg && (
          <div id="audio-error" role="alert" className="p-3 rounded-xl bg-[rgba(139,58,58,0.2)] border border-[rgba(139,58,58,0.4)] text-[#F5F2ED] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Identified Song Result */}
        {detectedSong && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] flex items-center gap-3">
              <img
                src={detectedSong.artworkUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80'}
                alt={detectedSong.song}
                className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
              />

              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-[#2E8B7A] font-semibold block">
                  {detectedSong.isExample ? 'CATALOG EXAMPLE' : `${detectedSong.confidence}% MATCH`}
                </span>
                <h3 className="font-['Syne'] text-base font-bold text-[#F5F2ED] truncate">
                  {detectedSong.song}
                </h3>
                <p className="text-xs text-[#8F8C88] truncate">
                  {detectedSong.artist}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  onSelectSong(detectedSong);
                  onClose();
                }}
                className="btn btn-primary btn-full"
              >
                Use This Track
              </button>

              <button
                type="button"
                onClick={() => {
                  setDetectedSong(null);
                  setErrorMsg(null);
                  startListening();
                }}
                className="btn btn-ghost btn-full text-xs"
              >
                Listen Again
              </button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
