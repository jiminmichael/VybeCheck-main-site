export type Genre =
  | '3 STEP SA'
  | 'Afro House'
  | 'Afrobeats'
  | 'Amapiano'
  | 'Hip Hop'
  | 'R&B'
  | 'Dancehall'
  | 'House'
  | 'Electronic'
  | 'Other';

export type RequestStatus = 'pending' | 'up_next' | 'playing' | 'played' | 'rejected';

export interface DJProfile {
  id: string;
  name: string;
  stageName: string;
  handle: string; // e.g. "djbama", "djspinall"
  email: string;
  password?: string;
  bio: string;
  avatarUrl: string;
  coverUrl?: string;
  phone?: string;
  instagramHandle?: string;
  twitterHandle?: string;
  genres: Genre[];
  defaultVenue: string;
  paystackSubaccountCode?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  bankCode?: string;
  paystackRecipientCode?: string;
  minTipAmount: number;
  qrTheme?: 'cyber-cyan' | 'neon-purple' | 'gold-vip' | 'emerald-wave';
  customQrTagline?: string;
  isVerified: boolean;
  availableBalance: number;
  totalWithdrawn: number;
  totalTipsEarned: number;
  totalRequestsReceived: number;
  totalSongsPlayed: number;
  createdAt: string;
}

export interface PayoutItem {
  id: string;
  djId: string;
  reference: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode?: string;
  paystackTransferCode?: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  failureReason?: string;
  createdAt: string;
  processedAt?: string;
}

export interface BankItem {
  name: string;
  code: string;
  slug?: string;
}

export interface DJWalletInfo {
  availableBalance: number;
  totalTipsEarned: number;
  totalWithdrawn: number;
  payouts: PayoutItem[];
}

export interface RealTrackSuggestion {
  id: string;
  song: string;
  artist: string;
  genre: Genre;
  album?: string;
  artworkUrl?: string;
  previewUrl?: string;
  releaseYear?: number | string;
  durationMs?: number;
  identifiedConfidence?: number;
  matchNotes?: string;
}

export interface SongRequestItem {
  id: string;
  eventId: string;
  song: string;
  artist: string;
  genre: Genre;
  requesterName?: string;
  dedication?: string;
  tipAmount: number;
  priority: boolean;
  status: RequestStatus;
  queuePosition: number;
  trackingToken: string;
  ipAddress?: string;
  artworkUrl?: string;
  previewUrl?: string;
  album?: string;
  identifiedViaAudio?: boolean;
  audioConfidence?: number;
  playingStartedAt?: string | null;
  playedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventItem {
  id: string;
  djId?: string;
  name: string;
  slug: string;
  description: string;
  djName: string;
  djEmail: string;
  venue: string;
  eventDate: string;
  isActive: boolean;
  requestsEnabled: boolean;
  publicQueueEnabled: boolean;
  autoPriority: boolean;
  tipsEnabled: boolean;
  minTip: number;
  maxTip: number;
  createdAt?: string;
}

export interface PaymentItem {
  id: string;
  requestId: string;
  eventId: string;
  reference: string;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'abandoned';
  customerEmail: string;
  createdAt: string;
  paidAt?: string;
}

export interface QueueHistoryItem {
  id: string;
  requestId: string;
  song: string;
  artist: string;
  action: 'created' | 'added_to_queue' | 'moved_up' | 'moved_down' | 'playing' | 'played' | 'rejected' | 'restored' | 'payment_verified';
  performer: string;
  oldStatus?: string;
  newStatus?: string;
  note?: string;
  createdAt: string;
}

export interface DJNotification {
  id: string;
  type: 'new_request' | 'vip_request' | 'tip_confirmed' | 'now_playing' | 'system' | 'magic_link_sent';
  title: string;
  message: string;
  song?: string;
  artist?: string;
  tipAmount?: number;
  timestamp: string;
  read: boolean;
}

export interface MagicLinkToken {
  token: string;
  email: string;
  djId?: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
}

export interface EmailLogItem {
  id: string;
  to: string;
  subject: string;
  type: 'magic_link' | 'welcome' | 'tip_alert';
  previewHtml?: string;
  sentAt: string;
  status: 'sent' | 'simulated';
  magicLinkUrl?: string;
  code?: string;
}

