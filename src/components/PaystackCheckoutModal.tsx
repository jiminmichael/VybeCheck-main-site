import React, { useState } from 'react';
import { usePaystackPayment } from 'react-paystack';
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

  const config = {
    reference: `PAY_VYBE_${new Date().getTime().toString()}`,
    email: email,
    amount: tipAmount * 100, 
    // Updated for Vite compatibility
    publicKey: (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_YOUR_KEY_HERE',
    metadata: {
      custom_fields: [
        { display_name: "Song", variable_name: "song", value: request.song },
        { display_name: "Event ID", variable_name: "event_id", value: request.eventId }
      ]
    }
  };

  const initializePayment = usePaystackPayment(config);

  const handlePaystackSuccess = async (reference: any) => {
    const verified = await store.verifyTipPayment(request.id, tipAmount, reference?.reference || reference);
    if (!verified) {
      setIsProcessing(false);
      window.alert('Payment could not be verified. Please contact support before trying again.');
      return;
    }
    setIsProcessing(false);
    setPaymentSuccess(true);
    
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

  const handlePaystackClose = () => {
    setIsProcessing(false);
  };

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsProcessing(true);
    
    initializePayment({ onSuccess: handlePaystackSuccess, onClose: handlePaystackClose });
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

        {paymentSuccess ? (
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