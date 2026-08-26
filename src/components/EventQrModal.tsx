import React, { useState, useEffect } from 'react';
import { QrCode, X, Copy, Check, Download, Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { EventItem, DJProfile } from '../types';
import { store } from '../services/store';

interface EventQrModalProps {
  event: EventItem;
  dj?: DJProfile | null;
  onClose: () => void;
}

export const EventQrModal: React.FC<EventQrModalProps> = ({ event, dj, onClose }) => {
  const currentDJ = dj || store.getCurrentDJ();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const requestUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/#request/${event.slug}`
    : `https://vybecheckwithbama.live/#request/${event.slug}`;

  useEffect(() => {
    QRCode.toDataURL(requestUrl, {
      width: 320,
      margin: 1.5,
      color: {
        dark: '#070708',
        light: '#E6D3A3',
      },
    }).then(setQrDataUrl).catch(() => {});
  }, [requestUrl]);

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(requestUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `VybeCheck_QR_${currentDJ ? currentDJ.handle : event.slug}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0E0E12] border border-[rgba(255,255,255,0.14)] rounded-2xl max-w-sm w-full p-6 sm:p-8 relative text-center shadow-2xl space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8F8C88] hover:text-[#F5F2ED]"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <span className="text-[11px] uppercase tracking-[0.25em] text-[#C6A15B] font-semibold block mb-1">
            VENUE QR CODE
          </span>
          <h2 className="font-['Syne'] text-xl font-bold text-[#F5F2ED]">
            {currentDJ ? currentDJ.stageName : event.name}
          </h2>
          <p className="text-xs text-[#8F8C88] mt-1">
            {currentDJ ? currentDJ.defaultVenue : event.venue}
          </p>
        </div>

        {qrDataUrl && (
          <div className="p-4 bg-[#E6D3A3] rounded-2xl inline-block shadow-2xl">
            <img src={qrDataUrl} alt="Event QR Code" className="w-52 h-52 rounded-lg mx-auto" />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl p-2 text-xs">
            <input
              type="text"
              readOnly
              value={requestUrl}
              className="bg-transparent text-[#8F8C88] flex-1 outline-none font-mono text-[11px] px-2 truncate"
            />
            <button
              onClick={handleCopyLink}
              className="px-3 py-1 rounded-lg bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.14)] text-[#F5F2ED] font-semibold transition-colors flex items-center gap-1 flex-shrink-0 text-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#2E8B7A]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleDownloadQr}
              className="btn btn-gold text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save PNG</span>
            </button>

            <button
              onClick={() => window.print()}
              className="btn btn-ghost text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
