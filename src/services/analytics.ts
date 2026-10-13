const env = (import.meta as any).env || {};
const measurementId = env.VITE_GA_MEASUREMENT_ID || env.VITE_FIREBASE_MEASUREMENT_ID || 'G-BWX9MBN2W3';
let initialized = false;
let lastScreen = '';
function gtag(..._args: unknown[]) {
  const win = window as any;
  win.dataLayer ||= [];
  win.dataLayer.push(arguments);
}
function initialize() {
  if (initialized || typeof window === 'undefined' || !/^G-[A-Z0-9]+$/.test(measurementId)) return;
  initialized = true;
  gtag('js', new Date());
  gtag('config', measurementId, { send_page_view: false, page_location: `${window.location.origin}/`, page_referrer: '' });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
}
export function trackEvent(name: string, params: Record<string, string | number> = {}) {
  initialize();
  if (initialized) gtag('event', name, params);
}
export function trackScreen(screen: string) {
  if (screen === lastScreen) return;
  lastScreen = screen;
  // Never send tracking tokens, sign-in links, names, or bank details to analytics.
  trackEvent('page_view', { page_title: `VybeCheck — ${screen}`, page_location: `${window.location.origin}/#${screen}` });
}
export function trackPayment(reference: string, amount: number) {
  const key = `analytics-payment-${reference}`;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, 'sent'); } catch { /* Analytics must not block checkout. */ }
  trackEvent('purchase', { transaction_id: reference, value: amount, currency: 'NGN' });
}
