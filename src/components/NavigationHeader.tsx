import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Volume2, 
  VolumeX, 
  Sliders, 
  Tv, 
  Smartphone, 
  QrCode, 
  Zap,
  Activity,
  LogOut,
  LogIn,
  User,
  Crown
} from 'lucide-react';
import { soundEngine } from '../services/soundEffects';
import { store } from '../services/store';
import { EventItem, DJProfile } from '../types';

interface NavigationHeaderProps {
  currentView: 'public_request' | 'customer_tracking' | 'dj_dashboard' | 'live_stage' | 'dj_profile';
  onNavigate: (view: 'public_request' | 'customer_tracking' | 'dj_dashboard' | 'live_stage' | 'dj_profile') => void;
  onOpenQr: () => void;
  onOpenAuthModal: (mode: 'login' | 'signup') => void;
  activeTrackingToken: string;
}

export const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  currentView,
  onNavigate,
  onOpenQr,
  onOpenAuthModal,
  activeTrackingToken,
}) => {
  const [soundOn, setSoundOn] = useState(soundEngine.isEnabled());
  const [currentEvent, setCurrentEvent] = useState<EventItem>(store.getCurrentEvent());
  const [currentDJ, setCurrentDJ] = useState<DJProfile | undefined>(store.isAuthenticatedDJ() ? store.getCurrentDJ() : undefined);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentEvent(store.getCurrentEvent());
      setCurrentDJ(store.isAuthenticatedDJ() ? store.getCurrentDJ() : undefined);
      const notifs = store.getNotifications();
      setUnreadNotifs(notifs.filter((n) => !n.read).length);
    });
    return unsub;
  }, []);

  const handleToggleSound = () => {
    const newState = soundEngine.toggleSound();
    setSoundOn(newState);
  };

  const handleLogout = () => {
    store.logoutDJ();
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#070708]/90 backdrop-blur-2xl border-b border-[rgba(255,255,255,0.08)]">
      {/* Top Bar: Brand & Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div 
          onClick={() => onNavigate('public_request')}
          className="cursor-pointer flex items-center gap-3 group"
        >
          <div className="w-9 h-9 rounded-lg bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center group-hover:border-[#5B3FD1] transition-colors">
            <Radio className="w-4 h-4 text-[#4D7CFE]" />
          </div>
          <div>
            <div className="font-['Syne'] font-extrabold text-base tracking-tight flex items-center gap-1">
              <span className="text-[#F5F2ED]">VYBE</span>
              <span className="text-[#C6A15B]">CHECK</span>
              <span className="text-[10px] ml-1.5 px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] text-[#8F8C88]">
                {currentDJ ? currentDJ.stageName : 'LOG IN'}
              </span>
            </div>
            <div className="text-[10px] text-[#8F8C88] uppercase tracking-[0.2em] flex items-center gap-1.5 mt-0.5">
              <span className="live-dot"></span>
              <span>LIVE SESSION • {currentDJ?.defaultVenue?.split(',')[0] || 'Club Matrix'}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* QR Code Launcher */}
          {currentDJ && <button
            onClick={onOpenQr}
            className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.09)] text-[#F5F2ED] border border-[rgba(255,255,255,0.08)] transition-colors"
          >
            <QrCode className="w-3.5 h-3.5 text-[#4D7CFE]" />
            <span className="hidden sm:inline">EVENT QR</span>
          </button>}

          {/* DJ Account */}
          {currentDJ ? (
            <div className="flex items-center gap-2 bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] rounded-lg p-1 pl-2">
              <div 
                onClick={() => onNavigate('dj_profile')}
                className="cursor-pointer flex items-center gap-2 pr-1 group"
                title="View & Edit DJ Profile"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#5B3FD1] to-[#4D7CFE] flex items-center justify-center text-[10px] font-bold text-[#F5F2ED]">
                  {currentDJ.stageName.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-[#F5F2ED] group-hover:text-[#4D7CFE] hidden md:inline truncate max-w-[100px]">
                  {currentDJ.stageName}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Log Out"
                className="p-1 rounded text-[#8F8C88] hover:text-[#8B3A3A] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenAuthModal('login')}
                className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.09)] text-[#F5F2ED] border border-[rgba(255,255,255,0.08)] transition-colors"
              >
                <LogIn className="w-3.5 h-3.5 text-[#4D7CFE]" />
                <span>DJ LOGIN</span>
              </button>
            </div>
          )}

          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            className={`btn-icon ${soundOn ? 'text-[#4D7CFE]' : 'text-[#8F8C88]'}`}
            title={soundOn ? 'Sound alerts enabled' : 'Sound alerts muted'}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Navigation View Switcher Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-2.5 pt-0.5 overflow-x-auto no-scrollbar flex items-center gap-2 border-t border-[rgba(255,255,255,0.04)]">
        <button
          onClick={() => onNavigate('public_request')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium uppercase tracking-[0.1em] transition-all flex items-center gap-1.5 whitespace-nowrap ${
            currentView === 'public_request'
              ? 'bg-[#F5F2ED] text-[#070708] font-semibold'
              : 'text-[#8F8C88] hover:text-[#F5F2ED] hover:bg-[rgba(255,255,255,0.06)]'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>GUEST REQUEST</span>
        </button>

        <button
          onClick={() => onNavigate('customer_tracking')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium uppercase tracking-[0.1em] transition-all flex items-center gap-1.5 whitespace-nowrap ${
            currentView === 'customer_tracking'
              ? 'bg-[#F5F2ED] text-[#070708] font-semibold'
              : 'text-[#8F8C88] hover:text-[#F5F2ED] hover:bg-[rgba(255,255,255,0.06)]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>TRACK REQUEST</span>
          {activeTrackingToken && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#4D7CFE] inline-block"></span>
          )}
        </button>

        {currentDJ && <button
          onClick={() => onNavigate('dj_dashboard')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium uppercase tracking-[0.1em] transition-all flex items-center gap-1.5 whitespace-nowrap ${
            currentView === 'dj_dashboard'
              ? 'bg-[#F5F2ED] text-[#070708] font-semibold'
              : 'text-[#8F8C88] hover:text-[#F5F2ED] hover:bg-[rgba(255,255,255,0.06)]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>DJ HUB</span>
          {unreadNotifs > 0 && (
            <span className="bg-[#C6A15B] text-[#070708] text-[9px] font-bold px-1.5 py-0.2 rounded-full">
              {unreadNotifs}
            </span>
          )}
        </button>}

        <button
          onClick={() => onNavigate('live_stage')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium uppercase tracking-[0.1em] transition-all flex items-center gap-1.5 whitespace-nowrap ${
            currentView === 'live_stage'
              ? 'bg-[#F5F2ED] text-[#070708] font-semibold'
              : 'text-[#8F8C88] hover:text-[#F5F2ED] hover:bg-[rgba(255,255,255,0.06)]'
          }`}
        >
          <Tv className="w-3.5 h-3.5" />
          <span>SCREEN (/live)</span>
        </button>

        {currentDJ && <button
          onClick={() => onNavigate('dj_profile')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium uppercase tracking-[0.1em] transition-all flex items-center gap-1.5 whitespace-nowrap ${
            currentView === 'dj_profile'
              ? 'bg-[#F5F2ED] text-[#070708] font-semibold'
              : 'text-[#8F8C88] hover:text-[#F5F2ED] hover:bg-[rgba(255,255,255,0.06)]'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>DJ PROFILE & WALLET</span>
        </button>}
      </div>
    </header>
  );
};
