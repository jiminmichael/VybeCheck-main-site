import { ApiResponseError } from '../../src/services/apiResponse';
export const dj = { id: 'qa-dj', name: 'QA DJ', stageName: 'DJ Bama', handle: 'djbama', email: 'qa@example.com', bio: '', avatarUrl: '', genres: ['Afrobeats'], defaultVenue: 'QA Venue', minTipAmount: 10000, isVerified: true, availableBalance: 200000, totalWithdrawn: 0, totalTipsEarned: 50000, totalRequestsReceived: 1, totalSongsPlayed: 0, createdAt: '2026-10-13T10:00:00Z' };
export const event = { id: 'qa-event', djId: dj.id, name: 'QA Live Session', slug: 'qa-live-session', venue: dj.defaultVenue, isActive: true, requestsEnabled: true, tipsEnabled: true, publicQueueEnabled: true, autoPriority: true, minTip: 10000, maxTip: 500000 };
export const request = { id: 'qa-request', djId: dj.id, eventId: event.id, song: 'Water', artist: 'Tyla', genre: 'Amapiano', requesterName: 'QA Guest', status: 'pending', tipAmount: 0, priority: false, trackingToken: '550e8400-e29b-41d4-a716-446655440000', createdAt: '2026-10-13T10:00:00Z', updatedAt: '2026-10-13T10:00:00Z' };
const noop = () => {};
export const store = {
  subscribe: () => noop,
  getCurrentEvent: () => event, getCurrentDJ: () => dj, getEvents: () => [event], getRequests: () => [request],
  getActiveQueue: () => [], getPlayedHistory: () => [], getNotifications: () => [], getUnreadNotificationCount: () => 0,
  getDJs: () => [dj], getPayoutHistory: async () => [], getPayouts: () => [], getCurrentlyPlaying: () => undefined,
  isAuthenticatedDJ: () => true, isReady: () => true, isAuthReady: () => true,
  getRequestByToken: () => undefined,
  async trackRequest(token: string) {
    const response = await fetch(`/qa/track/${token}`);
    if (!response.ok) throw new ApiResponseError('Lookup failed', response.status);
    return response.json();
  },
  getNigerianBanks: async () => [{ code: '058', name: 'QA Bank' }], getFirebaseStatus: async () => ({ connected: true }),
  resolveBankAccount: async () => ({ success: true, accountName: 'QA DJ' }),
  createRequest: async (data: object) => ({ success: true, request: { ...request, ...data } }),
  updateDJProfile: async () => ({ success: true }),
  canMoveQueueItem: () => false,
};
export const auth = { currentUser: null };
export const api = async (path: string, body?: unknown) => {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new ApiResponseError('QA backend failure', response.status);
  return response.json();
};
export const saveProfileImage = async (value: string) => value;
