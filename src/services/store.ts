import { EventItem, SongRequestItem, PaymentItem, QueueHistoryItem, DJNotification, Genre, DJProfile, EmailLogItem, PayoutItem, BankItem, DJWalletInfo } from '../types';
import { soundEngine } from './soundEffects';
import { getClientSupabase, signInWithSocialProvider, signOutSupabase } from './supabaseClient';

type Listener = () => void;

const supabase = getClientSupabase();

function mapDJ(row: any): DJProfile {
  return { ...row, stageName: row.stage_name || row.name, avatarUrl: row.avatar_url || '', coverUrl: row.cover_url || '',
    instagramHandle: row.instagram_handle, twitterHandle: row.twitter_handle,
    bankName: row.bank_name, accountNumber: row.account_number, accountName: row.account_name, bankCode: row.bank_code,
    paystackRecipientCode: row.paystack_recipient_code, minTipAmount: Number(row.min_tip_amount || 0),
    isVerified: Boolean(row.is_verified), availableBalance: Number(row.available_balance || 0), totalWithdrawn: Number(row.total_withdrawn || 0),
    totalTipsEarned: Number(row.total_tips_earned || 0), totalRequestsReceived: Number(row.total_requests_received || 0),
    totalSongsPlayed: Number(row.total_songs_played || 0), createdAt: row.created_at, genres: row.genres || [],
    bio: row.bio || '', defaultVenue: row.default_venue || 'Add your venue in DJ Profile' };
}

function mapEvent(row: any): EventItem {
  return { ...row, djId: row.dj_id, djName: row.dj_name, djEmail: row.dj_email, eventDate: row.event_date,
    isActive: Boolean(row.is_active), requestsEnabled: Boolean(row.requests_enabled), publicQueueEnabled: Boolean(row.public_queue_enabled),
    autoPriority: Boolean(row.auto_priority), tipsEnabled: Boolean(row.tips_enabled), minTip: Number(row.min_tip || 0),
    maxTip: Number(row.max_tip || 0), createdAt: row.created_at };
}

function mapRequest(row: any): SongRequestItem {
  return { ...row, eventId: row.event_id, requesterName: row.requester_name, tipAmount: Number(row.tip_amount || 0),
    priority: Boolean(row.priority), queuePosition: Number(row.queue_position || 0), trackingToken: row.tracking_token,
    artworkUrl: row.artwork_url, previewUrl: row.preview_url, identifiedViaAudio: Boolean(row.identified_via_audio),
    audioConfidence: row.audio_confidence ? Number(row.audio_confidence) : undefined, playingStartedAt: row.playing_started_at,
    playedAt: row.played_at, createdAt: row.created_at, updatedAt: row.updated_at };
}

class Store {
  private djs: DJProfile[] = [];
  private events: EventItem[] = [];
  private requests: SongRequestItem[] = [];
  private payments: PaymentItem[] = [];
  private payouts: PayoutItem[] = [];
  private history: QueueHistoryItem[] = [];
  private notifications: DJNotification[] = [];
  private emailLogs: EmailLogItem[] = [];
  private currentEventId: string = '';
  private currentDJId: string = '';
  private isDJAuthenticated: boolean = false;
  private listeners: Set<Listener> = new Set();
  private isInitialized: boolean = false;
  private initializationError: string | null = null;
  private pollTimer: any = null;

  constructor() {
    this.initFromBackend();
    // Background polling every 4s to keep real-time requests in sync across all devices
    if (typeof window !== 'undefined') {
      this.pollTimer = setInterval(() => {
        this.fetchLatestRequests();
      }, 4000);
    }
    if (supabase) {
      supabase.auth.onAuthStateChange((event, session) => {
        if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
          void this.initFromBackend();
        }
        if (event === 'SIGNED_OUT') {
          this.isDJAuthenticated = false;
          this.currentDJId = '';
          this.notify();
        }
      });
      supabase.channel('vybecheck-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'song_requests' }, () => void this.fetchLatestRequests())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, async () => {
          const { data } = await supabase.from('events').select('*').order('created_at', { ascending: true });
          if (data) { this.events = data.map(mapEvent); this.notify(); }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, async () => {
          if (!this.currentDJId) return;
          const { data } = await supabase.from('notifications').select('*').eq('dj_id', this.currentDJId).order('timestamp', { ascending: false });
          if (data) { this.notifications = data.map((row: any) => ({ ...row, tipAmount: Number(row.tip_amount || 0), read: Boolean(row.read) })); this.notify(); }
        })
        .subscribe();
    }
  }

  public async initFromBackend(): Promise<void> {
    try {
      if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      const [{ data: events, error: eventsError }, { data: requests, error: requestsError }, { data: sessionData }] = await Promise.all([
        supabase.from('events').select('*').order('created_at', { ascending: true }),
        supabase.from('song_requests').select('*').order('created_at', { ascending: false }),
        supabase.auth.getSession(),
      ]);
      if (eventsError) throw eventsError;
      if (requestsError) throw requestsError;
      const { data: djs, error: djsError } = sessionData.session
        ? await supabase.from('djs').select('*').order('created_at', { ascending: true })
        : { data: [], error: null };
      if (djsError) throw djsError;
      this.djs = (djs || []).map(mapDJ);
      this.events = (events || []).map(mapEvent);
      this.requests = (requests || []).map(mapRequest);
      this.currentEventId = this.events[0]?.id || '';
      this.currentDJId = this.djs[0]?.id || '';

      const authUserId = sessionData.session?.user.id;
      if (authUserId) {
        let { data: authDJ } = await supabase.from('djs').select('*').eq('auth_user_id', authUserId).maybeSingle();
        if (!authDJ) {
          const user = sessionData.session!.user;
          const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'DJ';
          const handle = `${displayName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'dj'}-${authUserId.slice(0, 6)}`;
          const { data: createdDJ, error: createError } = await supabase.from('djs').insert({
            id: crypto.randomUUID(), auth_user_id: authUserId, name: displayName, stage_name: displayName,
            handle, email: user.email || `${handle}@users.invalid`, genres: ['Afrobeats', 'Amapiano'], is_verified: true,
          }).select('*').single();
          if (createError) throw createError;
          authDJ = createdDJ;
        }
        const mapped = mapDJ(authDJ);
        this.djs = this.djs.some((dj) => dj.id === mapped.id) ? this.djs.map((dj) => dj.id === mapped.id ? mapped : dj) : [...this.djs, mapped];
        this.currentDJId = mapped.id;
        this.isDJAuthenticated = true;
        if (this.events.length === 0) {
          const { data: eventRow, error: eventError } = await supabase.from('events').insert({
            id: crypto.randomUUID(), dj_id: mapped.id, name: `${mapped.stageName} Live Session`,
            slug: `${mapped.handle}-${Date.now()}`, description: `Live song requests and tips for ${mapped.stageName}.`,
            dj_name: mapped.stageName, dj_email: mapped.email, venue: mapped.defaultVenue,
            is_active: true, requests_enabled: true, public_queue_enabled: true, auto_priority: true,
            tips_enabled: true, min_tip: mapped.minTipAmount, max_tip: 1000000,
          }).select('*').single();
          if (eventError) throw eventError;
          if (eventRow) { this.events.push(mapEvent(eventRow)); this.currentEventId = eventRow.id; }
        }
      }

      if (this.currentDJId) {
        const { data: notifications } = await supabase.from('notifications').select('*').eq('dj_id', this.currentDJId).order('timestamp', { ascending: false });
        this.notifications = (notifications || []).map((row: any) => ({ ...row, type: row.type, song: row.song, artist: row.artist, tipAmount: Number(row.tip_amount || 0), timestamp: row.timestamp, read: Boolean(row.read) }));
      }

      this.isInitialized = true;
      this.initializationError = null;
      this.notify();
    } catch (err) {
      this.initializationError = err instanceof Error ? err.message : 'Could not connect to Supabase.';
      console.error('Initial Supabase sync failed:', this.initializationError);
      this.notify();
    }
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  public getInitializationError(): string | null {
    return this.initializationError;
  }

  public async fetchLatestRequests(): Promise<void> {
    try {
      if (supabase) {
        const query = supabase.from('song_requests').select('*').order('created_at', { ascending: false });
        const { data: requests, error } = this.currentEventId ? await query.eq('event_id', this.currentEventId) : await query;
        if (!error && requests) {
          const mappedRequests = requests.map(mapRequest);
          // Check for new requests to trigger DJ sound alerts
          if (this.requests.length > 0 && mappedRequests.length > this.requests.length) {
            const newOnes = mappedRequests.filter((r: SongRequestItem) => !this.requests.some((existing) => existing.id === r.id));
            const hasVip = newOnes.some((r: SongRequestItem) => r.priority || r.tipAmount > 0);
            if (hasVip) {
              soundEngine.play('vipRequest');
            } else {
              soundEngine.play('requestReceived');
            }
          }
          this.requests = mappedRequests;
          this.notify();
        }
      }
    } catch (err) {}
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Store listener execution error:', err);
      }
    });
  }

  // --- AUTHENTICATION & DJ MANAGEMENT ---

  public isAuth(): boolean {
    return this.isDJAuthenticated;
  }

  public isAuthenticatedDJ(): boolean {
    return this.isDJAuthenticated;
  }

  public getCurrentDJ(): DJProfile {
    return this.djs.find((d) => d.id === this.currentDJId) || this.djs[0] as DJProfile;
  }

  public getDJs(): DJProfile[] {
    return this.djs;
  }

  public getAllDJs(): DJProfile[] {
    return this.djs;
  }

  public getEmailLogs(): EmailLogItem[] {
    return this.emailLogs;
  }

  public setCurrentDJByHandle(handle: string): DJProfile | undefined {
    const clean = handle.toLowerCase().replace('@', '').trim();
    const found = this.djs.find((d) => d.handle.toLowerCase() === clean);
    if (found) {
      this.currentDJId = found.id;
      const matchedEvent = this.events.find((e) => e.djEmail === found.email || e.djName === found.stageName);
      if (matchedEvent) {
        this.currentEventId = matchedEvent.id;
      }
      this.notify();
      return found;
    }
    return undefined;
  }

  public setCurrentEventBySlug(slug: string): EventItem | undefined {
    const event = this.events.find((item) => item.slug === slug);
    if (event) {
      this.currentEventId = event.id;
      this.currentDJId = event.djId || '';
      this.notify();
    }
    return event;
  }

  // --- WALLET & INSTANT PAYOUTS ---

  public async getNigerianBanks(): Promise<BankItem[]> {
    try {
      const res = await fetch('/api/payout/banks');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.banks)) {
          return data.banks;
        }
      }
    } catch (e) {}
    return [
      { name: 'Guaranty Trust Bank (GTBank)', code: '058' },
      { name: 'Access Bank', code: '044' },
      { name: 'Zenith Bank', code: '057' },
      { name: 'First Bank of Nigeria', code: '011' },
      { name: 'United Bank for Africa (UBA)', code: '033' },
      { name: 'Kuda Microfinance Bank', code: '50211' },
      { name: 'OPay Digital Services', code: '999992' },
      { name: 'PalmPay', code: '999991' },
      { name: 'Moniepoint Microfinance Bank', code: '50515' },
      { name: 'Wema Bank (ALAT)', code: '035' },
      { name: 'Stanbic IBTC Bank', code: '221' },
    ];
  }

  public async resolveBankAccount(accountNumber: string, bankCode: string): Promise<{ success: boolean; accountName?: string; error?: string }> {
    try {
      const res = await fetch('/api/payout/resolve-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, bankCode }),
      });
      const data = await res.json();
      if (data.success && data.accountName) {
        return { success: true, accountName: data.accountName };
      }
      return { success: false, error: data.error || 'Could not verify account holder name.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error resolving bank account.' };
    }
  }

  public async requestInstantWithdrawal(amount: number, customBank?: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    bankCode?: string;
  }): Promise<{ success: boolean; payout?: PayoutItem; error?: string }> {
    const dj = this.getCurrentDJ();
    if (!dj) {
      return { success: false, error: 'DJ profile not found.' };
    }

    try {
      const res = await fetch('/api/payout/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          djId: dj.id,
          amount,
          bankName: customBank?.bankName || dj.bankName,
          accountNumber: customBank?.accountNumber || dj.accountNumber,
          accountName: customBank?.accountName || dj.accountName || dj.name,
          bankCode: customBank?.bankCode || dj.bankCode,
        }),
      });

      const data = await res.json();
      if (data.success && data.payout) {
        // Update local DJ wallet balance
        dj.availableBalance = data.wallet.availableBalance;
        dj.totalWithdrawn = data.wallet.totalWithdrawn;
        this.payouts.unshift(data.payout);
        soundEngine.play('success');
        this.notify();
        return { success: true, payout: data.payout };
      }
      return { success: false, error: data.error || 'Instant withdrawal request failed.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error processing instant bank transfer.' };
    }
  }

  public async getPayoutHistory(): Promise<PayoutItem[]> {
    const dj = this.getCurrentDJ();
    if (!dj) return this.payouts;
    try {
      const res = await fetch(`/api/payout/history/${dj.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.payouts)) {
          this.payouts = data.payouts;
          this.notify();
          return data.payouts;
        }
      }
    } catch (e) {}
    return this.payouts;
  }

  public async getWalletInfo(): Promise<DJWalletInfo> {
    const dj = this.getCurrentDJ();
    const payouts = await this.getPayoutHistory();
    return {
      availableBalance: dj.availableBalance || 0,
      totalTipsEarned: dj.totalTipsEarned || 0,
      totalWithdrawn: dj.totalWithdrawn || 0,
      payouts,
    };
  }

  // REQUEST MAGIC LINK (Passwordless - Resend & SQLite)
  public async requestMagicLink(emailOrHandle: string): Promise<{
    success: boolean;
    email?: string;
    message?: string;
    error?: string;
  }> {
    const cleanInput = emailOrHandle.trim();
    let targetEmail = cleanInput;

    const djByHandle = this.djs.find((d) => d.handle.toLowerCase() === cleanInput.toLowerCase().replace('@', ''));
    if (djByHandle) {
      targetEmail = djByHandle.email;
    }

    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          redirectUrl: currentOrigin,
        }),
      });

      const data = await res.json();
      if (data.success) {
        return {
          success: true,
          email: data.email || targetEmail,
          message: data.message || `Magic sign-in link dispatched to ${targetEmail}. Check your inbox!`,
        };
      } else {
        return { success: false, error: data.error || 'Failed to dispatch magic sign-in link.' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error communicating with auth server.' };
    }
  }

  // VERIFY MAGIC LINK TOKEN OR 6-DIGIT CODE
  public async verifyMagicLink(tokenOrCode: string, emailHint?: string): Promise<{ success: boolean; dj?: DJProfile; error?: string }> {
    const clean = tokenOrCode.trim();
    if (!clean) {
      return { success: false, error: 'Please enter the 6-digit confirmation code.' };
    }

    try {
      const isToken = clean.startsWith('ml_');
      const payload: any = {
        token: isToken ? clean : undefined,
        code: !isToken ? clean : undefined,
        email: emailHint,
      };

      const res = await fetch('/api/auth/verify-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.dj) {
        const authedDj: DJProfile = data.dj;
        this.currentDJId = authedDj.id;
        this.isDJAuthenticated = true;

        if (typeof window !== 'undefined') {
          localStorage.setItem('vybecheck_dj_auth', JSON.stringify({ djId: authedDj.id, authenticatedAt: new Date().toISOString() }));
        }

        if (!this.djs.some((d) => d.id === authedDj.id)) {
          this.djs.push(authedDj);
        }

        soundEngine.play('success');
        this.notify();
        return { success: true, dj: authedDj };
      } else {
        return { success: false, error: data.error || 'Invalid or expired confirmation code.' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error verifying confirmation code.' };
    }
  }

  // EMAIL & PASSWORD LOGIN
  public async loginWithPassword(emailOrHandle: string, password: string): Promise<{ success: boolean; dj?: DJProfile; error?: string }> {
    try {
      if (!supabase) return { success: false, error: 'Supabase is not configured.' };
      let email = emailOrHandle.trim();
      if (!email.includes('@')) {
        const { data: dj } = await supabase.from('djs').select('email').eq('handle', email.toLowerCase()).maybeSingle();
        if (!dj) return { success: false, error: 'DJ not found.' };
        email = dj.email;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.user) {
        await this.initFromBackend();
        const authedDj = this.getCurrentDJ();
        this.currentDJId = authedDj.id;
        this.isDJAuthenticated = true;
        if (typeof window !== 'undefined') {
          localStorage.setItem('vybecheck_dj_auth', JSON.stringify({ djId: authedDj.id, authenticatedAt: new Date().toISOString() }));
        }

        if (!this.djs.some((d) => d.id === authedDj.id)) {
          this.djs.push(authedDj);
        }

        // Match event
        const matchedEvent = this.events.find((e) => e.djId === authedDj.id || e.djEmail === authedDj.email);
        if (matchedEvent) {
          this.currentEventId = matchedEvent.id;
        }

        soundEngine.play('success');
        this.notify();
        return { success: true, dj: authedDj };
      }
      return { success: false, error: error?.message || 'Invalid credentials' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login request failed' };
    }
  }

  // SOCIAL SIGN-IN (Google, Spotify, Apple, GitHub, Clerk)
  public async loginWithSocial(
    provider: 'google' | 'spotify' | 'apple' | 'github',
    extraUserInfo?: { email?: string; name?: string; stageName?: string; handle?: string; avatarUrl?: string }
  ): Promise<{
    success: boolean;
    dj?: DJProfile;
    error?: string;
  }> {
    try {
      const res = await signInWithSocialProvider(provider, undefined, extraUserInfo);
      if (res.success) {
        // OAuth redirects away; initFromBackend links the callback session to djs.
        return { success: true };
      } else {
        return { success: false, error: res.error || `Social login with ${provider} failed` };
      }
    } catch (err: any) {
      return { success: false, error: err.message || `Social login error` };
    }
  }

  public logoutDJ(): void {
    this.isDJAuthenticated = false;
    void signOutSupabase();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vybecheck_dj_auth');
    }
    this.notify();
  }

  // REGISTER NEW DJ PROFILE
  public async registerDJ(data: Omit<DJProfile, 'id' | 'createdAt' | 'totalTipsEarned' | 'totalRequestsReceived' | 'totalSongsPlayed' | 'isVerified' | 'availableBalance' | 'totalWithdrawn'>): Promise<{ success: boolean; dj?: DJProfile; error?: string }> {
    try {
      if (!supabase) return { success: false, error: 'Supabase is not configured.' };
      const { password, ...profile } = data;
      const { data: authData, error: authError } = await supabase.auth.signUp({ email: data.email, password: password || '' });
      if (authError || !authData.user) return { success: false, error: authError?.message || 'Could not create account.' };
      const id = crypto.randomUUID();
      const { data: row, error } = await supabase.from('djs').insert({ id, auth_user_id: authData.user.id, name: profile.name,
        stage_name: profile.stageName, handle: profile.handle, email: profile.email, bio: profile.bio, avatar_url: profile.avatarUrl,
        cover_url: profile.coverUrl, phone: profile.phone, instagram_handle: profile.instagramHandle, twitter_handle: profile.twitterHandle,
        genres: profile.genres, default_venue: profile.defaultVenue, bank_name: profile.bankName, account_number: profile.accountNumber,
        account_name: profile.accountName, bank_code: profile.bankCode, min_tip_amount: profile.minTipAmount, qr_theme: profile.qrTheme,
        custom_qr_tagline: profile.customQrTagline }).select('*').single();
      if (!error && row) {
        const dj = mapDJ(row);
        const eventId = crypto.randomUUID();
        const eventSlug = `${dj.handle}-${Date.now()}`;
        const { data: eventRow, error: eventError } = await supabase.from('events').insert({
          id: eventId, dj_id: dj.id, name: `${dj.stageName} Live Session`, slug: eventSlug,
          description: `Live song requests and tips for ${dj.stageName}.`, dj_name: dj.stageName,
          dj_email: dj.email, venue: dj.defaultVenue, is_active: true, requests_enabled: true,
          public_queue_enabled: true, auto_priority: true, tips_enabled: true, min_tip: dj.minTipAmount,
          max_tip: 1000000,
        }).select('*').single();
        if (eventError || !eventRow) return { success: false, error: eventError?.message || 'Failed to create initial event.' };
        this.djs.push(dj);
        this.events.push(mapEvent(eventRow));
        this.currentEventId = eventId;
        this.currentDJId = dj.id;
        this.isDJAuthenticated = true;
        if (typeof window !== 'undefined') {
          localStorage.setItem('vybecheck_dj_auth', JSON.stringify({ djId: dj.id }));
        }

        this.sendWelcomeEmail(dj);
        soundEngine.play('success');
        this.notify();
        return { success: true, dj };
      }
      return { success: false, error: error?.message || 'Failed to create DJ profile.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async signupDJ(data: Omit<DJProfile, 'id' | 'createdAt' | 'totalTipsEarned' | 'totalRequestsReceived' | 'totalSongsPlayed' | 'isVerified' | 'availableBalance' | 'totalWithdrawn'>) {
    return this.registerDJ(data);
  }

  // UPDATE DJ PROFILE
  public async updateDJProfile(id: string, updates: Partial<DJProfile>): Promise<{ success: boolean; dj?: DJProfile; error?: string }> {
    try {
      if (!supabase) return { success: false, error: 'Supabase is not configured.' };
      const dbUpdates: Record<string, unknown> = {};
      Object.entries(updates).forEach(([key, value]) => { dbUpdates[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] = value; });
      const { data: row, error } = await supabase.from('djs').update(dbUpdates).eq('id', id).select('*').single();
      if (!error && row) {
        const updatedDJ = mapDJ(row);
        const idx = this.djs.findIndex((d) => d.id === id);
        if (idx !== -1) {
          this.djs[idx] = updatedDJ;
        }
        this.notify();
        return { success: true, dj: updatedDJ };
      }
      return { success: false, error: error?.message || 'Failed to update DJ profile.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async sendWelcomeEmail(dj: DJProfile): Promise<void> {
    try {
      const reqUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/#request/${dj.handle}`
        : `https://vybecheckwithbama.live/#request/${dj.handle}`;

      await fetch('/api/auth/send-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: dj.email,
          stageName: dj.stageName,
          handle: dj.handle,
          venue: dj.defaultVenue,
          requestUrl: reqUrl,
        }),
      });
    } catch (e) {}
  }

  // --- EVENTS ---
  public getEvents(): EventItem[] {
    return this.events;
  }

  public getCurrentEvent(): EventItem {
    return this.events.find((e) => e.id === this.currentEventId) || this.events[0] as EventItem;
  }

  public setCurrentEvent(eventId: string): void {
    this.currentEventId = eventId;
    this.notify();
  }

  public async createEvent(name: string, venue: string): Promise<{ success: boolean; event?: EventItem; error?: string }> {
    if (!supabase || !this.isAuthenticatedDJ() || !this.currentDJId) return { success: false, error: 'DJ authentication is required.' };
    const dj = this.getCurrentDJ();
    const eventName = name.trim();
    const eventVenue = venue.trim();
    if (!eventName || !eventVenue) return { success: false, error: 'Event name and venue are required.' };
    const row = {
      id: crypto.randomUUID(), dj_id: this.currentDJId, name: eventName,
      slug: `${dj.handle}-${Date.now()}`, description: `Live song requests and tips for ${dj.stageName}.`,
      dj_name: dj.stageName, dj_email: dj.email, venue: eventVenue, is_active: true,
      requests_enabled: true, public_queue_enabled: true, auto_priority: true, tips_enabled: true,
      min_tip: dj.minTipAmount, max_tip: 1000000,
    };
    const { data, error } = await supabase.from('events').insert(row).select('*').single();
    if (error || !data) return { success: false, error: error?.message || 'Could not create event.' };
    const event = mapEvent(data);
    this.events.push(event);
    this.currentEventId = event.id;
    this.notify();
    return { success: true, event };
  }

  public updateEventControls(eventIdOrUpdates: string | Partial<EventItem>, updates?: Partial<EventItem>): void {
    const eventId = typeof eventIdOrUpdates === 'string' ? eventIdOrUpdates : this.currentEventId;
    const patch = typeof eventIdOrUpdates === 'object' ? eventIdOrUpdates : (updates || {});
    
    const event = this.events.find((e) => e.id === eventId) || this.events[0];
    if (event) {
      Object.assign(event, patch);
      if (supabase) {
        const dbPatch: Record<string, unknown> = {};
        Object.entries(patch).forEach(([key, value]) => {
          const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
          dbPatch[snakeKey] = value;
        });
        void supabase.from('events').update(dbPatch).eq('id', event.id).then(({ error }) => {
          if (error) console.error('Failed to update event in Supabase:', error.message);
        });
      }
      this.notify();
    }
  }

  // --- SONG REQUESTS & LIVE QUEUE ---
  public getRequests(eventId?: string): SongRequestItem[] {
    const targetEvent = eventId || this.currentEventId;
    return this.requests.filter((r) => r.eventId === targetEvent);
  }

  public getAllRequests(): SongRequestItem[] {
    return this.requests;
  }

  public getRequestByToken(token: string): SongRequestItem | undefined {
    return this.requests.find((r) => r.trackingToken === token || r.id === token);
  }

  public getActiveQueue(eventId?: string): SongRequestItem[] {
    const targetEvent = eventId || this.currentEventId;
    return this.requests
      .filter((r) => r.eventId === targetEvent && (r.status === 'pending' || r.status === 'up_next'))
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority ? -1 : 1;
        }
        return a.queuePosition - b.queuePosition;
      });
  }

  public getCurrentlyPlaying(eventId?: string): SongRequestItem | undefined {
    const targetEvent = eventId || this.currentEventId;
    return this.requests.find((r) => r.eventId === targetEvent && r.status === 'playing');
  }

  public getPlayedHistory(eventId?: string): SongRequestItem[] {
    const targetEvent = eventId || this.currentEventId;
    return this.requests
      .filter((r) => r.eventId === targetEvent && r.status === 'played')
      .sort((a, b) => new Date(b.playedAt || b.updatedAt).getTime() - new Date(a.playedAt || a.updatedAt).getTime());
  }

  public async createRequest(data: {
    eventId?: string;
    song: string;
    artist: string;
    genre: Genre;
    requesterName?: string;
    dedication?: string;
    tipAmount?: number;
    priority?: boolean;
    honeypot?: string;
    artworkUrl?: string;
    previewUrl?: string;
    album?: string;
    identifiedViaAudio?: boolean;
    audioConfidence?: number;
  }): Promise<{ success: boolean; request?: SongRequestItem; error?: string }> {
    if (data.honeypot) {
      return Promise.resolve({ success: false, error: 'Spam submission detected.' });
    }

    const currentDj = this.getCurrentDJ();
    const event = this.getCurrentEvent();
    const token = `TRK-${data.song.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'VYBE')}-${Math.floor(1000 + Math.random() * 9000)}`;

    if (!supabase || !event?.id || !event.djId) {
      return Promise.resolve({ success: false, error: 'No active Supabase event is available.' });
    }

    const newReq: SongRequestItem = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      eventId: data.eventId || event.id,
      song: data.song,
      artist: data.artist,
      genre: data.genre,
      requesterName: data.requesterName || 'Anonymous Fan',
      dedication: data.dedication || undefined,
      tipAmount: Number(data.tipAmount) || 0,
      priority: Boolean(data.priority || (Number(data.tipAmount) > 0)),
      status: 'pending',
      queuePosition: this.requests.length + 1,
      trackingToken: token,
      artworkUrl: data.artworkUrl,
      previewUrl: data.previewUrl,
      album: data.album,
      identifiedViaAudio: data.identifiedViaAudio,
      audioConfidence: data.audioConfidence,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.requests.unshift(newReq);

    if (newReq.priority) {
      soundEngine.play('vipRequest');
    } else {
      soundEngine.play('requestReceived');
    }

    this.notify();

    try {
      const { error } = await supabase.from('song_requests').insert({ id: newReq.id, event_id: newReq.eventId, dj_id: event.djId,
        song: newReq.song, artist: newReq.artist, genre: newReq.genre, requester_name: newReq.requesterName,
        dedication: newReq.dedication, tip_amount: newReq.tipAmount, priority: newReq.priority, status: newReq.status,
        queue_position: newReq.queuePosition, tracking_token: newReq.trackingToken, artwork_url: newReq.artworkUrl,
        preview_url: newReq.previewUrl, album: newReq.album, identified_via_audio: newReq.identifiedViaAudio,
        audio_confidence: newReq.audioConfidence });
      if (error) throw error;
      return { success: true, request: newReq };
    } catch (error: any) {
      this.requests = this.requests.filter((request) => request.id !== newReq.id);
      this.notify();
      console.error('Failed to create request in Supabase:', error.message);
      return { success: false, error: error.message || 'Failed to save request.' };
    }
  }

  public async addRequest(reqData: {
    song: string;
    artist: string;
    genre: Genre;
    requesterName?: string;
    dedication?: string;
    tipAmount?: number;
    priority?: boolean;
    artworkUrl?: string;
    previewUrl?: string;
    album?: string;
    identifiedViaAudio?: boolean;
    audioConfidence?: number;
  }): Promise<SongRequestItem> {
    const res = await this.createRequest(reqData);
    if (res.success && res.request) {
      return res.request;
    }
    throw new Error(res.error || 'Failed to add request');
  }

  public async updateRequestStatus(requestId: string, status: SongRequestItem['status']): Promise<void> {
    const performer = this.getCurrentDJ()?.stageName || 'DJ Bama';

    if (status === 'playing') {
      const currentlyPlaying = this.getCurrentlyPlaying();
      if (currentlyPlaying && currentlyPlaying.id !== requestId) {
        await this.updateRequestStatus(currentlyPlaying.id, 'played');
      }
      soundEngine.play('songPlaying');
    } else if (status === 'up_next') {
      soundEngine.play('cueTrack');
    } else if (status === 'played') {
      soundEngine.play('success');
    } else if (status === 'rejected') {
      soundEngine.play('rejectRequest');
    }

    const idx = this.requests.findIndex((r) => r.id === requestId);
    if (idx !== -1) {
      this.requests[idx].status = status;
      this.requests[idx].updatedAt = new Date().toISOString();
      if (status === 'playing') {
        this.requests[idx].playingStartedAt = new Date().toISOString();
      }
      if (status === 'played') {
        this.requests[idx].playedAt = new Date().toISOString();
      }
      this.notify();
    }

    try {
      if (supabase) {
        const now = new Date().toISOString();
        const patch: Record<string, unknown> = { status, updated_at: now };
        if (status === 'playing') patch.playing_started_at = now;
        if (status === 'played') patch.played_at = now;
        const { data: updated, error } = await supabase.from('song_requests').update(patch).eq('id', requestId).select('*').single();
        if (error) throw error;
        if (idx !== -1 && updated) this.requests[idx] = mapRequest(updated);
        await supabase.from('queue_history').insert({ id: crypto.randomUUID(), request_id: requestId,
          song: this.requests[idx]?.song || '', artist: this.requests[idx]?.artist || '', action: status,
          performer, old_status: undefined, new_status: status });
        this.notify();
      }
    } catch (err) {
      console.error('Failed to update request status in Supabase:', err);
    }
  }

  public addToQueue(requestId: string): Promise<void> {
    return this.updateRequestStatus(requestId, 'up_next');
  }

  public playRequest(requestId: string): Promise<void> {
    return this.updateRequestStatus(requestId, 'playing');
  }

  public markPlayed(requestId: string): Promise<void> {
    return this.updateRequestStatus(requestId, 'played');
  }

  public rejectRequest(requestId: string, _reason?: string): Promise<void> {
    return this.updateRequestStatus(requestId, 'rejected');
  }

  public restoreRequest(requestId: string): Promise<void> {
    return this.updateRequestStatus(requestId, 'pending');
  }

  public moveQueueItem(requestId: string, direction: 'up' | 'down'): void {
    const active = this.getActiveQueue();
    const index = active.findIndex((r) => r.id === requestId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= active.length) return;

    const reordered = [...active];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    this.reorderQueue(reordered.map((r) => r.id));
  }

  public async reorderQueue(orderedIds: string[]): Promise<void> {
    orderedIds.forEach((id, index) => {
      const req = this.requests.find((r) => r.id === id);
      if (req) {
        req.queuePosition = index + 1;
      }
    });
    this.notify();

    if (supabase) {
      await Promise.all(orderedIds.map((id, index) => supabase.from('song_requests').update({ queue_position: index + 1 }).eq('id', id)));
    }
  }

  public async verifyPayment(reference: string, requestIdOrToken: string, tipAmount: number): Promise<boolean> {
    const req = this.requests.find((r) => r.id === requestIdOrToken || r.trackingToken === requestIdOrToken);
    if (req) {
      req.tipAmount = (req.tipAmount || 0) + Number(tipAmount);
      req.priority = true;
      soundEngine.play('tipReceived');
      this.notify();
    }

    try {
      if (!supabase || !req) return false;
      const verificationResponse = await fetch('/api/payments/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, requestId: req.id, tipAmount: Number(tipAmount) }),
      });
      const verification = await verificationResponse.json();
      if (!verificationResponse.ok || verification.success !== true) return false;
      const { error: requestError } = await supabase.from('song_requests').update({ tip_amount: req.tipAmount, priority: true }).eq('id', req.id);
      if (requestError) return false;
      const { error: paymentError } = await supabase.from('payments').upsert({ id: crypto.randomUUID(), request_id: req.id,
        event_id: req.eventId, reference, amount: Number(tipAmount), status: 'success', paid_at: new Date().toISOString() }, { onConflict: 'reference' });
      return !paymentError;
    } catch (err) {
      return false;
    }
  }

  public verifyTipPayment(tokenOrRef: string, tipAmount: number, reference?: string): Promise<boolean> {
    const ref = reference || `PAY_REF_${Date.now()}`;
    return this.verifyPayment(ref, tokenOrRef, tipAmount);
  }

  // --- NOTIFICATIONS ---
  public getNotifications(): DJNotification[] {
    return this.notifications;
  }

  public getUnreadNotificationCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  public async markNotificationAsRead(id: string): Promise<void> {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      this.notify();
      if (supabase) await supabase.from('notifications').update({ read: true }).eq('id', id);
    }
  }

  public markNotificationRead(id: string): Promise<void> {
    return this.markNotificationAsRead(id);
  }

  public markAllNotificationsAsRead(): void {
    this.notifications.forEach((n) => {
      n.read = true;
      if (supabase) void supabase.from('notifications').update({ read: true }).eq('id', n.id);
    });
    this.notify();
  }

  // --- METRICS ---
  public getStats() {
    const currentDj = this.getCurrentDJ();
    const all = this.requests;
    const pending = all.filter((r) => r.status === 'pending' || r.status === 'up_next');
    const played = all.filter((r) => r.status === 'played');
    const totalTips = all.reduce((sum, r) => sum + (r.tipAmount || 0), 0) + (currentDj?.totalTipsEarned || 0);

    return {
      totalRequests: all.length + (currentDj?.totalRequestsReceived || 0),
      pendingRequests: pending.length,
      playedRequests: played.length + (currentDj?.totalSongsPlayed || 0),
      totalTips,
      topGenre: this.getTopGenre(),
    };
  }

  private getTopGenre(): Genre {
    const counts: Record<string, number> = {};
    this.requests.forEach((r) => {
      counts[r.genre] = (counts[r.genre] || 0) + 1;
    });
    let top = 'Afrobeats';
    let max = 0;
    Object.entries(counts).forEach(([genre, count]) => {
      if (count > max) {
        max = count;
        top = genre;
      }
    });
    return top as Genre;
  }
}

export const store = new Store();
