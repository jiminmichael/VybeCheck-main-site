import React, { useState } from 'react';
import { trackingPageUrl } from '../../services/requestLinks';

export function TrackingActions({ token }: { token: string }) {
  const [notice, setNotice] = useState('');
  const url = trackingPageUrl(window.location.origin, token);
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice('Copied to clipboard.'); }
    catch { setNotice('Copy unavailable. Select the tracking code or link to copy it manually.'); }
  }
  async function share() {
    if (!navigator.share) { await copy(url); return; }
    try { await navigator.share({ title: 'Track my VybeCheck request', url }); }
    catch (error) { if ((error as DOMException).name !== 'AbortError') setNotice('Sharing unavailable. Use the tracking link below.'); }
  }
  return <div className="space-y-2 py-3 text-xs min-w-0">
    <p>Save this tracking code or link to check your request:</p>
    <code className="block break-all select-text text-[#E6D3A3]">{token}</code>
    <a className="block break-all text-[#4D7CFE] underline" href={url}>Track this request</a>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn btn-ghost text-xs" onClick={() => void copy(token)}>Copy tracking code</button>
      <button type="button" className="btn btn-ghost text-xs" onClick={() => void share()}>Share tracking link</button>
    </div>
    <p role="status">{notice}</p>
  </div>;
}
