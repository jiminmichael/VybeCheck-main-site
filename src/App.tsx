import React, { useState, useEffect } from 'react';
import { NavigationHeader } from './components/NavigationHeader';
import { PublicRequestPortal } from './components/PublicRequestPortal';
import { CustomerTrackingScreen } from './components/CustomerTrackingScreen';
import { DJDashboard } from './components/DJDashboard';
import { LiveStageScreen } from './components/LiveStageScreen';
import { PaystackCheckoutModal } from './components/PaystackCheckoutModal';
import { EventQrModal } from './components/EventQrModal';
import { DJProfileView } from './components/DJProfileView';
import { DJAuthModal } from './components/DJAuthModal';
import { DJPersonalQrModal } from './components/DJPersonalQrModal';
import { store } from './services/store';
import { SongRequestItem, DJNotification, DJProfile } from './types';
import { Bell, Crown, Sparkles, X, Disc3 } from 'lucide-react';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<
    'public_request' | 'customer_tracking' | 'dj_dashboard' | 'live_stage' | 'dj_profile'
  >('public_request');

  const [activeTrackingToken, setActiveTrackingToken] = useState<string>('');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [personalQrModalOpen, setPersonalQrModalOpen] = useState(false);
  
  // DJ Authentication Modal
  const [authModal, setAuthModal] = useState<{
    isOpen: boolean;
    mode: 'login' | 'signup';
  }>({
    isOpen: false,
    mode: 'login',
  });

  const [checkoutModal, setCheckoutModal] = useState<{
    isOpen: boolean;
    request: SongRequestItem | null;
    tipAmount: number;
  }>({
    isOpen: false,
    request: null,
    tipAmount: 0,
  });

  const [notifications, setNotifications] = useState<DJNotification[]>(store.getNotifications());
  const [currentDJ, setCurrentDJ] = useState<DJProfile | undefined>(store.isAuthenticatedDJ() ? store.getCurrentDJ() : undefined);
  const [backendReady, setBackendReady] = useState<boolean>(store.isReady());
  const [backendError, setBackendError] = useState<string | null>(store.getInitializationError());

  // Loading Screen Timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  // Listen to hash route changes (e.g. #request/djspinall or #request?dj=djbama)
  useEffect(() => {
    const handleHash = async () => {
      const hash = window.location.hash;
      if (hash.startsWith('#request/')) {
        const slug = hash.replace('#request/', '').trim();
        if (slug) {
          store.setCurrentEventBySlug(slug);
          setCurrentView('public_request');
        }
      } else if (hash.startsWith('#magic-login')) {
        const queryStr = hash.includes('?') ? hash.split('?')[1] : '';
        const params = new URLSearchParams(queryStr);
        const token = params.get('token') || '';
        const email = params.get('email') || undefined;
        const code = params.get('code') || undefined;
        if (token || code) {
          try {
            const res = await store.verifyMagicLink(token || code!, email);
            if (res.success) {
              setCurrentView('dj_profile');
            }
          } catch (e) {}
        }
      } else if (hash === '#dashboard' || hash === '#dj') {
        if (store.isAuthenticatedDJ()) setCurrentView('dj_dashboard');
        else handleOpenAuth('login');
      } else if (hash === '#profile') {
        if (store.isAuthenticatedDJ()) setCurrentView('dj_profile');
        else handleOpenAuth('login');
      } else if (hash === '#live') {
        setCurrentView('live_stage');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setNotifications([...store.getNotifications()]);
      setCurrentDJ(store.isAuthenticatedDJ() ? store.getCurrentDJ() : undefined);
      setBackendReady(store.isReady());
      setBackendError(store.getInitializationError());
    });
    return unsub;
  }, []);

  const handleTrackRequest = (token: string) => {
    setActiveTrackingToken(token);
    setCurrentView('customer_tracking');
  };

  const handleLaunchPaystack = (req: SongRequestItem, tipAmount: number) => {
    setCheckoutModal({
      isOpen: true,
      request: req,
      tipAmount: tipAmount > 0 ? tipAmount : 25000,
    });
  };

  const handleDismissNotification = (id: string) => {
    store.markNotificationRead(id);
  };

  const handleOpenAuth = (mode: 'login' | 'signup') => {
    setAuthModal({ isOpen: true, mode });
  };

  const handleAuthSuccess = (dj: DJProfile) => {
    setCurrentView('dj_profile');
  };

  const handleNavigate = (view: typeof currentView) => {
    if ((view === 'dj_dashboard' || view === 'dj_profile') && !store.isAuthenticatedDJ()) {
      handleOpenAuth('login');
      return;
    }
    setCurrentView(view);
  };

  const unreadNotifications = notifications.filter((n) => !n.read).slice(0, 3);

  if (!backendReady && backendError) {
    return <div className="min-h-screen bg-[#070708] text-[#F5F2ED] flex flex-col items-center justify-center gap-3 px-6 text-center relative"><div className="bg-atmosphere" /><div className="relative z-10 flex flex-col items-center gap-3"><strong>Supabase connection failed</strong><span className="text-sm text-[#8F8C88]">{backendError}</span></div></div>;
  }

  if (!backendReady) {
    return <div className="min-h-screen bg-[#070708] text-[#F5F2ED] flex items-center justify-center relative"><div className="bg-atmosphere" /><span className="relative z-10">Connecting to Supabase...</span></div>;
  }

  if (store.getEvents().length === 0) {
    return (
      <div className="min-h-screen bg-[#070708] text-[#F5F2ED] flex flex-col font-['Inter',sans-serif] relative">
        <div className="bg-atmosphere" />
        <NavigationHeader
          currentView={currentView}
          onNavigate={handleNavigate}
          onOpenQr={() => setQrModalOpen(true)}
          onOpenAuthModal={handleOpenAuth}
          activeTrackingToken={activeTrackingToken}
        />
        <main className="flex-1 relative z-10 flex items-center justify-center px-6 py-20">
          <div className="max-w-lg text-center space-y-5">
            <div className="text-xs uppercase tracking-[0.25em] text-[#C6A15B]">Supabase workspace ready</div>
            <h1 className="font-['Syne'] text-3xl sm:text-4xl font-bold">Create your first live session</h1>
            <p className="text-sm leading-6 text-[#8F8C88]">Your database is connected, but it has no DJ profiles or events yet. Create a DJ profile or sign in to load your live workspace.</p>
            <button onClick={() => handleOpenAuth('signup')} className="btn btn-primary">Create DJ Profile</button>
          </div>
        </main>
        <DJAuthModal
          isOpen={authModal.isOpen}
          initialMode={authModal.mode}
          onClose={() => setAuthModal({ isOpen: false, mode: 'login' })}
          onSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070708] text-[#F5F2ED] flex flex-col font-['Inter',sans-serif] selection:bg-[#5B3FD1] selection:text-white relative">
      {/* Atmosphere Background */}
      <div className="bg-atmosphere" />

      {/* Branded Loading Screen */}
      <div
        className={`fixed inset-0 bg-[#070708] z-[9999] flex flex-col items-center justify-center transition-all duration-700 pointer-events-none ${
          loading ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        <div className="font-['Syne',sans-serif] text-4xl sm:text-5xl font-extrabold tracking-tight overflow-hidden flex items-center gap-1">
          <span className="inline-block animate-reveal-up-1 text-[#F5F2ED]">VYBE</span>
          <span className="inline-block animate-reveal-up-2 text-[#C6A15B]">CHECK</span>
        </div>
        <div className="mt-4 text-xs tracking-[0.4em] uppercase text-[#8F8C88] animate-fade-in-sub font-medium">
          Welcome to Vybecheck
        </div>
      </div>

      {/* Navigation & Live Booth Bar */}
      <NavigationHeader
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenQr={() => setQrModalOpen(true)}
        onOpenAuthModal={handleOpenAuth}
        activeTrackingToken={activeTrackingToken}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full relative z-10">
        {currentView === 'public_request' && (
          <PublicRequestPortal
            onTrackRequest={handleTrackRequest}
            onLaunchPaystack={handleLaunchPaystack}
          />
        )}

        {currentView === 'customer_tracking' && (
          <CustomerTrackingScreen
            initialToken={activeTrackingToken}
            onLaunchPaystack={handleLaunchPaystack}
            onRequestNewSong={() => setCurrentView('public_request')}
          />
        )}

        {currentView === 'dj_dashboard' && (
          <DJDashboard
            onOpenQr={() => setQrModalOpen(true)}
            onNavigateToLiveStage={() => setCurrentView('live_stage')}
            onNavigateToProfile={() => setCurrentView('dj_profile')}
          />
        )}

        {currentView === 'dj_profile' && (
          <DJProfileView
            onNavigateToDashboard={() => setCurrentView('dj_dashboard')}
            onOpenAuthModal={handleOpenAuth}
          />
        )}

        {currentView === 'live_stage' && <LiveStageScreen />}
      </main>

      {/* Global Modals */}
      {qrModalOpen && (
        <EventQrModal
          event={store.getCurrentEvent()}
          dj={currentDJ}
          onClose={() => setQrModalOpen(false)}
        />
      )}

      {/* DJ Personal QR Studio Modal */}
      {personalQrModalOpen && currentDJ && (
        <DJPersonalQrModal
          dj={currentDJ}
          onClose={() => setPersonalQrModalOpen(false)}
        />
      )}

      {/* DJ Authentication Modal (Login / Sign Up) */}
      <DJAuthModal
        isOpen={authModal.isOpen}
        initialMode={authModal.mode}
        onClose={() => setAuthModal({ isOpen: false, mode: 'login' })}
        onSuccess={handleAuthSuccess}
      />

      {/* Paystack Checkout Modal */}
      {checkoutModal.isOpen && checkoutModal.request && (
        <PaystackCheckoutModal
          request={checkoutModal.request}
          tipAmount={checkoutModal.tipAmount}
          onClose={() => setCheckoutModal({ isOpen: false, request: null, tipAmount: 0 })}
          onSuccess={() => {
            setCheckoutModal({ isOpen: false, request: null, tipAmount: 0 });
            if (checkoutModal.request) {
              setActiveTrackingToken(checkoutModal.request.trackingToken);
              setCurrentView('customer_tracking');
            }
          }}
        />
      )}

      {/* Realtime DJ Notification Toasts (Top Right) */}
      <div className="fixed top-20 right-5 z-[1000] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {unreadNotifications.map((notif) => (
          <div
            key={notif.id}
            className={`pointer-events-auto rounded-xl p-4 bg-[#0E0E12]/95 backdrop-blur-xl border border-[rgba(255,255,255,0.14)] shadow-2xl transition-all duration-400 flex items-center justify-between gap-3 ${
              notif.type === 'tip_received'
                ? 'border-l-[3px] border-l-[#C6A15B]'
                : 'border-l-[3px] border-l-[#5B3FD1]'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#8F8C88] mb-1 font-semibold">
                {notif.type === 'tip_received' ? 'NEW VIP REQUEST' : 'NEW SONG REQUEST'}
              </div>
              <div className="font-['Syne'] font-bold text-sm text-[#F5F2ED] truncate">
                {notif.message}
              </div>
            </div>

            <button
              onClick={() => handleDismissNotification(notif.id)}
              className="text-[#8F8C88] hover:text-[#F5F2ED] p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
