import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  X, 
  Copy, 
  Check, 
  Download, 
  Printer, 
  Share2, 
  Sparkles, 
  Crown, 
  Tv, 
  MapPin, 
  Radio,
  Sliders,
  Flame,
  CheckCircle2
} from 'lucide-react';
import QRCode from 'qrcode';
import { DJProfile } from '../types';

interface DJPersonalQrModalProps {
  dj: DJProfile;
  onClose: () => void;
}

const QR_THEMES = [
  { id: 'cyber-cyan', name: 'Cyber Cyan', dark: '#080410', light: '#00f0ff', border: 'border-cyan-400', badge: 'bg-cyan-950 text-cyan-300 border-cyan-400' },
  { id: 'neon-purple', name: 'Neon Purple', dark: '#080410', light: '#c084fc', border: 'border-purple-500', badge: 'bg-purple-950 text-purple-300 border-purple-400' },
  { id: 'gold-vip', name: 'Gold VIP', dark: '#080410', light: '#facc15', border: 'border-amber-400', badge: 'bg-amber-950 text-amber-300 border-amber-400' },
  { id: 'emerald-wave', name: 'Emerald Wave', dark: '#080410', light: '#34d399', border: 'border-emerald-400', badge: 'bg-emerald-950 text-emerald-300 border-emerald-400' },
];

export const DJPersonalQrModal: React.FC<DJPersonalQrModalProps> = ({ dj, onClose }) => {
  const [selectedTheme, setSelectedTheme] = useState(
    QR_THEMES.find((t) => t.id === dj.qrTheme) || QR_THEMES[0]
  );
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [fullProjectorMode, setFullProjectorMode] = useState(false);

  const personalRequestUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/#request/${dj.handle}`
    : `https://vybecheckwithbama.live/#request/${dj.handle}`;

  useEffect(() => {
    QRCode.toDataURL(personalRequestUrl, {
      width: 400,
      margin: 1.5,
      color: {
        dark: selectedTheme.dark,
        light: selectedTheme.light,
      },
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('QR Generation failed:', err));
  }, [personalRequestUrl, selectedTheme]);

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(personalRequestUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `VybeCheck_QR_${dj.handle}_${selectedTheme.id}.png`;
    a.click();
  };

  const handlePrintFlyer = () => {
    window.print();
  };

  // Fullscreen club projector mode
  if (fullProjectorMode) {
    return (
      <div className="fixed inset-0 z-50 bg-[#05020c] flex flex-col items-center justify-center p-6 text-center select-none">
        <button
          onClick={() => setFullProjectorMode(false)}
          className="absolute top-6 right-6 px-4 py-2 rounded-xl bg-purple-950/80 hover:bg-purple-900 text-slate-300 hover:text-white border border-purple-800 text-xs font-bold transition-all"
        >
          Exit Projector Mode (ESC)
        </button>

        <div className="max-w-xl mx-auto space-y-6">
          <div className="flex items-center justify-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-sm font-black uppercase tracking-widest text-cyan-400">
              LIVE REQUEST BOOTH OPEN
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white font-['Outfit'] tracking-tight">
            {dj.stageName}
          </h1>

          <p className="text-lg text-purple-300 font-medium">
            {dj.defaultVenue}
          </p>

          {qrDataUrl && (
            <div className={`p-6 bg-white rounded-3xl inline-block shadow-2xl border-8 ${selectedTheme.border} animate-pulse`}>
              <img src={qrDataUrl} alt={dj.stageName} className="w-72 h-72 sm:w-96 sm:h-96 rounded-2xl mx-auto" />
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xl sm:text-2xl font-black text-white font-['Outfit'] uppercase">
              {dj.customQrTagline || 'SCAN WITH PHONE TO REQUEST YOUR TRACK'}
            </p>
            <p className="text-sm font-mono text-cyan-400">
              {personalRequestUrl}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-panel rounded-3xl max-w-2xl w-full border border-purple-800/60 p-6 sm:p-8 relative shadow-2xl my-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-purple-950/80 hover:bg-purple-900 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-cyan-400/60 flex-shrink-0">
            <img src={dj.avatarUrl} alt={dj.stageName} className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-md border border-cyan-500/40">
                PERSONALIZED DJ QR CODE
              </span>
              <span className="text-xs text-purple-300 font-mono">@{dj.handle}</span>
            </div>
            <h2 className="text-2xl font-black text-white font-['Outfit'] tracking-tight">
              {dj.stageName}
            </h2>
          </div>
        </div>

        {/* Center Grid: QR Display + Customizer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center mb-6">
          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center bg-[#090418] p-6 rounded-2xl border border-purple-900/60 text-center">
            {qrDataUrl ? (
              <div className={`p-3 bg-white rounded-2xl shadow-2xl border-4 ${selectedTheme.border} mb-3`}>
                <img src={qrDataUrl} alt={dj.stageName} className="w-48 h-48 sm:w-52 sm:h-52 rounded-lg mx-auto" />
              </div>
            ) : (
              <div className="w-52 h-52 flex items-center justify-center">
                <span className="text-xs text-slate-400 animate-pulse">Rendering custom QR...</span>
              </div>
            )}

            <p className="text-xs font-black text-white font-['Outfit'] uppercase">
              {dj.stageName}
            </p>
            <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
              {dj.defaultVenue}
            </p>
          </div>

          {/* Theme and Customization */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                QR Color Styling
              </label>
              <div className="grid grid-cols-2 gap-2">
                {QR_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedTheme(theme)}
                    className={`p-2 rounded-xl border text-xs font-bold text-left transition-all flex items-center justify-between ${
                      selectedTheme.id === theme.id
                        ? `${theme.badge} shadow-md`
                        : 'bg-[#0c061e] text-slate-400 border-purple-900/40 hover:text-white'
                    }`}
                  >
                    <span>{theme.name}</span>
                    {selectedTheme.id === theme.id && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Unique Link Field */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Your Direct Crowd Link
              </label>
              <div className="flex items-center gap-1.5 bg-[#0c061e] border border-purple-900/60 rounded-xl p-1.5">
                <input
                  type="text"
                  readOnly
                  value={personalRequestUrl}
                  className="bg-transparent text-slate-300 text-xs font-mono px-2 flex-1 outline-none truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors flex items-center gap-1 flex-shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-300 hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-cyan-500/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download High-Res QR PNG</span>
              </button>

              <button
                type="button"
                onClick={() => setFullProjectorMode(true)}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-purple-300 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Tv className="w-3.5 h-3.5 text-cyan-400" />
                <span>Launch Club Screen Projector</span>
              </button>
            </div>
          </div>
        </div>

        {/* Printable Standee Preview Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 via-[#0d0720] to-indigo-950/60 border border-purple-800/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center flex-shrink-0">
              <Printer className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-white">
                Club Table Standee & Booth Flyer
              </p>
              <p className="text-[11px] text-slate-400">
                Ready-to-print poster with your branding, QR code, and 3-step crowd guide.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePrintFlyer}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-all flex items-center gap-1.5 flex-shrink-0"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Print Table Standee</span>
          </button>
        </div>
      </div>
    </div>
  );
};
