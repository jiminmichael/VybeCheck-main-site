const key = 'vybecheck_tracking_token';
export function savedTrackingToken() {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}
export function saveTrackingToken(token: string) {
  try { localStorage.setItem(key, token); } catch { /* Tracking links still work without storage. */ }
}
