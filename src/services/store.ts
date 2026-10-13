import { onAuthStateChanged, createUserWithEmailAndPassword, GoogleAuthProvider, GithubAuthProvider, OAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, User } from 'firebase/auth';
import { collection, doc, getDocs, onSnapshot, query, where, Unsubscribe } from 'firebase/firestore';
import { auth, db, api, saveProfileImage } from './firebase';
import { EventItem, SongRequestItem, DJNotification, Genre, DJProfile, PayoutItem, BankItem, DJWalletInfo, EmailLogItem } from '../types';
import { soundEngine } from './soundEffects';

type Registration = Omit<DJProfile, 'id' | 'createdAt' | 'totalTipsEarned' | 'totalRequestsReceived' | 'totalSongsPlayed' | 'isVerified' | 'availableBalance' | 'totalWithdrawn'>;
type RequestInput = Pick<SongRequestItem, 'song' | 'artist' | 'genre'> & Partial<Pick<SongRequestItem, 'eventId' | 'requesterName' | 'dedication' | 'tipAmount' | 'priority' | 'artworkUrl' | 'previewUrl' | 'album' | 'identifiedViaAudio' | 'audioConfidence'>> & { honeypot?: string };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

class Store {
  private events: EventItem[] = [];
  private djs: DJProfile[] = [];
  private ownDJ: DJProfile | undefined;
  private requests: SongRequestItem[] = [];
  private notifications: DJNotification[] = [];
  private payouts: PayoutItem[] = [];
  private currentEventId = '';
  private requestedSlug = '';
  private listeners = new Set<() => void>();
  private initialized = false;
  private initializationError: string | null = null;
  private authOperation = false;
  private authVersion = 0;
  private privateListeners: Unsubscribe[] = [];
  private requestListener: Unsubscribe | undefined;
  private requestSubscription = '';
  private pendingWithdrawal: { signature: string; reference: string } | undefined;

  constructor() {
    onSnapshot(collection(db, 'events'), snapshot => {
      this.events = snapshot.docs.map(d => d.data() as EventItem).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      this.initialized = true;
      this.initializationError = null;
      this.resolveEvent();
      this.notify();
    }, error => this.reportError(error));
    onSnapshot(collection(db, 'public_djs'), snapshot => {
      this.djs = snapshot.docs.map(d => d.data() as DJProfile);
      this.resolveEvent();
      this.notify();
    }, error => this.reportError(error));
    onAuthStateChanged(auth, user => {
      if (this.authOperation) return;
      this.clearPrivateState();
      if (user) void this.finishSignIn(user).catch(error => this.reportError(error));
    });
  }

  private reportError(error: unknown) {
    this.initializationError = errorMessage(error);
    this.notify();
  }
  private notify() { this.listeners.forEach(listener => listener()); }
  public subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  public isReady() { return this.initialized; }
  public getInitializationError() { return this.initializationError; }
  public isAuthenticatedDJ() { return !!auth.currentUser && this.ownDJ?.id === auth.currentUser.uid; }
  public isAuth() { return this.isAuthenticatedDJ(); }
  public getCurrentDJ(): DJProfile { return (this.ownDJ || this.djs.find(d => d.id === this.getCurrentEvent()?.djId)) as DJProfile; }
  public getDJs() { return this.djs; }
  public getAllDJs() { return this.djs; }
  public getEmailLogs(): EmailLogItem[] { return []; }

  private clearPrivateState() {
    this.authVersion++;
    this.privateListeners.forEach(unsubscribe => unsubscribe());
    this.privateListeners = [];
    this.ownDJ = undefined;
    this.notifications = [];
    this.payouts = [];
    this.requestListener?.();
    this.requestListener = undefined;
    this.requestSubscription = '';
    this.requests = [];
    this.watchRequests();
    this.notify();
  }

  private async finishSignIn(user: User, profile: Record<string, unknown> = {}) {
    const version = this.authVersion;
    const result = await api<{ dj: DJProfile }>('/api/auth/profile', profile);
    if (auth.currentUser?.uid !== user.uid || version !== this.authVersion) throw new Error('Session changed. Please sign in again.');
    const ownEvents = await getDocs(query(collection(db, 'events'), where('djId', '==', user.uid)));
    if (auth.currentUser?.uid !== user.uid || version !== this.authVersion) throw new Error('Session changed. Please sign in again.');
    const incoming = ownEvents.docs.map(d => d.data() as EventItem);
    this.events = [...this.events.filter(e => e.djId !== user.uid), ...incoming];
    this.privateListeners.forEach(unsubscribe => unsubscribe());
    this.ownDJ = result.dj;
    this.initializationError = null;
    this.privateListeners = [
      onSnapshot(doc(db, 'djs', user.uid), snapshot => {
        if (version !== this.authVersion) return;
        this.ownDJ = snapshot.exists() ? snapshot.data() as DJProfile : undefined;
        this.notify();
      }, error => this.reportError(error)),
      onSnapshot(query(collection(db, 'notifications'), where('djId', '==', user.uid)), snapshot => {
        if (version !== this.authVersion) return;
        this.notifications = snapshot.docs.map(d => d.data() as DJNotification).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        this.notify();
      }, error => this.reportError(error)),
      onSnapshot(query(collection(db, 'payouts'), where('djId', '==', user.uid)), snapshot => {
        if (version !== this.authVersion) return;
        this.payouts = snapshot.docs.map(d => d.data() as PayoutItem).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        this.notify();
      }, error => this.reportError(error)),
    ];
    if (!this.requestedSlug) this.currentEventId = this.events.find(e => e.djId === user.uid)?.id || this.currentEventId;
    this.watchRequests();
    this.notify();
    return result.dj;
  }

  public async initFromBackend() {
    await auth.authStateReady();
    if (auth.currentUser) await this.finishSignIn(auth.currentUser);
  }

  private resolveEvent() {
    const publicDJ = this.djs.find(d => d.handle === this.requestedSlug);
    const linked = this.events.find(e => e.slug === this.requestedSlug) || (publicDJ && this.events.find(e => e.djId === publicDJ.id));
    if (linked) this.currentEventId = linked.id;
    else if (!this.events.some(e => e.id === this.currentEventId)) this.currentEventId = this.events.find(e => e.djId === this.ownDJ?.id)?.id || this.events[0]?.id || '';
    this.watchRequests();
  }

  private watchRequests() {
    const event = this.getCurrentEvent();
    const canRead = event && (event.publicQueueEnabled || event.djId === auth.currentUser?.uid);
    const key = canRead ? `${event.id}:${auth.currentUser?.uid || 'guest'}` : '';
    if (key === this.requestSubscription) return;
    this.requestListener?.();
    this.requestListener = undefined;
    this.requestSubscription = key;
    this.requests = [];
    if (!canRead) return;
    let firstSnapshot = true;
    this.requestListener = onSnapshot(query(collection(db, 'song_requests'), where('eventId', '==', event.id)), snapshot => {
      if (this.requestSubscription !== key) return;
      if (!firstSnapshot && this.isAuthenticatedDJ()) {
        const added = snapshot.docChanges().filter(change => change.type === 'added');
        if (added.length) soundEngine.play(added.some(change => change.doc.data().priority) ? 'vipRequest' : 'requestReceived');
      }
      firstSnapshot = false;
      this.requests = snapshot.docs.map(d => d.data() as SongRequestItem);
      this.notify();
    }, error => this.reportError(error));
  }
  public async fetchLatestRequests() { this.watchRequests(); }
  public getEvents() { return this.events; }
  public getCurrentEvent(): EventItem { return this.events.find(e => e.id === this.currentEventId) as EventItem; }
  public setCurrentEvent(id: string) { this.requestedSlug = ''; this.currentEventId = id; this.watchRequests(); this.notify(); }
  public setCurrentEventBySlug(slug: string) { this.requestedSlug = slug; this.resolveEvent(); this.notify(); return this.getCurrentEvent(); }
  public setCurrentDJByHandle(handle: string) { const dj = this.djs.find(d => d.handle === handle.replace(/^@/, '')); if (dj) this.setCurrentEventBySlug(dj.handle); return dj; }

  public async loginWithPassword(email: string, password: string) {
    this.authOperation = true;
    this.clearPrivateState();
    try {
      if (!email.includes('@')) throw new Error('Use the email address registered with your account.');
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const dj = await this.finishSignIn(result.user);
      return { success: true, dj };
    } catch (error) { return { success: false, error: errorMessage(error) }; }
    finally { this.authOperation = false; }
  }
  public async loginWithSocial(provider: 'google' | 'spotify' | 'apple' | 'github', extra?: { stageName?: string; name?: string; email?: string }) {
    this.authOperation = true;
    this.clearPrivateState();
    try {
      if (provider === 'spotify') throw new Error('Please use Google or email to sign in.');
      const authProvider = provider === 'google' ? new GoogleAuthProvider() : provider === 'github' ? new GithubAuthProvider() : new OAuthProvider('apple.com');
      const result = await signInWithPopup(auth, authProvider);
      const dj = await this.finishSignIn(result.user, extra?.stageName ? { stageName: extra.stageName } : {});
      return { success: true, dj };
    } catch (error) { return { success: false, error: errorMessage(error) }; }
    finally { this.authOperation = false; }
  }
  public async registerDJ(data: Registration) {
    this.authOperation = true;
    this.clearPrivateState();
    try {
      const { password, email, ...profile } = data;
      // A previous profile/upload failure can be retried without creating another Auth account.
      const user = auth.currentUser?.email === email ? auth.currentUser : (await createUserWithEmailAndPassword(auth, email, password || '')).user;
      profile.avatarUrl = await saveProfileImage(profile.avatarUrl, 'avatar') || '';
      if (profile.coverUrl) profile.coverUrl = await saveProfileImage(profile.coverUrl, 'cover');
      const dj = await this.finishSignIn(user, profile);
      return { success: true, dj };
    } catch (error) { return { success: false, error: errorMessage(error) }; }
    finally { this.authOperation = false; }
  }
  public signupDJ(data: Registration) { return this.registerDJ(data); }
  public async logoutDJ() {
    this.authOperation = true;
    try { await signOut(auth); this.clearPrivateState(); }
    catch (error) { this.reportError(error); }
    finally { this.authOperation = false; }
  }
  public async requestMagicLink(email: string) {
    try {
      if (!email.includes('@')) throw new Error('Enter your email address.');
      await sendSignInLinkToEmail(auth, email.trim(), { url: `${window.location.origin}/`, handleCodeInApp: true });
      localStorage.setItem('vybecheck_email_link', email.trim());
      return { success: true, email: email.trim(), message: 'Check your inbox for your sign-in link.' };
    } catch (error) { return { success: false, error: errorMessage(error) }; }
  }
  public async verifyMagicLink(link: string, email?: string) {
    this.authOperation = true;
    this.clearPrivateState();
    try {
      if (!isSignInWithEmailLink(auth, link)) throw new Error('Open the full sign-in link from your email.');
      const address = email || localStorage.getItem('vybecheck_email_link');
      if (!address) throw new Error('Enter the email address that received this link.');
      const result = await signInWithEmailLink(auth, address, link);
      const dj = await this.finishSignIn(result.user);
      localStorage.removeItem('vybecheck_email_link');
      window.history.replaceState(null, '', `${window.location.pathname}#profile`);
      return { success: true, dj };
    } catch (error) { return { success: false, error: errorMessage(error) }; }
    finally { this.authOperation = false; }
  }

  public async updateDJProfile(id: string, updates: Partial<DJProfile>) {
    try {
      const patch = { ...updates };
      if (patch.avatarUrl) patch.avatarUrl = await saveProfileImage(patch.avatarUrl, 'avatar');
      if (patch.coverUrl) patch.coverUrl = await saveProfileImage(patch.coverUrl, 'cover');
      const result = await api('/api/djs/' + encodeURIComponent(id), patch, 'PUT');
      this.ownDJ = result.dj;
      this.notify();
      return { success: true, dj: result.dj as DJProfile };
    } catch (error) { return { success: false, error: errorMessage(error) }; }
  }
  public async createEvent(name: string, venue: string) {
    try {
      const result = await api('/api/events', { name, venue });
      this.events = [...this.events.filter(e => e.id !== result.event.id), result.event];
      this.setCurrentEvent(result.event.id);
      return { success: true, event: result.event as EventItem };
    } catch (error) { return { success: false, error: errorMessage(error) }; }
  }
  public updateEventControls(idOrPatch: string | Partial<EventItem>, updates?: Partial<EventItem>) {
    const id = typeof idOrPatch === 'string' ? idOrPatch : this.currentEventId;
    const patch = typeof idOrPatch === 'string' ? updates : idOrPatch;
    void api(`/api/events/${encodeURIComponent(id)}`, patch, 'PATCH').catch(error => this.reportError(error));
  }
  public getRequests(eventId?: string) { return this.requests.filter(r => r.eventId === (eventId || this.currentEventId)); }
  public getAllRequests() { return this.requests; }
  public getRequestByToken(token: string) { return this.requests.find(r => r.trackingToken === token || r.id === token); }
  public async trackRequest(token: string) {
    const result = await api(`/api/requests/track/${encodeURIComponent(token)}`);
    this.requests = [...this.requests.filter(r => r.id !== result.request.id), result.request];
    this.notify();
    return result.request as SongRequestItem;
  }
  public getActiveQueue(eventId?: string) { return this.getRequests(eventId).filter(r => ['pending', 'up_next'].includes(r.status)).sort((a, b) => Number(b.priority) - Number(a.priority) || a.queuePosition - b.queuePosition); }
  public getCurrentlyPlaying(eventId?: string) { return this.getRequests(eventId).find(r => r.status === 'playing'); }
  public getPlayedHistory(eventId?: string) { return this.getRequests(eventId).filter(r => r.status === 'played').sort((a, b) => (b.playedAt || b.updatedAt).localeCompare(a.playedAt || a.updatedAt)); }
  public async createRequest(data: RequestInput) {
    try {
      const result = await api('/api/requests', { ...data, eventId: data.eventId || this.currentEventId });
      this.requests = [...this.requests.filter(r => r.id !== result.request.id), result.request];
      this.notify();
      return { success: true, request: result.request as SongRequestItem };
    } catch (error) { return { success: false, error: errorMessage(error) }; }
  }
  public async addRequest(data: RequestInput) { const result = await this.createRequest(data); if (!result.request) throw new Error(result.error); return result.request; }
  public async updateRequestStatus(id: string, status: SongRequestItem['status']) {
    try { await api(`/api/requests/${encodeURIComponent(id)}/status`, { status }, 'PATCH'); }
    catch (error) { this.reportError(error); }
  }
  public addToQueue(id: string) { return this.updateRequestStatus(id, 'up_next'); }
  public playRequest(id: string) { return this.updateRequestStatus(id, 'playing'); }
  public markPlayed(id: string) { return this.updateRequestStatus(id, 'played'); }
  public rejectRequest(id: string, _reason?: string) { return this.updateRequestStatus(id, 'rejected'); }
  public restoreRequest(id: string) { return this.updateRequestStatus(id, 'pending'); }
  public moveQueueItem(id: string, direction: 'up' | 'down') {
    const queue = this.getActiveQueue();
    const index = queue.findIndex(r => r.id === id);
    const target = index + (direction === 'up' ? -1 : 1);
    if (index < 0 || target < 0 || target >= queue.length) return;
    [queue[index], queue[target]] = [queue[target], queue[index]];
    void this.reorderQueue(queue.map(r => r.id));
  }
  public async reorderQueue(orderedIds: string[]) {
    try { await api('/api/requests/reorder', { orderedIds }); }
    catch (error) { this.reportError(error); }
  }
  public async verifyPayment(reference: string, requestIdOrToken: string, _amount: number) {
    try {
      const request = this.getRequestByToken(requestIdOrToken);
      if (!request) return false;
      await api('/api/payments/verify', { reference, requestId: request.id });
      await this.trackRequest(request.trackingToken);
      soundEngine.play('tipReceived');
      return true;
    } catch { return false; }
  }
  public verifyTipPayment(token: string, amount: number, reference?: string) { return reference ? this.verifyPayment(reference, token, amount) : Promise.resolve(false); }
  public getNotifications() { return this.notifications; }
  public getUnreadNotificationCount() { return this.notifications.filter(n => !n.read).length; }
  public async markNotificationAsRead(id: string) {
    try { await api(`/api/notifications/${encodeURIComponent(id)}/read`, {}, 'PATCH'); }
    catch (error) { this.reportError(error); }
  }
  public markNotificationRead(id: string) { return this.markNotificationAsRead(id); }
  public markAllNotificationsAsRead() { this.notifications.filter(n => !n.read).forEach(n => void this.markNotificationAsRead(n.id)); }
  public async getNigerianBanks(): Promise<BankItem[]> {
    try { return (await api('/api/payout/banks')).banks; } catch { return []; }
  }
  public async resolveBankAccount(accountNumber: string, bankCode: string) {
    try { return await api('/api/payout/resolve-account', { accountNumber, bankCode }); }
    catch (error) { return { success: false, error: errorMessage(error) }; }
  }
  public async requestInstantWithdrawal(amount: number, bank?: { bankName?: string; accountNumber?: string; accountName?: string; bankCode?: string }) {
    try {
      const dj = this.ownDJ;
      if (!dj) throw new Error('Sign in to withdraw funds.');
      const details = { amount, bankName: bank?.bankName || dj.bankName, accountNumber: bank?.accountNumber || dj.accountNumber, accountName: bank?.accountName || dj.accountName, bankCode: bank?.bankCode || dj.bankCode };
      const signature = JSON.stringify(details);
      if (this.pendingWithdrawal && this.pendingWithdrawal.signature !== signature) throw new Error('Check your payout history before starting another withdrawal.');
      this.pendingWithdrawal ||= { signature, reference: `payout-${crypto.randomUUID()}` };
      const result = await api('/api/payout/withdraw', { ...details, reference: this.pendingWithdrawal.reference });
      this.pendingWithdrawal = undefined;
      return result;
    } catch (error) { return { success: false, error: errorMessage(error) }; }
  }
  public async getPayoutHistory() { return this.payouts; }
  public async getWalletInfo(): Promise<DJWalletInfo> { return { availableBalance: this.ownDJ?.availableBalance || 0, totalTipsEarned: this.ownDJ?.totalTipsEarned || 0, totalWithdrawn: this.ownDJ?.totalWithdrawn || 0, payouts: this.payouts }; }
  public getStats() {
    const requests = this.getRequests();
    const genres: Record<string, number> = {};
    requests.forEach(r => { genres[r.genre] = (genres[r.genre] || 0) + 1; });
    return { totalRequests: requests.length, pendingRequests: this.getActiveQueue().length, playedRequests: this.getPlayedHistory().length, totalTips: requests.reduce((sum, r) => sum + r.tipAmount, 0), topGenre: (Object.keys(genres).sort((a, b) => genres[b] - genres[a])[0] || 'Afrobeats') as Genre };
  }
}
export const store = new Store();
