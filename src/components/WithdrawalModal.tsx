import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowRight, 
  Building2, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Zap, 
  ShieldCheck, 
  Wallet,
  Clock,
  Check
} from 'lucide-react';
import { store } from '../services/store';
import { DJProfile, BankItem, PayoutItem } from '../types';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (payout: PayoutItem) => void;
}

export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [currentDJ, setCurrentDJ] = useState<DJProfile>(store.getCurrentDJ());
  const [banks, setBanks] = useState<BankItem[]>([]);
  const [selectedBankCode, setSelectedBankCode] = useState<string>('058');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [isResolvingAccount, setIsResolvingAccount] = useState<boolean>(false);
  const [accountResolved, setAccountResolved] = useState<boolean>(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [amount, setAmount] = useState<number>(50000);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [completedPayout, setCompletedPayout] = useState<PayoutItem | null>(null);

  useEffect(() => {
    const dj = store.getCurrentDJ();
    setCurrentDJ(dj);
    if (dj) {
      setAccountNumber(dj.accountNumber || '0124892019');
      setAccountName(dj.accountName || dj.name);
      setSelectedBankCode(dj.bankCode || '058');
      if (dj.accountNumber && dj.accountNumber.length === 10) {
        setAccountResolved(true);
      }
    }

    store.getNigerianBanks().then((bankList) => {
      setBanks(bankList);
      if (bankList.length > 0 && !selectedBankCode) {
        setSelectedBankCode(bankList[0].code);
      }
    });
  }, [isOpen]);

  // Handle Account Auto-Resolution when 10 digits entered
  useEffect(() => {
    const clean = accountNumber.trim().replace(/\D/g, '');
    if (clean.length === 10 && selectedBankCode) {
      setIsResolvingAccount(true);
      setResolveError(null);
      store.resolveBankAccount(clean, selectedBankCode).then((res) => {
        setIsResolvingAccount(false);
        if (res.success && res.accountName) {
          setAccountName(res.accountName);
          setAccountResolved(true);
        } else {
          setResolveError(res.error || 'Unable to resolve account name');
          setAccountResolved(false);
        }
      });
    } else {
      setAccountResolved(false);
    }
  }, [accountNumber, selectedBankCode]);

  if (!isOpen) return null;

  const availableBalance = currentDJ?.availableBalance || 0;
  const transferFee = 25;
  const netAmount = Math.max(0, amount - transferFee);
  const selectedBankObj = banks.find((b) => b.code === selectedBankCode);

  const presetAmounts = [10000, 25000, 50000, 100000].filter((p) => p <= availableBalance);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (amount < 1000) {
      setError('Minimum instant withdrawal amount is ₦1,000');
      return;
    }

    if (amount > availableBalance) {
      setError(`Requested amount exceeds your available balance of ₦${availableBalance.toLocaleString()}`);
      return;
    }

    if (!accountNumber || accountNumber.trim().length !== 10) {
      setError('Please provide a valid 10-digit Nigerian NUBAN account number');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await store.requestInstantWithdrawal(amount, {
        bankName: selectedBankObj?.name || currentDJ.bankName || 'Guaranty Trust Bank (GTBank)',
        accountNumber: accountNumber.trim(),
        accountName: accountName || currentDJ.name,
        bankCode: selectedBankCode,
      });

      setIsSubmitting(false);
      if (res.success && res.payout) {
        setCompletedPayout(res.payout);
        if (onSuccess) onSuccess(res.payout);
      } else {
        setError(res.error || 'Failed to process instant withdrawal');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || 'An unexpected error occurred during withdrawal.');
    }
  };

  const handleClose = () => {
    setCompletedPayout(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0E0E12] border border-[rgba(255,255,255,0.12)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(255,255,255,0.08)] bg-gradient-to-r from-[rgba(198,161,91,0.12)] via-transparent to-[rgba(91,63,209,0.12)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C6A15B]/20 border border-[#C6A15B]/40 flex items-center justify-center text-[#E6D3A3]">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-['Syne'] text-base font-bold text-[#F5F2ED]">
                Instant DJ Payout
              </h2>
              <p className="text-[11px] uppercase tracking-wider text-[#8F8C88]">
                Real-Time Bank Settlement (NIBSS)
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.1)] text-[#8F8C88] hover:text-[#F5F2ED] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {completedPayout ? (
          /* SUCCESS RECEIPT */
          <div className="p-6 sm:p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-[#2E8B7A]/20 border border-[#2E8B7A]/40 flex items-center justify-center mx-auto text-[#2E8B7A]">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#2E8B7A] font-semibold block">
                TRANSFER SUCCESSFUL
              </span>
              <h3 className="font-['Syne'] text-2xl font-bold text-[#F5F2ED]">
                ₦{completedPayout.netAmount.toLocaleString()}
              </h3>
              <p className="text-xs text-[#8F8C88]">
                Dispatched to {completedPayout.bankName} ({completedPayout.accountNumber})
              </p>
            </div>

            <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 text-left text-xs space-y-2.5 font-mono">
              <div className="flex justify-between">
                <span className="text-[#8F8C88]">Transaction Ref</span>
                <span className="text-[#E6D3A3] font-semibold">{completedPayout.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8F8C88]">Recipient Name</span>
                <span className="text-[#F5F2ED]">{completedPayout.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8F8C88]">Transfer Fee</span>
                <span className="text-[#8F8C88]">₦{completedPayout.fee || 25}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8F8C88]">Timestamp</span>
                <span className="text-[#8F8C88]">{new Date(completedPayout.createdAt).toLocaleTimeString()}</span>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-3 rounded-xl bg-[#C6A15B] hover:bg-[#D4B36E] text-[#070708] font-bold text-xs uppercase tracking-wider transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          /* WITHDRAWAL FORM */
          <form onSubmit={handleWithdraw} className="p-6 space-y-5">
            {/* Balance Overview Card */}
            <div className="bg-gradient-to-r from-[#070708] to-[#14141C] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#8F8C88] block">
                  Available Wallet Balance
                </span>
                <span className="font-['Syne'] text-xl sm:text-2xl font-bold text-[#E6D3A3]">
                  ₦{availableBalance.toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAmount(availableBalance)}
                className="text-[11px] font-semibold text-[#C6A15B] hover:text-[#E6D3A3] bg-[#C6A15B]/10 hover:bg-[#C6A15B]/20 border border-[#C6A15B]/30 px-2.5 py-1 rounded-lg transition-colors"
              >
                Withdraw Max
              </button>
            </div>

            {error && (
              <div className="p-3 bg-[#8B3A3A]/20 border border-[#8B3A3A]/40 rounded-xl text-xs text-[#F5F2ED] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#8B3A3A] flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Amount Field */}
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-1.5 font-medium">
                Withdrawal Amount (₦)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#E6D3A3]">
                  ₦
                </span>
                <input
                  type="number"
                  min="1000"
                  max={availableBalance}
                  step="500"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="Enter amount"
                  className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] focus:border-[#C6A15B] rounded-xl py-2.5 pl-8 pr-3 text-sm text-[#F5F2ED] font-['Syne'] font-bold outline-none"
                  required
                />
              </div>

              {/* Quick Amount Pills */}
              {presetAmounts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {presetAmounts.map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => setAmount(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                        amount === preset
                          ? 'bg-[#C6A15B]/20 border-[#C6A15B] text-[#E6D3A3] font-semibold'
                          : 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] text-[#8F8C88] hover:text-[#F5F2ED]'
                      }`}
                    >
                      ₦{preset.toLocaleString()}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bank Selection */}
            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-1.5 font-medium">
                  Destination Bank
                </label>
                <select
                  value={selectedBankCode}
                  onChange={(e) => setSelectedBankCode(e.target.value)}
                  className="w-full bg-[#0E0E12] border border-[rgba(255,255,255,0.1)] focus:border-[#C6A15B] rounded-xl py-2.5 px-3 text-xs text-[#F5F2ED] outline-none"
                >
                  {banks.map((bank) => (
                    <option key={bank.code} value={bank.code}>
                      {bank.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-1.5 font-medium">
                    10-Digit NUBAN Number
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="0124892019"
                    className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] focus:border-[#C6A15B] rounded-xl py-2 px-3 text-xs text-[#F5F2ED] font-mono outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8F8C88] block mb-1.5 font-medium flex items-center justify-between">
                    <span>Account Name</span>
                    {isResolvingAccount && <Loader2 className="w-3 h-3 text-[#C6A15B] animate-spin" />}
                    {accountResolved && <Check className="w-3 h-3 text-[#2E8B7A]" />}
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Verified Holder Name"
                    className={`w-full bg-[rgba(255,255,255,0.04)] border rounded-xl py-2 px-3 text-xs text-[#F5F2ED] outline-none ${
                      accountResolved ? 'border-[#2E8B7A]/50 bg-[#2E8B7A]/5' : 'border-[rgba(255,255,255,0.1)]'
                    }`}
                    required
                  />
                </div>
              </div>

              {resolveError && (
                <p className="text-[11px] text-[#C6A15B] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{resolveError}</span>
                </p>
              )}
            </div>

            {/* Settlement Summary */}
            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between text-[#8F8C88]">
                <span>Transfer Fee (NIBSS Instant)</span>
                <span>₦{transferFee}</span>
              </div>
              <div className="flex justify-between text-[#F5F2ED] font-semibold pt-1 border-t border-[rgba(255,255,255,0.06)]">
                <span>Net Instant Settlement</span>
                <span className="text-[#E6D3A3] font-['Syne'] font-bold">
                  ₦{netAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || availableBalance < 1000 || amount <= 0}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C6A15B] to-[#E6D3A3] text-[#070708] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#C6A15B]/10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#070708]" />
                  <span>Processing Instant Settlement...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-[#070708]" />
                  <span>Withdraw ₦{amount.toLocaleString()} Now</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
