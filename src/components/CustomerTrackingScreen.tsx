import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Crown, 
  Sparkles, 
  RefreshCw, 
  Search, 
  Music, 
  ArrowLeft 
} from 'lucide-react';
import { SongRequestItem, RequestStatus } from '../types';
import { store } from '../services/store';

interface CustomerTrackingScreenProps {
  initialToken?: string;
  onLaunchPaystack: (req: SongRequestItem, tipAmount: number) => void;
  onRequestNewSong: () => void;
}

export const CustomerTrackingScreen: React.FC<CustomerTrackingScreenProps> = ({
  initialToken,
  onLaunchPaystack,
  onRequestNewSong,
}) => {
  const [tokenInput, setTokenInput] = useState(initialToken || '');
  const [activeToken, setActiveToken] = useState(initialToken || '');
  const [request, setRequest] = useState<SongRequestItem | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (initialToken) {
      setActiveToken(initialToken);
      setTokenInput(initialToken);
    }
  }, [initialToken]);

  useEffect(() => {
    const update = () => {
      if (activeToken) {
        const found = store.getRequestByToken(activeToken);
        setRequest(found);
      } else {
        const all = store.getRequests();
        if (all.length > 0) {
          setRequest(all[0]);
          setActiveToken(all[0].trackingToken);
          setTokenInput(all[0].trackingToken);
        }
      }
    };

    update();
    const unsub = store.subscribe(update);
    return unsub;
  }, [activeToken]);

  const handleSearchToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenInput.trim()) {
      setActiveToken(tokenInput.trim());
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      if (activeToken) {
        setRequest(store.getRequestByToken(activeToken));
      }
      setIsRefreshing(false);
    }, 400);
  };

  const getStatusConfig = (status: RequestStatus) => {
    switch (status) {
      case 'pending':
        return {
          label: 'IN THE QUEUE',
          title: 'Request Received',
          subtitle: 'The DJ is reviewing your track for the live set.',
          color: 'text-[#8F8C88]',
          badge: 'bg-[rgba(255,255,255,0.06)] text-[#8F8C88] border border-[rgba(255,255,255,0.08)]',
          icon: <Clock className="w-6 h-6 text-[#8F8C88]" />,
          progress: 33,
        };
      case 'up_next':
        return {
          label: 'UP NEXT',
          title: 'Almost Time',
          subtitle: 'Your song is queued up next on the deck.',
          color: 'text-[#C6A15B]',
          badge: 'bg-[rgba(198,161,91,0.15)] text-[#C6A15B] border border-[#C6A15B]/30',
          icon: <Play className="w-6 h-6 text-[#C6A15B] fill-current" />,
          progress: 66,
        };
      case 'playing':
        return {
          label: 'NOW PLAYING',
          title: 'Live On The Decks',
          subtitle: 'Turn up! Your track is rocking the room right now.',
          color: 'text-[#4D7CFE]',
          badge: 'bg-[rgba(77,124,254,0.2)] text-[#4D7CFE] border border-[#4D7CFE]/40',
          icon: <Sparkles className="w-6 h-6 text-[#4D7CFE]" />,
          progress: 100,
        };
      case 'played':
        return {
          label: 'PLAYED',
          title: 'Completed',
          subtitle: 'Thanks for bringing the vybe! Hope you loved the spin.',
          color: 'text-[#2E8B7A]',
          badge: 'bg-[rgba(46,139,122,0.15)] text-[#2E8B7A] border border-[#2E8B7A]/30',
          icon: <CheckCircle2 className="w-6 h-6 text-[#2E8B7A]" />,
          progress: 100,
        };
      case 'rejected':
        return {
          label: 'DECLINED',
          title: 'Unable to Play',
          subtitle: 'The track did not match current BPM or energy. Try another sound!',
          color: 'text-[#8B3A3A]',
          badge: 'bg-[rgba(139,58,58,0.15)] text-[#8B3A3A] border border-[#8B3A3A]/30',
          icon: <XCircle className="w-6 h-6 text-[#8B3A3A]" />,
          progress: 0,
        };
    }
  };

  return (
    <div className="max-w-[500px] mx-auto px-6 py-10 sm:py-16">
      {/* HEADER */}
      <div className="flex items-center justify-between pb-6 mb-8 border-b border-[rgba(255,255,255,0.08)]">
        <div>
          <span className="text-[11px] uppercase tracking-[0.25em] text-[#8F8C88] font-medium block mb-1">
            LIVE TRACKING
          </span>
          <h1 className="font-['Syne'] text-2xl font-extrabold text-[#F5F2ED]">
            MY REQUEST
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            className="p-2 rounded-xl bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[#8F8C88] hover:text-[#F5F2ED] transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onRequestNewSong}
            className="text-xs text-[#8F8C88] hover:text-[#F5F2ED] flex items-center gap-1 transition-colors px-2 py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* SEARCH BAR FOR TOKEN */}
      <form onSubmit={handleSearchToken} className="mb-8">
        <div className="relative">
          <input
            type="text"
            placeholder="Tracking code (e.g. TRK-AFRO-9821)"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="form-input pr-10 font-mono text-xs"
          />
          <button
            type="submit"
            className="absolute right-0 top-1/2 -translate-y-1/2 text-[#8F8C88] hover:text-[#F5F2ED]"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* TRACKING DETAILS CARD */}
      {request ? (
        (() => {
          const config = getStatusConfig(request.status);
          return (
            <div className="bg-[rgba(255,255,255,0.06)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 sm:p-8 space-y-6">
              {/* Status Header */}
              <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase tracking-[0.2em] font-semibold px-3 py-1 rounded-full ${config.badge}`}>
                  {config.label}
                </span>

                {request.priority ? (
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[#C6A15B] font-semibold flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-[#C6A15B]" />
                    VIP ₦{request.tipAmount.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-xs font-mono text-[#8F8C88]">
                    #{request.queuePosition < 10 ? `0${request.queuePosition}` : request.queuePosition}
                  </span>
                )}
              </div>

              {/* Progress Indicator */}
              <div className="w-full bg-[rgba(255,255,255,0.06)] rounded-full h-1 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#5B3FD1] to-[#4D7CFE] transition-all duration-500"
                  style={{ width: `${config.progress}%` }}
                />
              </div>

              {/* Track Info */}
              <div className="text-center py-2">
                <h2 className="font-['Syne'] text-2xl font-bold text-[#F5F2ED] mb-1">
                  {request.song}
                </h2>
                <p className="text-xs uppercase tracking-wider text-[#8F8C88]">
                  {request.artist} • {request.genre}
                </p>
                {request.dedication && (
                  <p className="text-xs italic text-[#E6D3A3] mt-2">
                    "{request.dedication}"
                  </p>
                )}
              </div>

              {/* Status Message */}
              <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 text-center">
                <p className="font-['Syne'] text-sm font-semibold text-[#F5F2ED] mb-0.5">
                  {config.title}
                </p>
                <p className="text-xs text-[#8F8C88]">
                  {config.subtitle}
                </p>
              </div>

              {/* VIP Boost Option if Pending */}
              {request.status === 'pending' && !request.priority && (
                <div className="pt-4 border-t border-[rgba(255,255,255,0.08)]">
                  <button
                    onClick={() => onLaunchPaystack(request, 50000)}
                    className="btn btn-gold btn-full"
                  >
                    Boost with VIP Priority
                  </button>
                </div>
              )}

              {/* Bottom Actions */}
              <div className="text-center pt-2">
                <button
                  onClick={onRequestNewSong}
                  className="text-xs text-[#8F8C88] hover:text-[#F5F2ED] transition-colors"
                >
                  Submit another request
                </button>
              </div>
            </div>
          );
        })()
      ) : (
        <div className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-8 text-center space-y-4">
          <Music className="w-10 h-10 text-[#8F8C88] mx-auto opacity-50" />
          <p className="font-['Syne'] text-base font-bold text-[#F5F2ED]">
            No Active Request Found
          </p>
          <p className="text-xs text-[#8F8C88]">
            Check your tracking code or submit a new song to the DJ.
          </p>
          <button
            onClick={onRequestNewSong}
            className="btn btn-primary"
          >
            Request a Song
          </button>
        </div>
      )}
    </div>
  );
};
