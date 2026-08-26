import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Check, 
  X, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  Search, 
  Crown, 
  Radio, 
  Eye, 
  AlertTriangle,
  Trash2,
  Volume2,
  VolumeX,
  Zap,
  Sliders,
  DollarSign,
  Wallet
} from 'lucide-react';
import { SongRequestItem, EventItem, Genre, DJProfile, DJNotification } from '../types';
import { store } from '../services/store';
import { soundEngine } from '../services/soundEffects';
import { WithdrawalModal } from './WithdrawalModal';

interface DJDashboardProps {
  onOpenQr: () => void;
  onNavigateToLiveStage: () => void;
  onNavigateToProfile?: () => void;
}

export const DJDashboard: React.FC<DJDashboardProps> = ({
  onOpenQr,
  onNavigateToLiveStage,
  onNavigateToProfile,
}) => {
  const [currentEvent, setCurrentEvent] = useState<EventItem>(store.getCurrentEvent());
  const [currentDJ, setCurrentDJ] = useState<DJProfile>(store.getCurrentDJ());
  const [events, setEvents] = useState<EventItem[]>(store.getEvents());
  const [requests, setRequests] = useState<SongRequestItem[]>(store.getRequests());
  const [soundEnabled, setSoundEnabled] = useState(soundEngine.isEnabled());
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState<string>('ALL');
  const [vipOnly, setVipOnly] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Track does not fit the current BPM set');
  const [newEventName, setNewEventName] = useState('');
  const [newEventVenue, setNewEventVenue] = useState('');
  const [eventError, setEventError] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      setCurrentEvent(store.getCurrentEvent());
      setCurrentDJ(store.getCurrentDJ());
      setEvents(store.getEvents());
      setRequests(store.getRequests());
    };

    update();
    const unsub = store.subscribe(update);
    return unsub;
  }, []);

  // Controls Toggles
  const handleToggleRequests = () => {
    if (!currentEvent) return;
    store.updateEventControls(currentEvent.id, {
      requestsEnabled: !currentEvent.requestsEnabled,
    });
  };

  const handleToggleAutoPriority = () => {
    if (!currentEvent) return;
    store.updateEventControls(currentEvent.id, {
      autoPriority: !currentEvent.autoPriority,
    });
  };

  const handleTogglePublicQueue = () => {
    if (!currentEvent) return;
    store.updateEventControls(currentEvent.id, {
      publicQueueEnabled: !currentEvent.publicQueueEnabled,
    });
  };

  const handleToggleTips = () => {
    if (!currentEvent) return;
    store.updateEventControls(currentEvent.id, {
      tipsEnabled: !currentEvent.tipsEnabled,
    });
  };

  const handleToggleSound = () => {
    const newState = soundEngine.toggleSound();
    setSoundEnabled(newState);
  };

  const handleCreateEvent = async () => {
    setEventError(null);
    const result = await store.createEvent(newEventName, newEventVenue);
    if (!result.success) { setEventError(result.error || 'Could not create event.'); return; }
    setNewEventName('');
    setNewEventVenue('');
  };

  // Queue Operations
  const handleAddToQueue = (id: string) => store.addToQueue(id);
  const handlePlay = (id: string) => store.playRequest(id);
  const handleMarkPlayed = (id: string) => store.markPlayed(id);
  const handleMoveUp = (id: string) => store.moveQueueItem(id, 'up');
  const handleMoveDown = (id: string) => store.moveQueueItem(id, 'down');

  const handlePlayNext = () => {
    const nextReq = upNextRequests[0] || newRequests[0];
    if (nextReq) {
      store.playRequest(nextReq.id);
    }
  };

  const handleConfirmReject = (id: string) => {
    store.rejectRequest(id, rejectReason);
    setRejectingId(null);
  };

  // Filtered Lists
  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.song.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.requesterName && r.requesterName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesGenre = genreFilter === 'ALL' || r.genre?.toUpperCase() === genreFilter.toUpperCase();
    const matchesVip = !vipOnly || r.priority;

    return matchesSearch && matchesGenre && matchesVip;
  });

  const newRequests = filteredRequests.filter((r) => r.status === 'pending');
  const upNextRequests = filteredRequests
    .filter((r) => r.status === 'up_next')
    .sort((a, b) => a.queuePosition - b.queuePosition);
  const nowPlaying = requests.find((r) => r.status === 'playing');

  // Metrics
  const totalRequestsCount = requests.length;
  const vipCount = requests.filter((r) => r.priority).length;
  const totalTipsNaira = requests.reduce((acc, r) => acc + (r.tipAmount || 0), 0);

  const formatCurrency = (amt: number) => {
    if (amt >= 1000000) return `₦${(amt / 1000000).toFixed(1)}M`;
    if (amt >= 1000) return `₦${(amt / 1000).toFixed(0)}K`;
    return `₦${amt}`;
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* DJ HEADER */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[rgba(255,255,255,0.08)] mb-8">
        <div>
          <div className="font-['Syne'] font-extrabold text-xl tracking-tight text-[#F5F2ED]">
            VYBECHECK
          </div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-[#8F8C88] mt-1">
            <span className="live-dot"></span>
            <span>LIVE SESSION</span>
          </div>
        </div>

        <div className="text-center">
          <strong className="text-sm font-medium text-[#F5F2ED] block mb-0.5">
            {currentEvent?.name || 'Lagos Nights: The Exclusive'}
          </strong>
          <span className="text-xs text-[#8F8C88]">
            {currentEvent?.venue || 'Club Matrix VIP Lounge'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-[#F5F2ED]">
              {currentDJ?.stageName || 'DJ BAMA'}
            </div>
            <button
              onClick={() => onNavigateToProfile && onNavigateToProfile()}
              className="text-[11px] text-[#8F8C88] hover:text-[#F5F2ED] transition-colors"
            >
              Profile Settings
            </button>
          </div>
          <div 
            onClick={() => onNavigateToProfile && onNavigateToProfile()}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5B3FD1] to-[#4D7CFE] flex items-center justify-center text-xs font-bold text-[#F5F2ED] cursor-pointer hover:scale-105 transition-transform"
          >
            {currentDJ ? currentDJ.stageName.substring(0, 2).toUpperCase() : 'DB'}
          </div>
        </div>
      </header>

      {/* METRICS ROW (5 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        <div className="bg-[#0E0E12] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#8F8C88]">Requests</span>
          <span className="font-['Syne'] text-3xl font-bold text-[#F5F2ED] mt-2 leading-none">
            {totalRequestsCount < 10 ? `0${totalRequestsCount}` : totalRequestsCount}
          </span>
        </div>

        <div className="bg-[#0E0E12] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#8F8C88]">Up Next</span>
          <span className="font-['Syne'] text-3xl font-bold text-[#F5F2ED] mt-2 leading-none">
            {upNextRequests.length < 10 ? `0${upNextRequests.length}` : upNextRequests.length}
          </span>
        </div>

        <div className="bg-[#0E0E12] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#8F8C88]">Playing</span>
          <span className="font-['Syne'] text-3xl font-bold text-[#F5F2ED] mt-2 leading-none">
            {nowPlaying ? '01' : '00'}
          </span>
        </div>

        <div className="bg-[#0E0E12] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#8F8C88]">VIP</span>
          <span className="font-['Syne'] text-3xl font-bold text-[#E6D3A3] mt-2 leading-none">
            {vipCount < 10 ? `0${vipCount}` : vipCount}
          </span>
        </div>

        <div 
          onClick={() => setIsWithdrawalOpen(true)}
          className="bg-[#0E0E12] border border-[#C6A15B]/30 hover:border-[#C6A15B] rounded-xl p-4 flex flex-col justify-between min-h-[90px] cursor-pointer transition-all hover:bg-[#C6A15B]/5 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.15em] text-[#C6A15B] font-semibold">Wallet / Tips</span>
            <span className="text-[9px] uppercase tracking-wider bg-[#C6A15B]/20 text-[#E6D3A3] px-1.5 py-0.5 rounded font-bold">
              Withdraw
            </span>
          </div>
          <span className="font-['Syne'] text-2xl sm:text-3xl font-bold text-[#E6D3A3] mt-2 leading-none truncate group-hover:scale-[1.02] transition-transform">
            {formatCurrency(currentDJ?.availableBalance || totalTipsNaira)}
          </span>
        </div>
      </div>

      {/* QUICK CONTROLS & SEARCH BAR */}
      <div className="bg-[#0E0E12] border border-[rgba(255,255,255,0.08)] rounded-xl p-3.5 mb-4 flex flex-wrap items-center gap-2">
        <select value={currentEvent?.id || ''} onChange={(event) => store.setCurrentEvent(event.target.value)} className="form-input text-xs flex-1 min-w-[180px]">
          {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
        </select>
        <input value={newEventName} onChange={(event) => setNewEventName(event.target.value)} placeholder="New event name" className="form-input text-xs flex-1 min-w-[160px]" />
        <input value={newEventVenue} onChange={(event) => setNewEventVenue(event.target.value)} placeholder="Venue" className="form-input text-xs flex-1 min-w-[160px]" />
        <button onClick={handleCreateEvent} className="btn btn-gold text-xs">Create Event</button>
        {eventError && <span className="text-xs text-rose-400 basis-full">{eventError}</span>}
      </div>
      <div className="bg-[#0E0E12] border border-[rgba(255,255,255,0.08)] rounded-xl p-3.5 mb-8 flex flex-wrap items-center justify-between gap-3">
        {/* Quick Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleToggleRequests}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
              currentEvent?.requestsEnabled
                ? 'bg-[#2E8B7A]/15 text-[#2E8B7A] border border-[#2E8B7A]/30'
                : 'bg-[#8B3A3A]/15 text-[#8B3A3A] border border-[#8B3A3A]/30'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${currentEvent?.requestsEnabled ? 'bg-[#2E8B7A]' : 'bg-[#8B3A3A]'}`}></span>
            <span>{currentEvent?.requestsEnabled ? 'Requests Open' : 'Requests Closed'}</span>
          </button>

          <button
            onClick={() => setIsWithdrawalOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider bg-[#C6A15B]/15 hover:bg-[#C6A15B]/25 text-[#E6D3A3] border border-[#C6A15B]/30 transition-colors flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-[#C6A15B]" />
            <span>Instant Cashout</span>
          </button>

          <button
            onClick={handleToggleAutoPriority}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
              currentEvent?.autoPriority
                ? 'bg-[rgba(198,161,91,0.15)] text-[#C6A15B] border border-[#C6A15B]/30'
                : 'bg-[rgba(255,255,255,0.04)] text-[#8F8C88]'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-[#C6A15B]" />
            <span>Auto VIP {currentEvent?.autoPriority ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={onNavigateToLiveStage}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] text-[#F5F2ED] transition-colors flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5 text-[#4D7CFE]" />
            <span>Live Screen</span>
          </button>

          <button
            onClick={onOpenQr}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] text-[#F5F2ED] transition-colors flex items-center gap-1.5"
          >
            <Radio className="w-3.5 h-3.5 text-[#4D7CFE]" />
            <span>Event QR</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <input
            type="text"
            placeholder="Filter requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[#4D7CFE] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[#F5F2ED] placeholder-[#8F8C88] outline-none"
          />
          <Search className="w-3.5 h-3.5 text-[#8F8C88] absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* DASHBOARD 3-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* COLUMN 1: NEW REQUESTS */}
        <div className="bg-[#0E0E12] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 min-h-[400px]">
          <div className="flex justify-between items-center pb-4 mb-5 border-b border-[rgba(255,255,255,0.08)]">
            <span className="text-xs uppercase tracking-[0.2em] text-[#8F8C88] font-medium">
              New Requests
            </span>
            <span className="text-[11px] bg-[rgba(255,255,255,0.06)] px-2 py-0.5 rounded text-[#F5F2ED] font-medium">
              {newRequests.length}
            </span>
          </div>

          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {newRequests.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#8F8C88]">
                No pending requests right now.
              </div>
            ) : (
              newRequests.map((req, idx) => (
                <div
                  key={req.id}
                  className={`bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.14)] rounded-xl p-4 transition-all group ${
                    req.priority ? 'border-l-2 border-l-[#C6A15B]' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-['Syne'] text-sm font-bold text-[#8F8C88]">
                      {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                    </span>
                    <span className="text-[9px] uppercase tracking-[0.15em] px-2 py-1 bg-[rgba(255,255,255,0.05)] rounded text-[#8F8C88]">
                      {req.genre}
                    </span>
                  </div>

                  <h4 className="font-['Syne'] text-base font-semibold leading-tight text-[#F5F2ED] mb-1">
                    {req.song}
                  </h4>
                  <p className="text-xs uppercase tracking-wider text-[#8F8C88] mb-3">
                    {req.artist}
                  </p>

                  <div className="flex justify-between items-center pt-3 border-t border-[rgba(255,255,255,0.08)]">
                    <span className="text-[11px] uppercase tracking-[0.1em] text-[#8F8C88]">
                      Req. by {req.requesterName || 'Guest'}
                    </span>
                    {req.priority && (
                      <span className="text-[10px] uppercase tracking-[0.15em] text-[#C6A15B] flex items-center gap-1 font-semibold">
                        <Crown className="w-3 h-3 text-[#C6A15B]" />
                        ₦{req.tipAmount.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Actions on hover/touch */}
                  <div className="flex gap-1.5 mt-3 pt-2 border-t border-[rgba(255,255,255,0.04)]">
                    <button
                      onClick={() => handleAddToQueue(req.id)}
                      className="flex-1 bg-[rgba(91,63,209,0.2)] border border-[#5B3FD1] hover:bg-[#5B3FD1] text-[#F5F2ED] py-2 px-2 rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Queue</span>
                    </button>
                    <button
                      onClick={() => handlePlay(req.id)}
                      className="flex-1 bg-[rgba(77,124,254,0.2)] border border-[#4D7CFE] hover:bg-[#4D7CFE] text-[#F5F2ED] py-2 px-2 rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                    >
                      <span>Play Now</span>
                    </button>
                    <button
                      onClick={() => setRejectingId(req.id)}
                      className="p-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#8F8C88] hover:text-[#8B3A3A] hover:border-[#8B3A3A] transition-colors"
                      title="Reject"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: NOW PLAYING CENTERPIECE */}
        <div className="bg-transparent border-none p-0">
          <div className="bg-gradient-to-b from-[#0E0E12] to-[rgba(91,63,209,0.06)] border border-[rgba(255,255,255,0.14)] rounded-[20px] p-8 text-center relative overflow-hidden">
            {/* Ambient Radial Pulse */}
            <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(77,124,254,0.1)_0%,transparent_60%)] ambient-pulse pointer-events-none" />

            <div className="relative z-10">
              <span className="text-[11px] uppercase tracking-[0.3em] text-[#4D7CFE] mb-6 block font-semibold">
                NOW PLAYING
              </span>

              {nowPlaying ? (
                <>
                  <div className="font-['Syne'] text-xs uppercase tracking-[0.2em] text-[#8F8C88] mb-2">
                    {nowPlaying.artist}
                  </div>
                  <h2 className="font-['Syne'] text-3xl sm:text-4xl font-extrabold leading-none text-[#F5F2ED] mb-8 tracking-tight">
                    {nowPlaying.song}
                  </h2>

                  {/* 13-Bar Animated Waveform */}
                  <div className="flex items-center justify-center gap-1 h-10 mb-8">
                    <div className="wave-bar" style={{ animationDelay: '0s' }}></div>
                    <div className="wave-bar" style={{ animationDelay: '0.1s' }}></div>
                    <div className="wave-bar" style={{ animationDelay: '0.2s' }}></div>
                    <div className="wave-bar" style={{ animationDelay: '0.3s' }}></div>
                    <div className="wave-bar" style={{ animationDelay: '0.4s' }}></div>
                    <div className="wave-bar" style={{ animationDelay: '0.5s' }}></div>
                    <div className="wave-bar" style={{ animationDelay: '0.6s' }}></div>
                    <div className="wave-bar" style={{ animationDelay: '0.5s' }}></div>
                    <div className="wave-bar" style={{ animationDelay: '0.4s' }}></div>
                    <div className="wave-bar" style={{ animationDelay: '0.3s' }}></div>
                    <div className="wave-bar" style={{ animationDelay: '0.2s' }}></div>
                    <div className="wave-bar" style={{ animationDelay: '0.1s' }}></div>
                    <div className="wave-bar" style={{ animationDelay: '0s' }}></div>
                  </div>

                  {/* Metadata */}
                  <div className="flex justify-center gap-6 mb-8 text-xs text-[#8F8C88]">
                    <span>
                      <strong className="text-[#F5F2ED] block font-medium mb-0.5 text-[10px] uppercase tracking-[0.15em]">
                        Requester
                      </strong>
                      {nowPlaying.requesterName || 'ADE'}
                    </span>
                    <span>
                      <strong className="text-[#F5F2ED] block font-medium mb-0.5 text-[10px] uppercase tracking-[0.15em]">
                        Genre
                      </strong>
                      {nowPlaying.genre}
                    </span>
                    <span>
                      <strong className="text-[#F5F2ED] block font-medium mb-0.5 text-[10px] uppercase tracking-[0.15em]">
                        Status
                      </strong>
                      LIVE
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => handleMarkPlayed(nowPlaying.id)}
                      className="btn btn-ghost text-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>Mark Played</span>
                    </button>
                    <button
                      onClick={handlePlayNext}
                      className="btn btn-primary text-xs"
                    >
                      <span>Next Request</span>
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-12">
                  <p className="font-['Syne'] text-xl font-bold text-[#F5F2ED] mb-3">
                    No Track Currently Active
                  </p>
                  <p className="text-xs text-[#8F8C88] mb-6 max-w-xs mx-auto">
                    Select a song from the queue to start playing on the stage screen.
                  </p>
                  <button
                    onClick={handlePlayNext}
                    disabled={upNextRequests.length === 0 && newRequests.length === 0}
                    className="btn btn-primary text-xs"
                  >
                    <span>Play Next in Queue</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 3: UP NEXT */}
        <div className="bg-[#0E0E12] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 min-h-[400px]">
          <div className="flex justify-between items-center pb-4 mb-5 border-b border-[rgba(255,255,255,0.08)]">
            <span className="text-xs uppercase tracking-[0.2em] text-[#8F8C88] font-medium">
              Up Next
            </span>
            <span className="text-[11px] bg-[rgba(255,255,255,0.06)] px-2 py-0.5 rounded text-[#F5F2ED] font-medium">
              {upNextRequests.length}
            </span>
          </div>

          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {upNextRequests.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#8F8C88]">
                No tracks staged up next. Add tracks from New Requests.
              </div>
            ) : (
              upNextRequests.map((req, idx) => (
                <div
                  key={req.id}
                  className={`bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.14)] rounded-xl p-4 transition-all ${
                    req.priority ? 'border-l-2 border-l-[#C6A15B]' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-['Syne'] text-sm font-bold text-[#8F8C88]">
                      {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                    </span>
                    <span className="text-[9px] uppercase tracking-[0.15em] px-2 py-1 bg-[rgba(255,255,255,0.05)] rounded text-[#8F8C88]">
                      {req.genre}
                    </span>
                  </div>

                  <h4 className="font-['Syne'] text-base font-semibold leading-tight text-[#F5F2ED] mb-1">
                    {req.song}
                  </h4>
                  <p className="text-xs uppercase tracking-wider text-[#8F8C88] mb-3">
                    {req.artist}
                  </p>

                  <div className="flex justify-between items-center pt-2.5 border-t border-[rgba(255,255,255,0.08)]">
                    <span className="text-[11px] uppercase tracking-[0.1em] text-[#8F8C88]">
                      Req. by {req.requesterName || 'Guest'}
                    </span>
                    {req.priority && (
                      <span className="text-[10px] uppercase tracking-[0.15em] text-[#C6A15B] flex items-center gap-1 font-semibold">
                        <Crown className="w-3 h-3 text-[#C6A15B]" />
                        ₦{req.tipAmount.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-[rgba(255,255,255,0.04)]">
                    <button
                      onClick={() => handlePlay(req.id)}
                      className="flex-1 bg-[rgba(91,63,209,0.2)] border border-[#5B3FD1] hover:bg-[#5B3FD1] text-[#F5F2ED] py-1.5 px-2 rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Play</span>
                    </button>
                    <button
                      onClick={() => handleMoveUp(req.id)}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] text-[#8F8C88] hover:text-[#F5F2ED] disabled:opacity-20 transition-colors"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(req.id)}
                      disabled={idx === upNextRequests.length - 1}
                      className="p-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] text-[#8F8C88] hover:text-[#F5F2ED] disabled:opacity-20 transition-colors"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setRejectingId(req.id)}
                      className="p-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] text-[#8F8C88] hover:text-[#8B3A3A] transition-colors"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0E0E12] border border-[#8B3A3A]/40 rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-2 text-[#8B3A3A]">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-['Syne'] font-bold text-base text-[#F5F2ED] uppercase">
                Reject Song Request
              </h3>
            </div>

            <p className="text-xs text-[#8F8C88]">
              Select a reason for declining this request:
            </p>

            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.14)] rounded-xl p-3 text-xs text-[#F5F2ED] outline-none"
            >
              <option value="Track does not fit the current BPM set">Track does not fit current BPM set</option>
              <option value="Explicit content or unapproved track">Explicit content / unapproved track</option>
              <option value="Already played earlier in tonight's set">Already played earlier tonight</option>
              <option value="Track unavailable in DJ library">Track unavailable in library</option>
            </select>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setRejectingId(null)}
                className="btn btn-ghost flex-1 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmReject(rejectingId)}
                className="btn btn-primary flex-1 text-xs bg-[#8B3A3A] border-[#8B3A3A]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instant Withdrawal Modal */}
      <WithdrawalModal
        isOpen={isWithdrawalOpen}
        onClose={() => setIsWithdrawalOpen(false)}
      />
    </div>
  );
};
