export function requestPageUrl(origin: string, slug: string | undefined) {
  return slug ? `${origin}/#request/${encodeURIComponent(slug)}` : '';
}
export function trackingPageUrl(origin: string, token: string) {
  return `${origin}/#track/${encodeURIComponent(token)}`;
}

export function decodeLinkIdentifier(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}
