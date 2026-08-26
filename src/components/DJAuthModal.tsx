import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Sparkles, 
  Camera, 
  AlertCircle, 
  Headphones, 
  Zap, 
  ArrowRight,
  Check,
  Globe,
  Database,
  Lock,
  KeyRound,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { store } from '../services/store';
import { Genre, DJProfile } from '../types';
import { DJImageUploadModal } from './DJImageUploadModal';
import { isClerkConfigured } from './ClerkProviderWrapper';

interface DJAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (dj: DJProfile) => void;
  initialMode?: 'login' | 'signup';
}

const AVAILABLE_GENRES: Genre[] = [
  'Afrobeats',
  'Amapiano',
  '3 STEP SA',
  'Afro House',
  'Hip Hop',
  'R&B',
  'Dancehall',
  'House',
  'Electronic',
];

export const DJAuthModal: React.FC<DJAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'social_auth' | 'clerk_auth' | 'password_login' | 'magic_link' | 'signup'>(
    initialMode === 'signup' ? 'signup' : 'social_auth'
  );
  
  // Social login state
  const [socialEmail, setSocialEmail] = useState('');
  const [socialStageName, setSocialStageName] = useState('');

  // Password login state
  const [loginEmailOrHandle, setLoginEmailOrHandle] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Magic Link Sign-In state
  const [magicEmail, setMagicEmail] = useState('');
  const [magicStep, setMagicStep] = useState<'request' | 'verify'>('request');
  const [magicCodeInput, setMagicCodeInput] = useState('');
  const [magicResult, setMagicResult] = useState<{
    email?: string;
  } | null>(null);

  // Signup form state
  const [name, setName] = useState('');
  const [stageName, setStageName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [defaultVenue, setDefaultVenue] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>(['Afrobeats', 'Amapiano']);
  const [avatarUrl, setAvatarUrl] = useState('https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=400&auto=format&fit=crop&q=80');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSocialProvider, setActiveSocialProvider] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasClerk = isClerkConfigured();

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginEmailOrHandle.trim() || !loginPassword.trim()) {
      setError('Please enter your DJ email/handle and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await store.loginWithPassword(loginEmailOrHandle.trim(), loginPassword.trim());
      setIsLoading(false);
      if (res.success) {
        if (res.dj) onSuccess(res.dj);
        onClose();
      } else {
        setError(res.error || 'Invalid credentials.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Login failed.');
    }
  };

  const handleSocialAuth = async (provider: 'google' | 'spotify' | 'apple' | 'github') => {
    setError(null);
    setIsLoading(true);
    setActiveSocialProvider(provider);
    try {
      const res = await store.loginWithSocial(provider, {
        email: socialEmail.trim() || undefined,
        stageName: socialStageName.trim() || undefined,
        name: socialStageName.trim() || undefined,
      });
      setIsLoading(false);
      setActiveSocialProvider(null);
      if (res.success && res.dj) {
        onSuccess(res.dj);
        onClose();
      } else {
        setError(res.error || `Social login with ${provider} failed.`);
      }
    } catch (err: any) {
      setIsLoading(false);
      setActiveSocialProvider(null);
      setError(err.message || 'Social login failed.');
    }
  };

  const handleRequestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!magicEmail.trim()) {
      setError('Please enter your DJ email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await store.requestMagicLink(magicEmail.trim());
      setIsLoading(false);
      if (res.success) {
        setMagicResult({
          email: res.email || magicEmail.trim(),
        });
        setMagicStep('verify');
      } else {
        setError(res.error || 'Failed to dispatch magic link.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Error dispatching magic link.');
    }
  };

  const handleVerifyCode = async (codeToVerify?: string) => {
    setError(null);
    const targetCode = (codeToVerify || magicCodeInput).trim();
    if (!targetCode) {
      setError('Please enter the 6-digit confirmation code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await store.verifyMagicLink(targetCode, magicResult?.email);
      setIsLoading(false);
      if (res.success && res.dj) {
        onSuccess(res.dj);
        onClose();
      } else {
        setError(res.error || 'Invalid or expired confirmation code.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Error verifying confirmation code.');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !stageName.trim() || !handle.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all required fields (Name, Stage Name, Handle, Email, Password).');
      return;
    }

    setIsLoading(true);
    try {
      const res = await store.registerDJ({
        name: name.trim(),
        stageName: stageName.trim(),
        handle: handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        bio: `Official resident DJ at ${defaultVenue || 'Top Venues'}.`,
        avatarUrl: avatarUrl || 'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=400&auto=format&fit=crop&q=80',
        genres: selectedGenres,
        defaultVenue: defaultVenue.trim() || 'Club Matrix VIP Lounge, Lagos',
        minTipAmount: 10000,
        qrTheme: 'gold-vip',
        customQrTagline: `SCAN TO REQUEST & VIP TIP ${stageName.toUpperCase()}`,
      });

      setIsLoading(false);
      if (res.success && res.dj) {
        onSuccess(res.dj);
        onClose();
      } else {
        setError(res.error || 'Signup failed.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Signup failed.');
    }
  };

  const toggleGenre = (genre: Genre) => {
    if (selectedGenres.includes(genre)) {
      if (selectedGenres.length > 1) {
        setSelectedGenres(selectedGenres.filter((g) => g !== genre));
      }
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-[#0E0E12] border border-[rgba(255,255,255,0.14)] rounded-2xl max-w-md w-full p-6 sm:p-7 relative shadow-2xl my-8 space-y-5">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-[#8F8C88] hover:text-[#F5F2ED]"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Modal Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(198,161,91,0.15)] border border-[#C6A15B]/40 flex items-center justify-center text-[#C6A15B]">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#C6A15B] font-semibold block">
                  DJ AUTHENTICATION
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-[#2E8B7A]/20 text-[#2E8B7A] border border-[#2E8B7A]/30">
                  <Database className="w-2.5 h-2.5" />
                  Supabase Cloud
                </span>
              </div>
              <h2 className="font-['Syne'] text-lg sm:text-xl font-bold text-[#F5F2ED]">
                {mode === 'social_auth' ? 'Social Sign-In' : mode === 'clerk_auth' ? 'Clerk SSO Auth' : mode === 'password_login' ? 'DJ Login' : mode === 'magic_link' ? 'Magic Link Email' : 'Create DJ Profile'}
              </h2>
            </div>
          </div>

          {/* Navigation Mode Tabs */}
          <div className="grid grid-cols-4 gap-1 bg-[rgba(255,255,255,0.04)] p-1 rounded-xl border border-[rgba(255,255,255,0.06)]">
            <button
              type="button"
              onClick={() => { setMode('social_auth'); setError(null); }}
              className={`py-1.5 text-[10px] sm:text-[11px] font-semibold rounded-lg transition-colors ${
                mode === 'social_auth'
                  ? 'bg-[#C6A15B] text-[#070708]'
                  : 'text-[#8F8C88] hover:text-[#F5F2ED]'
              }`}
            >
              Social
            </button>
            {false && <button
              type="button"
              onClick={() => { setMode('password_login'); setError(null); }}
              className={`py-1.5 text-[10px] sm:text-[11px] font-semibold rounded-lg transition-colors ${
                mode === 'password_login'
                  ? 'bg-[#C6A15B] text-[#070708]'
                  : 'text-[#8F8C88] hover:text-[#F5F2ED]'
              }`}
            >
              Password
            </button>}
            {false && <button
              type="button"
              onClick={() => { setMode('magic_link'); setError(null); setMagicStep('request'); }}
              className={`py-1.5 text-[10px] sm:text-[11px] font-semibold rounded-lg transition-colors ${
                mode === 'magic_link'
                  ? 'bg-[#C6A15B] text-[#070708]'
                  : 'text-[#8F8C88] hover:text-[#F5F2ED]'
              }`}
            >
              Magic
            </button>}
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); }}
              className={`py-1.5 text-[10px] sm:text-[11px] font-semibold rounded-lg transition-colors ${
                mode === 'signup'
                  ? 'bg-[#C6A15B] text-[#070708]'
                  : 'text-[#8F8C88] hover:text-[#F5F2ED]'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-[rgba(139,58,58,0.2)] border border-[rgba(139,58,58,0.4)] text-[#F5F2ED] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. SOCIAL AUTH TAB */}
          {mode === 'social_auth' && (
            <div className="space-y-4">
              <div className="bg-[rgba(198,161,91,0.06)] border border-[rgba(198,161,91,0.18)] rounded-xl p-3 text-xs text-[#E5E2DC] space-y-1">
                <p className="font-semibold text-[#C6A15B] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Fast DJ Profile Connect
                </p>
                <p className="text-[11px] text-[#8F8C88]">
                  Sign in instantly with your Google account. Your DJ profile is linked automatically.
                </p>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-1">
                    Your DJ Stage Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DJ Bama, DJ Sughter, DJ Spinall"
                    value={socialStageName}
                    onChange={(e) => setSocialStageName(e.target.value)}
                    className="form-input text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-1">
                    Your DJ Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. yuwamsughter@gmail.com"
                    value={socialEmail}
                    onChange={(e) => setSocialEmail(e.target.value)}
                    className="form-input text-xs"
                  />
                </div>
              </div>

              <div className="pt-1 space-y-2">
                {/* Google Button */}
                <button
                  type="button"
                  onClick={() => handleSocialAuth('google')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.14)] border border-[rgba(255,255,255,0.16)] text-[#F5F2ED] font-medium text-xs sm:text-sm transition-all shadow-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2c0 2.8.7 5.5 1.9 7.8l3.7-2.9z" />
                    <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.9C3.7 20.6 7.5 23.5 12 23.5z" />
                  </svg>
                  <span>{activeSocialProvider === 'google' ? 'Connecting Google Account...' : 'Continue with Google'}</span>
                </button>

                {/* Spotify Button */}
                {false && <button
                  type="button"
                  onClick={() => handleSocialAuth('spotify')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-[#1DB954]/15 hover:bg-[#1DB954]/25 border border-[#1DB954]/40 text-[#1DB954] font-medium text-xs sm:text-sm transition-all"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  <span>{activeSocialProvider === 'spotify' ? 'Connecting Spotify DJ...' : 'Continue with Spotify'}</span>
                </button>}

                {/* Apple Button */}
                {false && <button
                  type="button"
                  onClick={() => handleSocialAuth('apple')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.12)] text-[#F5F2ED] font-medium text-xs sm:text-sm transition-all"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.87c.6-1.12.98-2.67.74-4.22-1.22.06-2.65.86-3.48 1.9-.73.91-1.34 2.45-1.11 3.94 1.36.11 2.76-.73 3.85-1.62z"/>
                  </svg>
                  <span>{activeSocialProvider === 'apple' ? 'Connecting Apple...' : 'Continue with Apple'}</span>
                </button>}

                {/* GitHub Button */}
                {false && <button
                  type="button"
                  onClick={() => handleSocialAuth('github')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.12)] text-[#F5F2ED] font-medium text-xs sm:text-sm transition-all"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span>{activeSocialProvider === 'github' ? 'Connecting GitHub...' : 'Continue with GitHub'}</span>
                </button>}
              </div>

              {hasClerk && (
                <div className="pt-2 border-t border-[rgba(255,255,255,0.08)] text-center">
                  <span className="text-[11px] text-[#C6A15B] font-medium flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Clerk Enterprise SSO Active
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 2. EMAIL & PASSWORD LOGIN TAB */}
          {mode === 'password_login' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-1.5">
                  Email or DJ Handle
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. bama@vybecheckwithbama.live or bama"
                    value={loginEmailOrHandle}
                    onChange={(e) => setLoginEmailOrHandle(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { setMode('magic_link'); setMagicStep('request'); }}
                    className="text-[10px] text-[#C6A15B] hover:underline"
                  >
                    Forgot / Magic Link?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary btn-full"
              >
                {isLoading ? 'Signing In...' : 'Sign In with Email & Password'}
              </button>

              <div className="flex items-center justify-between pt-1 text-xs text-[#8F8C88]">
                <span>No account yet?</span>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-[#C6A15B] font-semibold hover:underline"
                >
                  Create DJ Profile
                </button>
              </div>
            </form>
          )}

          {/* 3. MAGIC LINK SIGN-IN */}
          {mode === 'magic_link' && (
            <div className="space-y-4">
              {magicStep === 'request' ? (
                <form onSubmit={handleRequestMagicLink} className="space-y-4">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-2">
                      DJ Email Address
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. bama@vybecheckwithbama.live"
                      value={magicEmail}
                      onChange={(e) => setMagicEmail(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary btn-full"
                  >
                    {isLoading ? 'Dispatching Link...' : 'Send Magic Sign-In Link'}
                  </button>
                </form>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="space-y-1">
                    <p className="text-xs text-[#8F8C88]">
                      A 6-digit access code was dispatched to:
                    </p>
                    <p className="text-xs font-mono text-[#C6A15B]">
                      {magicResult?.email}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={magicCodeInput}
                      onChange={(e) => setMagicCodeInput(e.target.value)}
                      className="form-input font-mono text-center tracking-widest text-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleVerifyCode()}
                      disabled={isLoading || !magicCodeInput.trim()}
                      className="btn btn-primary px-5 text-xs"
                    >
                      {isLoading ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMagicStep('request')}
                    className="text-xs text-[#8F8C88] hover:text-[#F5F2ED] underline"
                  >
                    Use different email
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 4. SIGNUP FORM */}
          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)]">
                <img src={avatarUrl} alt="DJ Avatar" className="w-12 h-12 rounded-xl object-cover" />
                <div className="flex-1">
                  <span className="text-xs font-semibold text-[#F5F2ED] block">Profile Image</span>
                  <button
                    type="button"
                    onClick={() => setUploadModalOpen(true)}
                    className="text-xs text-[#C6A15B] hover:underline"
                  >
                    Change Image
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-input text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-1">
                    Stage Name
                  </label>
                  <input
                    type="text"
                    required
                    value={stageName}
                    onChange={(e) => {
                      setStageName(e.target.value);
                      if (!handle) setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                    }}
                    className="form-input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-1">
                    Handle
                  </label>
                  <input
                    type="text"
                    required
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    className="form-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Set your account password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-1">
                  Residency Venue
                </label>
                <input
                  type="text"
                  placeholder="e.g. Club Matrix VIP Lounge"
                  value={defaultVenue}
                  onChange={(e) => setDefaultVenue(e.target.value)}
                  className="form-input text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-1.5">
                  Genres
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_GENRES.map((genre) => {
                    const isSelected = selectedGenres.includes(genre);
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => toggleGenre(genre)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-[#C6A15B]/20 text-[#C6A15B] border-[#C6A15B]/50 font-medium'
                            : 'bg-[rgba(255,255,255,0.04)] text-[#8F8C88] border-[rgba(255,255,255,0.08)]'
                        }`}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary btn-full"
              >
                {isLoading ? 'Creating Profile in Database...' : 'Complete DJ Registration'}
              </button>
            </form>
          )}

        </div>
      </div>

      <DJImageUploadModal
        isOpen={uploadModalOpen}
        type="avatar"
        title="Upload DJ Avatar"
        currentImageUrl={avatarUrl}
        onClose={() => setUploadModalOpen(false)}
        onSelectImage={(newUrl) => setAvatarUrl(newUrl)}
      />
    </>
  );
};
