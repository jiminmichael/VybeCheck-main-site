import React, { useState } from 'react';
import { api } from '../services/firebase';
import { 
  CreditCard, ShieldCheck, X, CheckCircle2, Crown 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SongRequestItem } from '../types';
import { store } from '../services/store';

interface PaystackCheckoutModalProps {
  request: SongRequestItem;
  tipAmount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaystackCheckoutModal: React.FC<PaystackCheckoutModalProps> = ({
  request,
  tipAmount,
  onClose,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const [checkout, setCheckout] = useState<{ reference: string; authorizationUrl: string } | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(`checkout-${request.id}`) || 'null'); } catch { return null; }
  });
  const [error, setError] = useState('');

  const handlePaystackSuccess = async (reference: any) => {
    const verified = await store.verifyTipPayment(request.id, tipAmount, reference?.reference || reference);
    if (!verified) {
      setIsProcessing(false);
      setError('Payment is not confirmed yet. If you paid, wait a moment and check again.');
      return;
    }
    setIsProcessing(false);
    setPaymentSuccess(true);
    sessionStorage.removeItem(`checkout-${request.id}`);
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#C6A15B', '#2E8B7A', '#F5F2ED']
    });

    setTimeout(() => {
      onSuccess();
    }, 3000);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsProcessing(true);
    setError('');
    try {
      const result = await api('/api/payments/initialize', { requestId: request.id, amount: tipAmount, customerEmail: email.trim() });
      const next = { reference: result.reference, authorizationUrl: result.authorizationUrl };
      sessionStorage.setItem(`checkout-${request.id}`, JSON.stringify(next));
      setCheckout(next);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not start payment.'); }
    finally { setIsProcessing(false); }
  };


  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0E0E12] border border-[rgba(255,255,255,0.14)] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden relative">
        <div className="p-5 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#2E8B7A] flex items-center justify-center font-bold text-slate-950 text-xs">P</div>
            <div>
              <p className="text-[10px] text-[#8F8C88] uppercase tracking-wider">Secured via Paystack</p>
              <h3 className="font-['Syne'] font-bold text-xs text-[#F5F2ED]">VybeCheck secure checkout</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8F8C88] hover:text-[#F5F2ED]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p role="alert" className="px-5 pt-4 text-sm text-rose-300">{error}</p>}
        {checkout && !paymentSuccess ? (
          <div className="p-6 space-y-4 text-center">
            <p className="text-sm">Complete your payment securely with Paystack, then return here to confirm.</p>
            <a className="btn btn-primary btn-full" href={checkout.authorizationUrl} target="_blank" rel="noopener noreferrer">Open secure checkout</a>
            <button className="btn btn-full border border-white/20" disabled={isProcessing} onClick={() => { setIsProcessing(true); void handlePaystackSuccess(checkout.reference); }}>{isProcessing ? 'Checking payment…' : 'I have paid — check payment'}</button>
          </div>
        ) : paymentSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[rgba(46,139,122,0.15)] border border-[#2E8B7A] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-[#2E8B7A]" />
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#2E8B7A] font-semibold">PRIORITY VERIFIED</span>
            <h2 className="font-['Syne'] text-2xl font-bold text-[#F5F2ED]">₦{tipAmount.toLocaleString()} Confirmed!</h2>
            <p className="text-xs text-[#8F8C88]">"{request.song}" is now elevated to VIP priority in the DJ queue.</p>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(198,161,91,0.2)] rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#C6A15B] block mb-0.5">VIP Priority Tip</span>
                <span className="font-['Syne'] text-2xl font-bold text-[#E6D3A3]">₦{tipAmount.toLocaleString()}</span>
              </div>
              <Crown className="w-6 h-6 text-[#C6A15B]" />
            </div>

            <div className="text-xs text-[#8F8C88] truncate">
              Song: <strong className="text-[#F5F2ED]">{request.song}</strong> • {request.artist}
            </div>

            <form onSubmit={handlePay} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#8F8C88] block mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg p-3 text-xs text-[#F5F2ED]"
                  placeholder="Enter your email for the receipt"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3 rounded-lg font-bold text-sm bg-[#C6A15B] text-slate-950 hover:bg-[#E6D3A3] transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Connecting...' : `Pay ₦${tipAmount.toLocaleString()}`}
              </button>
            </form>

            <p className="text-[10px] text-center text-[#8F8C88] flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#2E8B7A]" />
              Paystack 256-bit AES encrypted
            </p>
          </div>
        )}
      </div>
    </div>
  );
};