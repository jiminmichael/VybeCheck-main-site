import React, { useEffect, useState } from 'react';
import { X, AlertCircle, Headphones } from 'lucide-react';
import { isSignInWithEmailLink, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import { store } from '../services/store';
import { DJProfile } from '../types';
import { DJImageUploadModal } from './DJImageUploadModal';

interface DJAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (dj: DJProfile) => void;
  initialMode?: 'login' | 'signup';
}
export const DJAuthModal: React.FC<DJAuthModalProps> = ({ isOpen, onClose, onSuccess, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'link' | 'complete'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [stageName, setStageName] = useState('');
  const [handle, setHandle] = useState('');
  const [venue, setVenue] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError(''); setMessage('');
    if (isSignInWithEmailLink(auth, window.location.href)) {
      setMode('complete');
      setEmail(localStorage.getItem('vybecheck_email_link') || '');
    } else setMode(initialMode);
  }, [isOpen, initialMode]);

  if (!isOpen) return null;
  async function run(action: () => Promise<{ success: boolean; dj?: DJProfile; error?: string; message?: string }>) {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await action();
      if (!result.success) setError(result.error || 'Sign-in failed.');
      else if (result.dj) { onSuccess(result.dj); onClose(); }
      else setMessage(result.message || 'Check your email for your sign-in link.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'complete') return void run(() => store.verifyMagicLink(window.location.href, email.trim()));
    if (mode === 'link') return void run(() => store.requestMagicLink(email.trim()));
    if (mode === 'signup') return void run(() => store.registerDJ({
      email: email.trim().toLowerCase(), password, name: name.trim(), stageName: stageName.trim(),
      handle: handle.trim().toLowerCase(), avatarUrl, bio: '', genres: ['Afrobeats', 'Amapiano'],
      defaultVenue: venue.trim() || 'Add your venue', minTipAmount: 10000, qrTheme: 'gold-vip',
    }));
    void run(() => store.loginWithPassword(email.trim(), password));
  }
  return <>
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0E0E12] border border-white/15 rounded-2xl max-w-md w-full p-6 my-8 relative space-y-5">
        <button aria-label="Close sign-in" onClick={onClose} disabled={busy} className="absolute top-5 right-5 text-[#8F8C88]"><X className="w-5 h-5" /></button>
        <div className="flex items-center gap-3">
          <Headphones className="text-[#C6A15B] w-8 h-8" />
          <div><p className="text-[10px] uppercase tracking-widest text-[#C6A15B]">DJ account</p><h2 className="font-['Syne'] text-xl font-bold">{mode === 'signup' ? 'Create DJ Profile' : mode === 'complete' ? 'Complete sign-in' : 'Welcome back'}</h2></div>
        </div>
        {mode !== 'complete' && <div className="flex gap-2">
          {(['login', 'signup', 'link'] as const).map(tab => <button key={tab} type="button" disabled={busy} onClick={() => { setMode(tab); setError(''); setMessage(''); }} className={`flex-1 rounded-lg py-2 text-xs ${mode === tab ? 'bg-[#C6A15B] text-black' : 'bg-white/5'}`}>{tab === 'login' ? 'Sign in' : tab === 'signup' ? 'Register' : 'Email link'}</button>)}
        </div>}
        {error && <div role="alert" className="flex gap-2 text-sm text-rose-300 bg-rose-950/30 rounded-lg p-3"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
        {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
        {(mode === 'login' || mode === 'signup') && <button className="btn btn-full border border-white/20" disabled={busy} onClick={() => void run(() => store.loginWithSocial('google', { stageName: stageName.trim() || undefined }))}>Continue with Google</button>}
        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && <>
            <label className="block text-xs">Full name<input className="form-input mt-1" required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
            <label className="block text-xs">DJ stage name<input className="form-input mt-1" required value={stageName} onChange={e => setStageName(e.target.value)} /></label>
            <label className="block text-xs">DJ handle<input className="form-input mt-1" required minLength={3} maxLength={40} pattern="[a-z0-9_-]+" value={handle} onChange={e => setHandle(e.target.value.toLowerCase())} /></label>
            <label className="block text-xs">Venue<input className="form-input mt-1" value={venue} onChange={e => setVenue(e.target.value)} /></label>
            <button type="button" className="text-sm text-[#C6A15B]" onClick={() => setUploadOpen(true)}>{avatarUrl ? 'Change profile photo' : 'Add profile photo'}</button>
          </>}
          {mode === 'complete' && <p className="text-xs text-[#8F8C88]">Confirm the email address that received this link.</p>}
          <label className="block text-xs">Email<input className="form-input mt-1" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          {(mode === 'signup' || mode === 'login') && <label className="block text-xs">Password<input className="form-input mt-1" type="password" required minLength={mode === 'signup' ? 6 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>}
          <button type="submit" className="btn btn-primary btn-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'link' ? 'Send sign-in link' : 'Sign in'}</button>
          {mode === 'login' && <button type="button" disabled={busy} className="text-xs text-[#C6A15B]" onClick={() => void run(async () => { if (!email.trim()) throw new Error('Enter your email first.'); await sendPasswordResetEmail(auth, email.trim()); return { success: true, message: 'Check your inbox for password reset instructions.' }; })}>Reset password</button>}
        </form>
      </div>
    </div>
    <DJImageUploadModal isOpen={uploadOpen} title="Profile photo" type="avatar" currentImageUrl={avatarUrl} onClose={() => setUploadOpen(false)} onSelectImage={setAvatarUrl} />
  </>;
};
