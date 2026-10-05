import { Capacitor, registerPlugin } from '@capacitor/core';
import { API_HOST } from '../config/api.config';

interface NativeSettingsPlugin {
  copyText(options: { text: string }): Promise<void>;
  shareLink(options: { url: string; title: string; text: string }): Promise<void>;
  shareQr(options: { base64: string }): Promise<void>;
  openExternal(options: { url: string }): Promise<void>;
}
const NativeSettings = registerPlugin<NativeSettingsPlugin>('LinkUpSettings');
const android = () => Capacitor.getPlatform() === 'android';
const safeId = /^[A-Za-z0-9_-]{1,80}$/;
export const PENDING_INVITE_KEY = 'linkup_pending_profile_invite';

export function profileInviteUrl(publicId: string) {
  if (!safeId.test(publicId)) throw new Error('Your profile link is unavailable.');
  // The API host serves the public landing page; never share capacitor://localhost.
  const host = new URL(API_HOST);
  if (!['https:', 'http:'].includes(host.protocol)) throw new Error('Your profile link is unavailable.');
  return `${API_HOST.replace(/\/$/, '')}/invite/${encodeURIComponent(publicId)}`;
}

export function parseProfileInvite(value: string): string | null {
  try {
    const url = new URL(value);
    let id: string | null = null;
    if (url.protocol === 'linkup:' && url.hostname === 'profile') id = decodeURIComponent(url.pathname.slice(1));
    else if (url.origin === new URL(API_HOST).origin) id = /^\/invite\/([^/]+)$/.exec(url.pathname)?.[1] ?? null;
    else if (url.origin === window.location.origin) id = url.searchParams.get('invite');
    return id && safeId.test(id) ? id : null;
  } catch { return null; }
}

export async function copyProfileLink(link: string) {
  if (android()) return NativeSettings.copyText({ text: link });
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(link);
  const field = document.createElement('textarea');
  field.value = link; field.setAttribute('readonly', ''); field.style.position = 'fixed'; field.style.opacity = '0';
  document.body.appendChild(field); field.select();
  try { if (!document.execCommand('copy')) throw new Error('Copy is unavailable. Select and copy the link below.'); }
  finally { field.remove(); }
}

export async function shareProfileLink(url: string, username: string): Promise<'shared' | 'copied'> {
  const data = { title: 'Connect on LinkUp', text: `Connect with @${username} on LinkUp.`, url };
  if (android()) { await NativeSettings.shareLink(data); return 'shared'; }
  if (navigator.share) { await navigator.share(data); return 'shared'; }
  await copyProfileLink(url); return 'copied';
}

export async function shareQrCode(svg: SVGSVGElement): Promise<'shared' | 'downloaded'> {
  const source = new XMLSerializer().serializeToString(svg);
  const image = new Image();
  const objectUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Unable to prepare QR code.')); image.src = objectUrl; });
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 650;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Unable to prepare QR code.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, 650, 650); context.drawImage(image, 0, 0, 650, 650);
    const data = canvas.toDataURL('image/png');
    if (android()) { await NativeSettings.shareQr({ base64: data.split(',')[1] }); return 'shared'; }
    const link = document.createElement('a'); link.download = 'linkup-profile-qr.png'; link.href = data;
    document.body.appendChild(link); link.click(); link.remove(); return 'downloaded';
  } finally { URL.revokeObjectURL(objectUrl); }
}

export async function openSettingsLink(url: string) {
  const target = new URL(url);
  if (!['https:', 'mailto:'].includes(target.protocol)) throw new Error('This link is unavailable.');
  if (android()) return NativeSettings.openExternal({ url });
  if (target.protocol === 'mailto:') window.location.href = url;
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export function wasShareCancelled(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}
