export interface SavedCheckout { reference: string; authorizationUrl: string; amount?: number }
export function parseSavedCheckout(value: string | null): SavedCheckout | null {
  try {
    const parsed = JSON.parse(value || 'null');
    if (!parsed || typeof parsed.reference !== 'string' || !parsed.reference || typeof parsed.authorizationUrl !== 'string') return null;
    const url = new URL(parsed.authorizationUrl);
    if (url.protocol !== 'https:' || !(url.hostname === 'paystack.com' || url.hostname.endsWith('.paystack.com'))) return null;
    return { reference: parsed.reference, authorizationUrl: url.href,
      ...(typeof parsed.amount === 'number' && Number.isFinite(parsed.amount) && parsed.amount > 0 ? { amount: parsed.amount } : {}) };
  } catch { return null; }
}
