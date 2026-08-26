-- ============================================================================
-- VYBECHECK LIVE - SUPABASE POSTGRESQL DATABASE SCHEMA & MIGRATION
-- Run this script in the Supabase SQL Editor to provision all tables & policies.
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DJS TABLE
CREATE TABLE IF NOT EXISTS public.djs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    handle TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    bio TEXT,
    avatar_url TEXT,
    cover_url TEXT,
    phone TEXT,
    instagram_handle TEXT,
    twitter_handle TEXT,
    genres JSONB DEFAULT '["Afrobeats", "Amapiano", "3 STEP SA", "Afro House"]'::jsonb,
    default_venue TEXT,
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    bank_code TEXT DEFAULT '058',
    paystack_recipient_code TEXT,
    min_tip_amount NUMERIC DEFAULT 10000,
    qr_theme TEXT DEFAULT 'cyber-cyan',
    custom_qr_tagline TEXT DEFAULT 'SCAN TO REQUEST & VIP TIP',
    is_verified BOOLEAN DEFAULT true,
    available_balance NUMERIC DEFAULT 0,
    total_withdrawn NUMERIC DEFAULT 0,
    total_tips_earned NUMERIC DEFAULT 0,
    total_requests_received INTEGER DEFAULT 0,
    total_songs_played INTEGER DEFAULT 0,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.events (
    id TEXT PRIMARY KEY,
    dj_id TEXT NOT NULL REFERENCES public.djs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    dj_name TEXT NOT NULL,
    dj_email TEXT NOT NULL,
    venue TEXT NOT NULL,
    event_date TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    requests_enabled BOOLEAN DEFAULT true,
    public_queue_enabled BOOLEAN DEFAULT true,
    auto_priority BOOLEAN DEFAULT true,
    tips_enabled BOOLEAN DEFAULT true,
    min_tip NUMERIC DEFAULT 10000,
    max_tip NUMERIC DEFAULT 1000000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SONG REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.song_requests (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    dj_id TEXT NOT NULL REFERENCES public.djs(id) ON DELETE CASCADE,
    song TEXT NOT NULL,
    artist TEXT NOT NULL,
    genre TEXT NOT NULL DEFAULT 'Afrobeats',
    requester_name TEXT,
    dedication TEXT,
    tip_amount NUMERIC DEFAULT 0,
    priority BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'up_next' | 'playing' | 'played' | 'rejected'
    queue_position INTEGER DEFAULT 0,
    tracking_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    artwork_url TEXT,
    preview_url TEXT,
    album TEXT,
    identified_via_audio BOOLEAN DEFAULT false,
    audio_confidence NUMERIC,
    playing_started_at TIMESTAMPTZ,
    played_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PAYMENTS TABLE (PAYSTACK INTEGRATION)
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES public.song_requests(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    reference TEXT UNIQUE NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'NGN',
    status TEXT DEFAULT 'pending', -- 'pending' | 'success' | 'failed'
    customer_email TEXT,
    channel TEXT DEFAULT 'card',
    paystack_response JSONB,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PAYOUTS TABLE (DJ INSTANT NUBAN WITHDRAWALS)
CREATE TABLE IF NOT EXISTS public.payouts (
    id TEXT PRIMARY KEY,
    dj_id TEXT NOT NULL REFERENCES public.djs(id) ON DELETE CASCADE,
    reference TEXT UNIQUE NOT NULL,
    amount NUMERIC NOT NULL,
    fee NUMERIC DEFAULT 25,
    net_amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'NGN',
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    bank_code TEXT DEFAULT '058',
    paystack_transfer_code TEXT,
    status TEXT DEFAULT 'success', -- 'pending' | 'success' | 'failed'
    failure_reason TEXT,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. QUEUE AUDIT & HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.queue_history (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    song TEXT NOT NULL,
    artist TEXT NOT NULL,
    action TEXT NOT NULL,
    performer TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    dj_id TEXT NOT NULL REFERENCES public.djs(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'vip_tip' | 'request_received' | 'payout_success' | 'system'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    song TEXT,
    artist TEXT,
    tip_amount NUMERIC,
    read BOOLEAN DEFAULT false,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- INDEXES FOR HIGH-THROUGHPUT CLUB PERFORMANCE
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_requests_event_status ON public.song_requests(event_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_dj_status ON public.song_requests(dj_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_tracking_token ON public.song_requests(tracking_token);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON public.payments(reference);
CREATE INDEX IF NOT EXISTS idx_payouts_dj ON public.payouts(dj_id);
CREATE INDEX IF NOT EXISTS idx_notifications_dj ON public.notifications(dj_id, read);

-- ----------------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY (RLS) & POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.djs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_history ENABLE ROW LEVEL SECURITY;

-- Public read access for guest request flow and stage screen
DROP POLICY IF EXISTS "Public Read DJs" ON public.djs;
DROP POLICY IF EXISTS "Public Read Events" ON public.events;
DROP POLICY IF EXISTS "Public Read Requests" ON public.song_requests;
DROP POLICY IF EXISTS "Public Insert Requests" ON public.song_requests;
DROP POLICY IF EXISTS "Service Role Full Access DJs" ON public.djs;
DROP POLICY IF EXISTS "Service Role Full Access Events" ON public.events;
DROP POLICY IF EXISTS "Service Role Full Access Requests" ON public.song_requests;
DROP POLICY IF EXISTS "Service Role Full Access Payments" ON public.payments;
DROP POLICY IF EXISTS "Service Role Full Access Payouts" ON public.payouts;
DROP POLICY IF EXISTS "Service Role Full Access Notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service Role Full Access History" ON public.queue_history;

CREATE POLICY "Public Read Events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Public Read Requests" ON public.song_requests FOR SELECT USING (true);
CREATE POLICY "Public Insert Requests" ON public.song_requests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.is_active AND e.requests_enabled)
);

CREATE POLICY "DJ Read Own Profile" ON public.djs FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "DJ Insert Own Profile" ON public.djs FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "DJ Update Own Profile" ON public.djs FOR UPDATE TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "DJ Read Own Events" ON public.events FOR SELECT TO authenticated USING (dj_id IN (SELECT id FROM public.djs WHERE auth_user_id = auth.uid()));
CREATE POLICY "DJ Insert Own Events" ON public.events FOR INSERT TO authenticated WITH CHECK (dj_id IN (SELECT id FROM public.djs WHERE auth_user_id = auth.uid()));
CREATE POLICY "DJ Update Own Events" ON public.events FOR UPDATE TO authenticated USING (dj_id IN (SELECT id FROM public.djs WHERE auth_user_id = auth.uid())) WITH CHECK (dj_id IN (SELECT id FROM public.djs WHERE auth_user_id = auth.uid()));
CREATE POLICY "DJ Manage Own Requests" ON public.song_requests FOR UPDATE TO authenticated USING (dj_id IN (SELECT id FROM public.djs WHERE auth_user_id = auth.uid())) WITH CHECK (dj_id IN (SELECT id FROM public.djs WHERE auth_user_id = auth.uid()));
CREATE POLICY "DJ Read Own Payments" ON public.payments FOR SELECT TO authenticated USING (event_id IN (SELECT id FROM public.events WHERE dj_id IN (SELECT id FROM public.djs WHERE auth_user_id = auth.uid())));
CREATE POLICY "DJ Read Own Payouts" ON public.payouts FOR SELECT TO authenticated USING (dj_id IN (SELECT id FROM public.djs WHERE auth_user_id = auth.uid()));
CREATE POLICY "DJ Read Own Notifications" ON public.notifications FOR SELECT TO authenticated USING (dj_id IN (SELECT id FROM public.djs WHERE auth_user_id = auth.uid()));
CREATE POLICY "DJ Update Own Notifications" ON public.notifications FOR UPDATE TO authenticated USING (dj_id IN (SELECT id FROM public.djs WHERE auth_user_id = auth.uid()));

-- The service-role key bypasses RLS and is used only by trusted server routes.

-- ----------------------------------------------------------------------------
-- REALTIME REPLICATION (For instant DJ Booth alerts & Live Stage screen)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'song_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.song_requests;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'payouts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payouts;
  END IF;
END $$;
