import { HttpError } from './domain';

export function decodeAudioDataUrl(value: unknown) {
  if (typeof value !== 'string') throw new HttpError(400, 'Upload a valid audio recording.');
  const match = /^data:(audio\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/]*={0,2})$/i.exec(value);
  if (!match) throw new HttpError(400, 'Upload a valid base64 audio recording.');
  const mimeType = match[1].toLowerCase();
  const extensions: Record<string, string> = { 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/aac': 'aac', 'audio/flac': 'flac' };
  if (!extensions[mimeType]) throw new HttpError(400, 'Choose a WebM, MP4, MP3, Ogg, WAV, AAC, or FLAC recording.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 15 * 1024 * 1024 || buffer.toString('base64').replace(/=+$/, '') !== match[2].replace(/=+$/, '')) throw new HttpError(400, 'Audio must be valid and smaller than 15 MB.');
  return { buffer, mimeType, filename: `sample.${extensions[mimeType]}` };
}
