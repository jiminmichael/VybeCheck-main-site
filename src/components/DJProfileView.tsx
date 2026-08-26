import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Edit3, 
  Save, 
  Download, 
  Copy, 
  Check, 
  Sparkles, 
  Crown, 
  CreditCard, 
  Radio, 
  Music, 
  MapPin, 
  Tv, 
  Printer, 
  Camera, 
  Mail, 
  Zap, 
  Lock, 
  LogOut,
  Send,
  ShieldCheck,
  Wallet,
  ArrowUpRight,
  History,
  CheckCircle2,
  Clock,
  Database
} from 'lucide-react';
import QRCode from 'qrcode';
import { store } from '../services/store';
import { DJProfile, Genre, EmailLogItem, PayoutItem, BankItem } from '../types';
import { DJImageUploadModal } from './DJImageUploadModal';
import { WithdrawalModal } from './WithdrawalModal';

interface DJProfileViewProps {
  onNavigateToDashboard: () => void;
  onOpenAuthModal: (mode: 'login' | 'signup') => void;
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

const QR_THEMES = [
  { id: 'obsidian-gold', name: 'Obsidian Gold', dark: '#070708', light: '#E6D3A3', border: 'border-[#C6A15B]' },
  { id: 'violet-blue', name: 'Violet Glow', dark: '#070708', light: '#8B5CF6', border: 'border-[#5B3FD1]' },
  { id: 'electric-blue', name: 'Electric Blue', dark: '#070708', light: '#4D7CFE', border: 'border-[#4D7CFE]' },
  { id: 'emerald-pulse', name: 'Emerald Wave', dark: '#070708', light: '#2E8B7A', border: 'border-[#2E8B7A]' },
];

export const DJProfileView: React.FC<DJProfileViewProps> = ({
  onNavigateToDashboard,
  onOpenAuthModal,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(store.isAuthenticatedDJ());
  const [currentDJ, setCurrentDJ] = useState<DJProfile | null>(store.getCurrentDJ());
  
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [selectedTheme, setSelectedTheme] = useState(QR_THEMES[0]);
  const [fullProjectorMode, setFullProjectorMode] = useState(false);
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [banks, setBanks] = useState<BankItem[]>([]);

  // Image Upload Modals
  const [imageModalState, setImageModalState] = useState<{
    isOpen: boolean;
    type: 'avatar' | 'cover';
    title: string;
    currentUrl: string;
  }>({
    isOpen: false,
    type: 'avatar',
    title: 'Upload Profile Image',
    currentUrl: '',
  });

  // Magic Link Test state
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [magicLinkSentNotice, setMagicLinkSentNotice] = useState<string | null>(null);

  // Form edit states
  const [stageName, setStageName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [defaultVenue, setDefaultVenue] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('058');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [minTipAmount, setMinTipAmount] = useState(10000);
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([]);
  const [customQrTagline, setCustomQrTagline] = useState('');

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setIsAuthenticated(store.isAuthenticatedDJ());
      setCurrentDJ(store.getCurrentDJ());
    });

    store.getPayoutHistory().then((history) => {
      setPayouts(history);
    });

    store.getNigerianBanks().then((bankList) => {
      setBanks(bankList);
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (currentDJ) {
      setStageName(currentDJ.stageName || '');
      setHandle(currentDJ.handle || '');
      setBio(currentDJ.bio || '');
      setDefaultVenue(currentDJ.defaultVenue || '');
      setAvatarUrl(currentDJ.avatarUrl || '');
      setCoverUrl(currentDJ.coverUrl || '');
      setBankName(currentDJ.bankName || 'Guaranty Trust Bank (GTBank)');
      setBankCode(currentDJ.bankCode || '058');
      setAccountNumber(currentDJ.accountNumber || '0124892019');
      setAccountName(currentDJ.accountName || currentDJ.name);
      setMinTipAmount(currentDJ.minTipAmount || 10000);
      setSelectedGenres(currentDJ.genres || ['Afrobeats', 'Amapiano']);
      setCustomQrTagline(currentDJ.customQrTagline || `SCAN TO REQUEST & VIP TIP ${currentDJ.stageName.toUpperCase()}`);
    }
  }, [currentDJ]);

  // Request URL for DJ
  const requestUrl = currentDJ && typeof window !== 'undefined'
    ? `${window.location.origin}/#request/${currentDJ.handle}`
    : `https://vybecheckwithbama.live/#request/${currentDJ?.handle || 'djbama'}`;

  useEffect(() => {
    if (currentDJ) {
      QRCode.toDataURL(requestUrl, {
        width: 360,
        margin: 1.5,
        color: {
          dark: selectedTheme.dark,
          light: selectedTheme.light,
        },
      }).then(setQrDataUrl).catch(() => {});
    }
  }, [requestUrl, selectedTheme, currentDJ]);

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(requestUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl || !currentDJ) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `VybeCheck_${currentDJ.handle}_Tailored_QR.png`;
    a.click();
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDJ) return;

    store.updateDJProfile(currentDJ.id, {
      stageName: stageName.trim(),
      handle: handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''),
      bio: bio.trim(),
      defaultVenue: defaultVenue.trim(),
      avatarUrl: avatarUrl.trim(),
      coverUrl: coverUrl.trim(),
      bankName: bankName.trim(),
      accountNumber: accountNumber.trim(),
      accountName: accountName.trim(),
      minTipAmount: Number(minTipAmount) || 10000,
      genres: selectedGenres,
      customQrTagline: customQrTagline.trim(),
    });

    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
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

  const handleLogout = () => {
    store.logoutDJ();
  };

  const handleTestMagicLink = async () => {
    if (!currentDJ) return;
    setIsSendingMagicLink(true);
    setMagicLinkSentNotice(null);
    try {
      const res = await store.requestMagicLink(currentDJ.email);
      setIsSendingMagicLink(false);
      if (res.success) {
        setMagicLinkSentNotice(`Magic sign-in link dispatched to ${currentDJ.email}!`);
        setTimeout(() => setMagicLinkSentNotice(null), 5000);
      }
    } catch {
      setIsSendingMagicLink(false);
      setMagicLinkSentNotice('Error sending magic link.');
    }
  };

  if (!isAuthenticated || !currentDJ) {
    return (
      <div className="max-w-[480px] mx-auto px-6 py-16 text-center">
        <div className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-8 space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(91,63,209,0.15)] border border-[#5B3FD1] flex items-center justify-center mx-auto text-[#4D7CFE]">
            <Lock className="w-7 h-7" />
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-[0.25em] text-[#C6A15B] font-semibold block mb-2">
              PRIVATE PORTAL
            </span>
            <h2 className="font-['Syne'] text-2xl font-bold text-[#F5F2ED]">
              DJ Authentication Required
            </h2>
            <p className="text-xs text-[#8F8C88] mt-2 leading-relaxed">
              Sign in with your email or register a profile to customize your venue QR, manage VIP tip thresholds, and update DJ photos.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => onOpenAuthModal('login')}
              className="btn btn-primary btn-full"
            >
              Sign In with Magic Link
            </button>
            <button
              onClick={() => onOpenAuthModal('signup')}
              className="btn btn-ghost btn-full"
            >
              Register New DJ
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (fullProjectorMode) {
    return (
      <div className="fixed inset-0 z-50 bg-[#070708] flex flex-col items-center justify-center p-8 text-center select-none">
        <button
          onClick={() => setFullProjectorMode(false)}
          className="absolute top-6 right-6 btn btn-ghost text-xs"
        >
          Exit Projector
        </button>

        <div className="max-w-2xl mx-auto space-y-8">
          <div className="flex items-center justify-center gap-2">
            <span className="live-dot"></span>
            <span className="text-xs uppercase tracking-[0.25em] text-[#C6A15B] font-semibold">
              LIVE REQUEST BOOTH OPEN
            </span>
          </div>

          <h1 className="font-['Syne'] text-5xl sm:text-7xl font-extrabold text-[#F5F2ED]">
            {currentDJ.stageName}
          </h1>

          <p className="text-sm uppercase tracking-widest text-[#8F8C88]">
            {currentDJ.defaultVenue}
          </p>

          {qrDataUrl && (
            <div className="p-6 bg-[#E6D3A3] rounded-3xl inline-block shadow-2xl">
              <img src={qrDataUrl} alt={currentDJ.stageName} className="w-72 h-72 sm:w-80 sm:h-80 rounded-2xl mx-auto" />
            </div>
          )}

          <p className="text-lg font-['Syne'] font-bold text-[#F5F2ED] uppercase tracking-wider">
            {currentDJ.customQrTagline || 'SCAN WITH PHONE TO REQUEST TRACKS & VIP TIP'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 space-y-8">
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-[rgba(46,139,122,0.15)] border border-[#2E8B7A] text-[#F5F2ED] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#2E8B7A]" />
            <span>Profile and settings updated successfully!</span>
          </div>
        </div>
      )}

      {/* TOP PROFILE HEADER */}
      <div className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden relative">
        <div className="h-40 sm:h-48 w-full relative bg-gradient-to-r from-[#0E0E12] via-[rgba(91,63,209,0.3)] to-[#0E0E12] overflow-hidden">
          {currentDJ.coverUrl && (
            <img src={currentDJ.coverUrl} alt="Cover" className="w-full h-full object-cover opacity-40" />
          )}
          <button
            onClick={() => setImageModalState({
              isOpen: true,
              type: 'cover',
              title: 'Change Banner Photo',
              currentUrl: currentDJ.coverUrl || '',
            })}
            className="absolute top-4 left-4 text-xs font-medium px-3 py-1.5 rounded-lg bg-black/60 text-[#F5F2ED] hover:bg-black/80 flex items-center gap-1.5 backdrop-blur-md"
          >
            <Camera className="w-3.5 h-3.5 text-[#4D7CFE]" />
            <span>Change Cover</span>
          </button>

          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-black/60 text-[#F5F2ED] hover:bg-black/80 flex items-center gap-1.5 backdrop-blur-md"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#C6A15B]" />
              <span>{isEditing ? 'Cancel' : 'Edit Profile'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[rgba(139,58,58,0.4)] text-[#F5F2ED] hover:bg-[rgba(139,58,58,0.6)] flex items-center gap-1.5 backdrop-blur-md"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-6 pt-0 -mt-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-end gap-4">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-[#070708] bg-[#0E0E12] shadow-2xl relative flex-shrink-0 group">
              <img src={currentDJ.avatarUrl} alt={currentDJ.stageName} className="w-full h-full object-cover" />
              <button
                onClick={() => setImageModalState({
                  isOpen: true,
                  type: 'avatar',
                  title: 'Upload DJ Photo',
                  currentUrl: currentDJ.avatarUrl,
                })}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
              >
                <Camera className="w-5 h-5 text-[#4D7CFE]" />
              </button>
            </div>

            <div>
              <h1 className="font-['Syne'] text-2xl sm:text-3xl font-bold text-[#F5F2ED]">
                {currentDJ.stageName}
              </h1>
              <p className="text-xs text-[#8F8C88] uppercase tracking-wider">
                @{currentDJ.handle} • {currentDJ.defaultVenue}
              </p>
            </div>
          </div>

          <div className="flex gap-4 bg-[rgba(255,255,255,0.04)] px-4 py-2.5 rounded-xl border border-[rgba(255,255,255,0.06)]">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#8F8C88] block">Tips Earned</span>
              <span className="font-['Syne'] text-base font-bold text-[#E6D3A3]">
                ₦{(currentDJ.totalTipsEarned || 0).toLocaleString()}
              </span>
            </div>
            <div className="w-[1px] bg-[rgba(255,255,255,0.08)]"></div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#8F8C88] block">Requests</span>
              <span className="font-['Syne'] text-base font-bold text-[#F5F2ED]">
                {currentDJ.totalRequestsReceived || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2-COLUMN SETTINGS & QR STUDIO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* QR FLYER STUDIO (Col 5) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 sm:p-8 text-center space-y-6">
            <div className="text-left">
              <span className="text-[11px] uppercase tracking-[0.25em] text-[#C6A15B] font-semibold block mb-1">
                MY QR CODE
              </span>
              <h2 className="font-['Syne'] text-lg font-bold text-[#F5F2ED]">
                Venue Table Flyer
              </h2>
            </div>

            {qrDataUrl && (
              <div className="p-4 bg-[#E6D3A3] rounded-2xl inline-block shadow-2xl">
                <img src={qrDataUrl} alt={currentDJ.stageName} className="w-52 h-52 rounded-lg mx-auto" />
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#F5F2ED] uppercase tracking-wider">
                {currentDJ.customQrTagline}
              </p>
              <p className="text-[11px] text-[#8F8C88] font-mono truncate max-w-xs mx-auto">
                {requestUrl}
              </p>
            </div>

            {/* QR Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleDownloadQr} className="btn btn-gold text-xs">
                <Download className="w-3.5 h-3.5" />
                <span>Save PNG</span>
              </button>
              <button onClick={handleCopyLink} className="btn btn-ghost text-xs">
                {copied ? <Check className="w-3.5 h-3.5 text-[#2E8B7A]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setFullProjectorMode(true)} className="btn btn-ghost text-xs">
                <Tv className="w-3.5 h-3.5" />
                <span>Projector</span>
              </button>
              <button onClick={() => window.print()} className="btn btn-ghost text-xs">
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Email Security Info */}
          <div className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-[#F5F2ED] uppercase tracking-wider">
                Magic Link Security
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[#2E8B7A] bg-[rgba(46,139,122,0.15)] px-2 py-0.5 rounded">
                Active
              </span>
            </div>
            <p className="text-xs text-[#8F8C88]">
              Registered with <strong className="text-[#F5F2ED]">{currentDJ.email}</strong>. 1-click passwordless sign-in enabled.
            </p>
            {magicLinkSentNotice && (
              <p className="text-xs text-[#4D7CFE]">{magicLinkSentNotice}</p>
            )}
            <button
              onClick={handleTestMagicLink}
              disabled={isSendingMagicLink}
              className="btn btn-ghost btn-full text-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSendingMagicLink ? 'Sending...' : 'Test Send Magic Link'}</span>
            </button>
          </div>
        </div>

        {/* PROFILE SETTINGS FORM (Col 7) */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSaveProfile} className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-[rgba(255,255,255,0.08)]">
              <h3 className="font-['Syne'] text-lg font-bold text-[#F5F2ED]">
                Profile & Bank Details
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs text-[#8F8C88] hover:text-[#F5F2ED]"
              >
                {isEditing ? 'Cancel Edit' : 'Edit'}
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-2">
                    Stage Name
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={stageName}
                    onChange={(e) => setStageName(e.target.value)}
                    className="form-input disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-2">
                    Handle
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    className="form-input font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-2">
                  Default Venue / Residency
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={defaultVenue}
                  onChange={(e) => setDefaultVenue(e.target.value)}
                  className="form-input disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-2">
                  Specialty Genres
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_GENRES.map((g) => {
                    const isSel = selectedGenres.includes(g);
                    return (
                      <button
                        type="button"
                        key={g}
                        disabled={!isEditing}
                        onClick={() => toggleGenre(g)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          isSel
                            ? 'bg-[rgba(91,63,209,0.2)] text-[#F5F2ED] border-[#5B3FD1]'
                            : 'bg-[rgba(255,255,255,0.04)] text-[#8F8C88] border-[rgba(255,255,255,0.08)] hover:text-[#F5F2ED]'
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Payout Details & Wallet Section */}
            <div className="pt-6 border-t border-[rgba(255,255,255,0.08)] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.2em] text-[#C6A15B] font-semibold block">
                  SETTLEMENT ACCOUNT (PAYSTACK NUBAN)
                </span>
                <button
                  type="button"
                  onClick={() => setIsWithdrawalOpen(true)}
                  className="text-xs font-semibold text-[#070708] bg-gradient-to-r from-[#C6A15B] to-[#E6D3A3] px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Instant Payout</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-2">
                    Settlement Bank
                  </label>
                  {isEditing ? (
                    <select
                      value={bankCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        setBankCode(code);
                        const bObj = banks.find((b) => b.code === code);
                        if (bObj) setBankName(bObj.name);
                      }}
                      className="form-input"
                    >
                      {banks.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={bankName}
                      className="form-input disabled:opacity-50"
                    />
                  )}
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-2">
                    10-Digit Account Number
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    disabled={!isEditing}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="form-input font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-2">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="form-input disabled:opacity-50"
                />
              </div>
            </div>

            {isEditing && (
              <div className="pt-4 border-t border-[rgba(255,255,255,0.08)] flex justify-end">
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            )}
          </form>

          {/* PAYOUT HISTORY CARD */}
          <div className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 sm:p-8 mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#C6A15B]" />
                <h3 className="font-['Syne'] text-base font-bold text-[#F5F2ED]">
                  Recent Payout History
                </h3>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-[#8F8C88]">
                {payouts.length} Transfers
              </span>
            </div>

            {payouts.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#8F8C88]">
                No withdrawals yet. All incoming tips will accrue in your Available Wallet.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {payouts.map((p) => (
                  <div
                    key={p.id}
                    className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-['Syne'] font-bold text-[#E6D3A3]">
                          ₦{p.netAmount.toLocaleString()}
                        </span>
                        <span className="text-[10px] bg-[#2E8B7A]/20 text-[#2E8B7A] px-1.5 py-0.5 rounded font-mono uppercase">
                          {p.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#8F8C88] block mt-0.5">
                        {p.bankName} ({p.accountNumber}) • Ref: {p.reference}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#8F8C88]">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SUPABASE CLOUD DATABASE CONNECTION */}
          <div className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 sm:p-8 mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#2E8B7A]" />
                <h3 className="font-['Syne'] text-base font-bold text-[#F5F2ED]">
                  Supabase Cloud Database & Storage
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#2E8B7A]/20 text-[#2E8B7A] border border-[#2E8B7A]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E8B7A] animate-pulse"></span>
                PostgreSQL & Realtime Ready
              </span>
            </div>

            <p className="text-xs text-[#8F8C88] leading-relaxed">
              All live crowd song requests, payments, DJ tips, and notifications are backed by a scalable Supabase PostgreSQL schema with row-level security and Realtime publications.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                <span className="text-[10px] text-[#8F8C88] uppercase tracking-wider block">Database Tables</span>
                <span className="font-mono text-[#E6D3A3] text-xs mt-1 block">djs, events, song_requests, payments, payouts</span>
              </div>
              <div className="p-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                <span className="text-[10px] text-[#8F8C88] uppercase tracking-wider block">Realtime Channels</span>
                <span className="font-mono text-[#2E8B7A] text-xs mt-1 block">supabase_realtime (Active)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Withdrawal Modal */}
      <WithdrawalModal
        isOpen={isWithdrawalOpen}
        onClose={() => setIsWithdrawalOpen(false)}
        onSuccess={() => {
          store.getPayoutHistory().then((h) => setPayouts(h));
        }}
      />

      <DJImageUploadModal
        isOpen={imageModalState.isOpen}
        type={imageModalState.type}
        title={imageModalState.title}
        currentImageUrl={imageModalState.currentUrl}
        onClose={() => setImageModalState((prev) => ({ ...prev, isOpen: false }))}
        onSelectImage={(newUrl) => {
          if (imageModalState.type === 'avatar') {
            setAvatarUrl(newUrl);
            store.updateDJProfile(currentDJ.id, { avatarUrl: newUrl });
          } else {
            setCoverUrl(newUrl);
            store.updateDJProfile(currentDJ.id, { coverUrl: newUrl });
          }
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        }}
      />
    </div>
  );
};
