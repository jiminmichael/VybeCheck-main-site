import React, { useState, useEffect } from 'react';
import { QrCode, X, Crown, Radio } from 'lucide-react';
import QRCode from 'qrcode';
import { store } from '../services/store';
import { SongRequestItem, EventItem } from '../types';

export const LiveStageScreen: React.FC = () => {
  const [currentEvent, setCurrentEvent] = useState<EventItem>(store.getCurrentEvent());
  const [requests, setRequests] = useState<SongRequestItem[]>(store.getRequests());
  const [currentTime, setCurrentTime] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    const update = () => {
      setCurrentEvent(store.getCurrentEvent());
      setRequests(store.getRequests());
    };

    update();
    const unsub = store.subscribe(update);
    return unsub;
  }, []);

  // Live Digital Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Generate QR
  useEffect(() => {
    const slug = currentEvent?.slug || 'live-matrix';
    const publicUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/#request/${slug}`
      : `https://vybecheckwithbama.live/request/${slug}`;

    QRCode.toDataURL(publicUrl, {
      width: 320,
      margin: 1.5,
      color: {
        dark: '#070708',
        light: '#E6D3A3',
      },
    }).then(setQrDataUrl).catch(() => {});
  }, [currentEvent?.slug]);

  const nowPlaying = requests.find((r) => r.status === 'playing');
  const upNext = requests
    .filter((r) => r.status === 'up_next')
    .sort((a, b) => a.queuePosition - b.queuePosition)
    .slice(0, 4);

  const col1Tracks = upNext.slice(0, 2);
  const col2Tracks = upNext.slice(2, 4);

  return (
    <div className="w-full min-h-[90vh] flex flex-col justify-between p-6 sm:p-12 lg:p-16 max-w-[1500px] mx-auto select-none relative">
      {/* HEADER */}
      <div className="flex justify-between items-center pb-8 border-b border-[rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-3">
          <span className="live-dot"></span>
          <span className="font-['Syne'] font-extrabold text-sm sm:text-base uppercase tracking-[0.25em] text-[#8F8C88]">
            LIVE REQUEST SCREEN
          </span>
        </div>

        <div className="flex items-center gap-6">
          {store.isAuthenticatedDJ() && <button
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] text-xs text-[#E6D3A3] hover:bg-[rgba(255,255,255,0.12)] transition-colors"
          >
            <QrCode className="w-4 h-4 text-[#C6A15B]" />
            <span className="hidden sm:inline uppercase tracking-wider font-semibold">Venue QR</span>
          </button>}

          <span className="font-['Syne'] text-base sm:text-lg font-bold tracking-widest text-[#F5F2ED]">
            {currentTime || '02:45:00 AM'}
          </span>
        </div>
      </div>

      {/* NOW PLAYING HERO SECTION */}
      <div className="py-12 sm:py-16 text-center">
        <div className="text-xs sm:text-sm uppercase tracking-[0.4em] text-[#4D7CFE] font-bold mb-4">
          NOW PLAYING
        </div>

        {nowPlaying ? (
          <>
            <div className="font-['Syne'] text-sm sm:text-lg uppercase tracking-[0.2em] text-[#8F8C88] mb-3">
              {nowPlaying.artist}
            </div>

            <h1 className="font-['Syne'] text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[0.95] text-transparent bg-clip-text bg-gradient-to-b from-[#FFFFFF] via-[#F5F2ED] to-[rgba(245,242,237,0.7)] max-w-5xl mx-auto mb-6">
              {nowPlaying.song}
            </h1>

            {nowPlaying.requesterName && (
              <p className="text-xs uppercase tracking-[0.2em] text-[#8F8C88]">
                Requested by <strong className="text-[#F5F2ED] font-semibold">{nowPlaying.requesterName}</strong>
                {nowPlaying.priority && <span className="text-[#C6A15B] ml-2">★ VIP</span>}
              </p>
            )}
          </>
        ) : (
          <div className="py-8">
            <h1 className="font-['Syne'] text-3xl sm:text-5xl font-extrabold text-[#F5F2ED] mb-3">
              LIVE ON THE DECKS
            </h1>
            <p className="text-xs uppercase tracking-[0.2em] text-[#8F8C88]">
              Scan to request the next track
            </p>
          </div>
        )}
      </div>

      {/* UP NEXT 2-COLUMN SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 pt-8 border-t border-[rgba(255,255,255,0.08)]">
        {/* Column 1 */}
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-[#C6A15B] font-semibold mb-6 flex items-center gap-2">
            <span>UP NEXT</span>
            <div className="h-[1px] flex-1 bg-[rgba(198,161,91,0.2)]"></div>
          </div>

          <div className="space-y-6">
            {col1Tracks.length > 0 ? (
              col1Tracks.map((item, idx) => (
                <div key={item.id} className="flex items-start gap-4 group">
                  <span className="font-['Syne'] text-2xl sm:text-3xl font-bold text-[#8F8C88] group-hover:text-[#F5F2ED] transition-colors leading-none pt-0.5">
                    0{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-['Syne'] text-lg sm:text-xl font-bold text-[#F5F2ED] truncate">
                      {item.song}
                    </h3>
                    <p className="text-xs uppercase tracking-wider text-[#8F8C88]">
                      {item.artist} • {item.genre}
                      {item.priority && <span className="text-[#C6A15B] ml-2 font-bold">★ VIP</span>}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-[#8F8C88] italic py-2">
                Queue opening soon...
              </div>
            )}
          </div>
        </div>

        {/* Column 2 */}
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-[#C6A15B] font-semibold mb-6 flex items-center gap-2">
            <span>UP NEXT</span>
            <div className="h-[1px] flex-1 bg-[rgba(198,161,91,0.2)]"></div>
          </div>

          <div className="space-y-6">
            {col2Tracks.length > 0 ? (
              col2Tracks.map((item, idx) => (
                <div key={item.id} className="flex items-start gap-4 group">
                  <span className="font-['Syne'] text-2xl sm:text-3xl font-bold text-[#8F8C88] group-hover:text-[#F5F2ED] transition-colors leading-none pt-0.5">
                    0{idx + 3}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-['Syne'] text-lg sm:text-xl font-bold text-[#F5F2ED] truncate">
                      {item.song}
                    </h3>
                    <p className="text-xs uppercase tracking-wider text-[#8F8C88]">
                      {item.artist} • {item.genre}
                      {item.priority && <span className="text-[#C6A15B] ml-2 font-bold">★ VIP</span>}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-[#8F8C88] italic py-2">
                Scan QR to be on this screen.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR MODAL */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0E0E12] border border-[rgba(255,255,255,0.14)] rounded-3xl p-8 max-w-sm w-full text-center relative shadow-2xl">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-[#8F8C88] hover:text-[#F5F2ED]"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[11px] uppercase tracking-[0.25em] text-[#C6A15B] font-semibold block mb-1">
              SCAN TO REQUEST
            </span>
            <h3 className="font-['Syne'] text-xl font-bold text-[#F5F2ED] mb-6">
              DROP YOUR TRACK
            </h3>

            {qrDataUrl && (
              <div className="p-4 bg-[#E6D3A3] rounded-2xl inline-block mb-6 shadow-xl">
                <img src={qrDataUrl} alt="Request Hub QR" className="w-56 h-56 rounded-lg" />
              </div>
            )}

            <p className="text-xs text-[#8F8C88]">
              Scan with your smartphone camera to submit requests directly to the DJ.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
