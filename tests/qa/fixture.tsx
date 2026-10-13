import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PublicRequestPortal } from '../../src/components/PublicRequestPortal';
import { CustomerTrackingScreen } from '../../src/components/CustomerTrackingScreen';
import { LiveStageScreen } from '../../src/components/LiveStageScreen';
import { EventQrModal } from '../../src/components/EventQrModal';
import { DJAuthModal } from '../../src/components/DJAuthModal';
import { DJImageUploadModal } from '../../src/components/DJImageUploadModal';
import { DJPersonalQrModal } from '../../src/components/DJPersonalQrModal';
import { WithdrawalModal } from '../../src/components/WithdrawalModal';
import { PaystackCheckoutModal } from '../../src/components/PaystackCheckoutModal';
import { DJDashboard } from '../../src/components/DJDashboard';
import { DJProfileView } from '../../src/components/DJProfileView';
import { NavigationHeader } from '../../src/components/NavigationHeader';
import { dj, event, request } from './fixtures';

function Fixture() {
  const [modal, setModal] = useState('');
  const [view, setView] = useState(new URLSearchParams(location.search).get('view') || 'request');
  const close = () => setModal('');
  return <main>
    <nav aria-label="QA screens" className="flex gap-2 flex-wrap p-3">
      {['request', 'tracking', 'live', 'dashboard', 'profile'].map(v => <button key={v} onClick={() => setView(v)}>{v}</button>)}
      {['event', 'auth', 'image', 'personal', 'withdrawal', 'checkout'].map(m => <button key={m} onClick={() => setModal(m)}>Open {m}</button>)}
    </nav>
    {view === 'request' && <PublicRequestPortal onTrackRequest={() => setView('tracking')} onLaunchPaystack={() => setModal('checkout')} />}
    {view === 'tracking' && <CustomerTrackingScreen initialToken={new URLSearchParams(location.search).get('token') || undefined} onTrackToken={() => {}} onRequestNewSong={() => setView('request')} onLaunchPaystack={() => setModal('checkout')} />}
    {view === 'live' && <LiveStageScreen />}
    {view === 'dashboard' && <DJDashboard onOpenQr={() => setModal('event')} onNavigateToLiveStage={() => setView('live')} />}
    {view === 'profile' && <DJProfileView onNavigateToDashboard={() => setView('dashboard')} onOpenPersonalQr={() => setModal('personal')} onOpenAuthModal={() => setModal('auth')} />}
    <NavigationHeader currentView="public_request" onNavigate={() => {}} onOpenQr={() => setModal('event')} onOpenAuthModal={() => setModal('auth')} activeTrackingToken="" />
    {modal === 'event' && <EventQrModal event={event as any} dj={dj as any} onClose={close} />}
    <DJAuthModal isOpen={modal === 'auth'} initialMode="signup" onClose={close} onSuccess={() => {}} />
    <DJImageUploadModal isOpen={modal === 'image'} title="Choose image" type="avatar" onClose={close} onSelectImage={() => {}} />
    {modal === 'personal' && <DJPersonalQrModal dj={dj as any} onClose={close} />}
    <WithdrawalModal isOpen={modal === 'withdrawal'} onClose={close} />
    {modal === 'checkout' && <PaystackCheckoutModal request={request as any} tipAmount={50000} onClose={close} onSuccess={() => {}} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
