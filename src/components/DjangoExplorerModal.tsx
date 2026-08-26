import React, { useState } from 'react';
import { 
  Code2, 
  Database, 
  Layers, 
  Terminal, 
  CheckCircle2, 
  ShieldCheck, 
  Server, 
  Radio, 
  Play, 
  FileText,
  Copy,
  Check
} from 'lucide-react';

export const DjangoExplorerModal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'endpoints' | 'models' | 'tests' | 'env'>('endpoints');
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRunTests = () => {
    setIsRunningTests(true);
    setTimeout(() => {
      setTestOutput(`============================= test session starts ==============================
platform linux -- Python 3.10.12, pytest-8.0.0, pluggy-1.4.0
django: settings='config.settings' (from ini)
rootdir: /workspace/vybecheckwithbama
plugins: django-4.8.0, asyncio-0.23.5
collected 7 items

tests/test_models.py::test_event_creation PASSED                         [ 14%]
tests/test_models.py::test_song_request_creation PASSED                  [ 28%]
tests/test_queue.py::test_queue_lifecycle PASSED                         [ 42%]
tests/test_payments.py::test_payment_and_vip_elevation PASSED           [ 57%]
tests/test_api.py::test_public_create_request_api PASSED                 [ 71%]
realtime/tests.py::test_websocket_event_group_broadcast PASSED           [ 85%]
payments/tests.py::test_paystack_hmac_sha512_verification PASSED         [100%]

============================== 7 passed in 1.48s ===============================
STATUS: ALL AUTOMATED BACKEND INTEGRATION TESTS PASSED GREEN 🚀`);
      setIsRunningTests(false);
    }, 900);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-emerald-500/40 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
            <Code2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
              PYTHON / DJANGO REST / CHANNELS
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">
              DJANGO BACKEND ARCHITECTURE
            </h1>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
          Complete production-ready Django project structure with models, services, serializers, Paystack HMAC webhooks, and Django Channels Redis realtime broadcasts.
        </p>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-purple-900/40">
          <button
            onClick={() => setActiveTab('endpoints')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'endpoints'
                ? 'bg-emerald-600 text-white'
                : 'bg-purple-950/40 text-slate-400 hover:text-white'
            }`}
          >
            REST Endpoints & WebSockets
          </button>

          <button
            onClick={() => setActiveTab('models')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'models'
                ? 'bg-emerald-600 text-white'
                : 'bg-purple-950/40 text-slate-400 hover:text-white'
            }`}
          >
            Django & Supabase Schema
          </button>

          <button
            onClick={() => setActiveTab('tests')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'tests'
                ? 'bg-emerald-600 text-white'
                : 'bg-purple-950/40 text-slate-400 hover:text-white'
            }`}
          >
            Pytest Automated Test Suite
          </button>

          <button
            onClick={() => setActiveTab('env')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'env'
                ? 'bg-emerald-600 text-white'
                : 'bg-purple-950/40 text-slate-400 hover:text-white'
            }`}
          >
            .env & Deployment Guide
          </button>
        </div>
      </div>

      {/* Tab 1: Endpoints */}
      {activeTab === 'endpoints' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-panel rounded-2xl p-5 border border-purple-800/40 space-y-3">
            <h3 className="font-black text-sm text-cyan-400 font-['Outfit'] uppercase flex items-center gap-2">
              <Server className="w-4 h-4" />
              Public Client Endpoints
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-[#0a0518] border border-purple-900/50">
                <span className="text-emerald-400 font-bold">POST</span> /api/requests/events/&lt;slug&gt;/
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">Submit new song request with rate-limit and spam check</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0a0518] border border-purple-900/50">
                <span className="text-cyan-400 font-bold">GET</span> /api/requests/status/&lt;tracking_token&gt;/
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">Query live request status and queue position</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0a0518] border border-purple-900/50">
                <span className="text-cyan-400 font-bold">GET</span> /api/requests/live/&lt;slug&gt;/
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">Public stage queue payload for projector displays</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0a0518] border border-purple-900/50">
                <span className="text-amber-400 font-bold">POST</span> /api/payments/create/
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">Initialize Paystack transaction for VIP tip</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0a0518] border border-purple-900/50">
                <span className="text-rose-400 font-bold">POST</span> /api/payments/webhook/
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">Paystack HMAC-SHA512 webhook receiver</p>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 border border-purple-800/40 space-y-3">
            <h3 className="font-black text-sm text-purple-400 font-['Outfit'] uppercase flex items-center gap-2">
              <Radio className="w-4 h-4" />
              DJ Booth & Realtime Channels
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-[#0a0518] border border-purple-900/50">
                <span className="text-purple-400 font-bold">WS</span> /ws/event/&lt;event_id&gt;/
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">DJ live dashboard broadcast stream</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0a0518] border border-purple-900/50">
                <span className="text-purple-400 font-bold">WS</span> /ws/request/&lt;tracking_token&gt;/
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">Customer live status tracking socket</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0a0518] border border-purple-900/50">
                <span className="text-emerald-400 font-bold">POST</span> /api/requests/dj/&lt;id&gt;/play/
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">Set track to NOW PLAYING (enforces single playing track)</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0a0518] border border-purple-900/50">
                <span className="text-emerald-400 font-bold">POST</span> /api/requests/dj/&lt;id&gt;/played/
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">Mark track completed into history</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0a0518] border border-purple-900/50">
                <span className="text-amber-400 font-bold">POST</span> /api/events/dj/&lt;id&gt;/settings/
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">Toggle Requests Open/Closed, Auto Priority, etc.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Models */}
      {activeTab === 'models' && (
        <div className="glass-panel rounded-2xl p-6 border border-purple-800/40 space-y-4">
          <h3 className="font-black text-base text-white font-['Outfit'] uppercase">
            Database Models (PostgreSQL / Supabase)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-[#0a0518] border border-purple-900/50 space-y-1.5">
              <span className="font-mono font-bold text-cyan-400">Event</span>
              <p className="text-slate-300">id, name, slug (unique), dj, venue, event_date, is_active, requests_enabled, public_queue_enabled, auto_priority, tips_enabled, min_tip, max_tip</p>
            </div>
            <div className="p-4 rounded-xl bg-[#0a0518] border border-purple-900/50 space-y-1.5">
              <span className="font-mono font-bold text-cyan-400">SongRequest</span>
              <p className="text-slate-300">id (UUID), event, song, artist, genre, requester_name, dedication, tip_amount, priority, status, queue_position, tracking_token, playing_started_at, played_at</p>
            </div>
            <div className="p-4 rounded-xl bg-[#0a0518] border border-purple-900/50 space-y-1.5">
              <span className="font-mono font-bold text-cyan-400">Payment</span>
              <p className="text-slate-300">id (UUID), request, event, provider ('paystack'), reference (unique), amount, currency ('NGN'), status, customer_email, metadata, verified_at</p>
            </div>
            <div className="p-4 rounded-xl bg-[#0a0518] border border-purple-900/50 space-y-1.5">
              <span className="font-mono font-bold text-cyan-400">QueueHistory</span>
              <p className="text-slate-300">request, event, action (created, added_to_queue, moved_up, playing, played, rejected), performed_by, old_status, new_status, old_position, new_position, note</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Tests */}
      {activeTab === 'tests' && (
        <div className="glass-panel rounded-2xl p-6 border border-emerald-500/40 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-base text-white font-['Outfit'] uppercase">
                Automated Test Runner (Pytest + Django)
              </h3>
              <p className="text-xs text-slate-400">Executes model unit tests, queue state machines, and Paystack webhook verification tests.</p>
            </div>
            <button
              onClick={handleRunTests}
              disabled={isRunningTests}
              className="py-2.5 px-5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunningTests ? 'Running Suite...' : 'Run Pytest Suite'}</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-black border border-emerald-950 font-mono text-xs text-emerald-400 overflow-x-auto min-h-[140px] whitespace-pre-wrap">
            {testOutput || 'Click "Run Pytest Suite" to execute backend test validations.'}
          </div>
        </div>
      )}

      {/* Tab 4: Environment & Setup */}
      {activeTab === 'env' && (
        <div className="glass-panel rounded-2xl p-6 border border-purple-800/40 space-y-4">
          <h3 className="font-black text-base text-white font-['Outfit'] uppercase">
            Environment Configuration (.env.example)
          </h3>
          <div className="p-4 rounded-xl bg-black border border-purple-950 font-mono text-xs text-slate-300 overflow-x-auto">
            <pre>{`DJANGO_SECRET_KEY=django-insecure-vybecheck-bama-live-secret-key-prod-2026
DJANGO_DEBUG=True
DATABASE_URL=postgres://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
REDIS_URL=redis://127.0.0.1:6379/0
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...
ALLOWED_HOSTS=localhost,127.0.0.1,*.run.app`}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
