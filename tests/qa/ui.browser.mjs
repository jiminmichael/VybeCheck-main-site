import { createRequire } from 'node:module';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const browserRequire = process.env.QA_BROWSER_TOOLS_DIR ? createRequire(path.join(process.env.QA_BROWSER_TOOLS_DIR, 'package.json')) : require;
const { chromium } = browserRequire('playwright');
const decodeQR = browserRequire('jsqr');
const { default: AxeBuilder } = browserRequire('@axe-core/playwright');
const { build } = require('esbuild');
const { build: viteBuild } = await import('vite');
const tmp = await mkdtemp(path.join(os.tmpdir(), 'vybecheck-ui-'));
let browser, server;
const token = '550e8400-e29b-41d4-a716-446655440000';
const request = { id: 'qa-request', djId: 'qa-dj', eventId: 'qa-event', song: 'Water', artist: 'Tyla', genre: 'Amapiano', requesterName: 'QA Guest', status: 'pending', tipAmount: 0, priority: false, trackingToken: token, createdAt: '', updatedAt: '' };
const tracks = [{ id: 'water', song: 'Water', artist: 'Tyla', genre: 'Amapiano' }, { id: 'city', song: 'City Boys', artist: 'Burna Boy', genre: 'Afrobeats' }];
let searchMode = 'success';
let audioUploads = 0;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  await viteBuild({ build: { outDir: path.join(tmp, 'styles'), emptyOutDir: true }, logLevel: 'error' });
  const assets = await readdir(path.join(tmp, 'styles/assets'));
  const css = await readFile(path.join(tmp, 'styles/assets', assets.find(name => name.endsWith('.css'))));
  await writeFile(path.join(tmp, 'style.css'), css);
  await build({ entryPoints: ['tests/qa/fixture.tsx'], bundle: true, format: 'esm', platform: 'browser', outfile: path.join(tmp, 'fixture.js'), define: { 'import.meta.env': '{}' }, plugins: [{ name: 'isolated-qa-backend', setup(build) {
    build.onResolve({ filter: /\/services\/(store|firebase)$|^\.\/firebase$/ }, () => ({ path: path.resolve('tests/qa/fixtures.ts') }));
  }}] });
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (url.pathname === '/api/music/search') {
      const q = url.searchParams.get('q');
      await pause(q === 'slow' ? 700 : 180);
      return json(searchMode === 'failure' ? 503 : 200, searchMode === 'failure' ? { error: 'unavailable' } : { results: q === 'slow' ? [{ id: 'slow', song: 'Old response', artist: 'Old artist' }] : searchMode === 'empty' ? [] : tracks });
    }
    if (url.pathname.startsWith('/qa/track/')) {
      await pause(600);
      return json(url.pathname.endsWith('missing') ? 404 : url.pathname.endsWith('failure') ? 503 : 200, request);
    }
    if (url.pathname === '/api/music/identify') { audioUploads++; return json(200, { success: true, track: { song: 'Water', artist: 'Tyla', genre: 'Amapiano', confidence: 95 } }); }
    if (url.pathname === '/fixture.js' || url.pathname === '/style.css') {
      res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css');
      return res.end(await readFile(path.join(tmp, url.pathname.slice(1))));
    }
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>VybeCheck UI regression fixture</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.QA_CHROME_PATH ? { executablePath: process.env.QA_CHROME_PATH } : {}) });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://itunes.apple.com/**', route => route.fulfill({ status: 503, body: '{}' }));
    await page.route('https://images.unsplash.com/**', route => route.abort());
    async function axe() {
      const result = await new AxeBuilder({ page }).withRules(['button-name', 'label', 'aria-valid-attr-value', 'aria-required-attr', 'aria-dialog-name', 'aria-allowed-role', 'aria-required-children', 'aria-required-parent', 'duplicate-id-aria', 'label-content-name-mismatch']).analyze();
      assert.deepEqual(result.violations.map(v => ({ rule: v.id, elements: v.nodes.map(n => n.html) })), []);
    }
    async function noOverflow() {
      const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, elements: Array.from(document.querySelectorAll('body *')).filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(el => ({ tag: el.tagName, text: el.textContent?.slice(0, 60), className: el.className })) }));
      assert.equal(overflow.scroll <= viewport.width, true, `Horizontal viewport overflow: ${JSON.stringify(overflow)}`);
    }
    await page.goto(origin);
    await page.getByRole('button', { name: 'Send Request', exact: true }).click();
    await page.getByRole('alert').waitFor();
    const song = page.getByRole('combobox', { name: 'WHAT DO YOU WANT TO HEAR?' });
    await song.fill('wa');
    await page.getByRole('listbox').waitFor();
    assert.equal(await page.getByRole('alert').count(), 0, 'Corrected song validation error remains');
    await song.press('ArrowUp');
    assert.equal(await song.getAttribute('aria-activedescendant'), 'song-option-1');
    await song.press('ArrowDown');
    assert.equal(await song.getAttribute('aria-activedescendant'), 'song-option-0');
    await song.press('Escape');
    assert.equal(await page.getByRole('listbox').count(), 0);
    await song.press('ArrowDown');
    await song.press('Enter');
    assert.equal(await song.inputValue(), 'Water');
    assert.equal(await page.getByLabel('ARTIST NAME').inputValue(), 'Tyla');
    await axe(); await noOverflow();
    await page.getByRole('button', { name: 'Send Request', exact: true }).click();
    await page.getByRole('button', { name: 'Copy tracking code' }).waitFor();
    await page.getByRole('button', { name: 'Copy tracking code' }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), token);
    await page.goto(origin);
    searchMode = 'empty';
    await song.fill('empty');
    await page.getByText('No songs found. Enter the song title and artist manually.').waitFor();
    searchMode = 'failure';
    await song.fill('failure');
    await page.getByText('Search is unavailable. Enter the song title and artist manually.').waitFor();
    searchMode = 'success';
    await song.fill('slow'); await pause(260); await song.fill('fast');
    await page.getByRole('option', { name: /Water/ }).waitFor(); await pause(750);
    assert.equal(await page.getByText('Old response').count(), 0, 'Stale catalog response overwrote latest query');
    // Live QR is public, and its target is the selected session, never a placeholder.
    await page.goto(`${origin}/?view=live`);
    const qr = page.getByRole('img', { name: 'Scan to request a song for QA Live Session' });
    await qr.waitFor(); assert.match(await qr.getAttribute('src'), /^data:image\/png;base64,/);
    const pixels = await qr.evaluate(async img => {
      await img.decode(); const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
      return { width: canvas.width, height: canvas.height, data: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data) };
    });
    assert.equal(decodeQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height)?.data, `${origin}/#request/qa-live-session`, 'QR does not decode to the active session');
    assert.equal(await page.getByRole('link', { name: 'Request a song for QA Live Session' }).getAttribute('href'), `${origin}/#request/qa-live-session`);
    await axe(); await noOverflow();
    const liveQrTrigger = page.getByRole('button', { name: 'Open Venue QR for the active session' });
    await liveQrTrigger.click(); await page.getByRole('dialog', { name: 'Live session request QR code' }).waitFor();
    await axe(); await page.keyboard.press('Escape');
    assert.equal(await liveQrTrigger.evaluate(el => el === document.activeElement), true);
    // Loading, confirmed 404 and network failure are distinct.
    await page.goto(`${origin}/?view=tracking&token=${token}`);
    await page.getByRole('status').filter({ hasText: 'Looking up' }).waitFor();
    assert.equal(await page.getByText('Request not found', { exact: true }).count(), 0);
    await page.getByRole('heading', { name: 'Water', exact: true }).waitFor(); await axe();
    await page.goto(`${origin}/?view=tracking&token=missing`);
    await page.getByText('Request not found', { exact: true }).waitFor();
    await page.goto(`${origin}/?view=tracking&token=failure`);
    await page.getByText('Tracking temporarily unavailable').waitFor();
    assert.equal(await page.getByText('Request not found', { exact: true }).count(), 0);
    // Every standalone modal traps focus, dismisses with Escape, and restores the trigger.
    await page.goto(origin);
    for (const name of ['event', 'auth', 'image', 'personal', 'withdrawal', 'checkout']) {
      const trigger = page.getByRole('button', { name: `Open ${name}`, exact: true });
      await trigger.click(); await page.getByRole('dialog').waitFor();
      assert.equal(await page.evaluate(() => !!document.activeElement.closest('dialog')), true);
      for (let i = 0; i < 18; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.tagName === 'BODY' || !!document.activeElement.closest('dialog')), true); }
      await page.keyboard.press('Shift+Tab'); await axe(); await noOverflow();
      await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true, `Focus not restored for ${name}`);
    }
    // Nested image picker restores focus to its trigger inside the auth dialog.
    await page.getByRole('button', { name: 'Open auth', exact: true }).click();
    await page.getByRole('button', { name: 'Add profile photo' }).click();
    assert.equal(await page.getByRole('dialog').count(), 2);
    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Add profile photo' }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    // Microphone failure has a functional file-upload alternative using the actual recognition API client.
    await page.getByRole('button', { name: 'Audio Identify: recognize a song using microphone or upload' }).click();
    await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
    await page.getByRole('button', { name: 'Tap Listen' }).click();
    await page.getByRole('alert').filter({ hasText: 'Microphone access unavailable' }).waitFor();
    await page.getByLabel('Upload an audio sample').setInputFiles({ name: 'sample.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('qa audio bytes') });
    await page.getByRole('dialog').getByRole('heading', { name: 'Water', exact: true }).waitFor();
    assert.ok(audioUploads > 0); await axe(); await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Audio Identify: recognize a song using microphone or upload' }).evaluate(el => el === document.activeElement), true);
    // Persisted sound setting survives a reload.
    await page.getByRole('button', { name: 'Mute sound alerts', exact: true }).click();
    await page.reload(); await page.getByRole('button', { name: 'Enable sound alerts', exact: true }).waitFor();
    await page.goto(`${origin}/?view=dashboard`); await axe(); await noOverflow();
    const reject = page.getByRole('button', { name: 'Decline Water request' });
    await reject.click(); await page.getByRole('dialog', { name: 'Decline song request' }).waitFor();
    await page.keyboard.press('Escape'); assert.equal(await reject.evaluate(el => el === document.activeElement), true);
    await page.goto(`${origin}/?view=profile`); await axe(); await noOverflow();
    const projector = page.getByRole('button', { name: 'Projector', exact: true });
    await projector.click(); await page.getByRole('dialog', { name: 'DJ request projector' }).waitFor();
    await page.keyboard.press('Escape'); assert.equal(await projector.evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: 'Open personal', exact: true }).click();
    const launch = page.getByRole('button', { name: 'Launch Club Screen Projector' });
    await launch.click(); await page.getByRole('dialog', { name: 'DJ QR projector' }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 2);
    await page.keyboard.press('Escape'); assert.equal(await launch.evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS: ${viewport.width}px keyboard, dialogs, labels, search states, tracking, upload, QR and sound preference (mock services).`);
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(tmp, { recursive: true, force: true });
}
