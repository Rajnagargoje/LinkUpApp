import { useMemo, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { copyOutline, personCircleOutline, qrCodeOutline, shareSocialOutline } from 'ionicons/icons';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { copyProfileLink, profileInviteUrl, shareProfileLink, shareQrCode, wasShareCancelled } from '../../../service/inviteService';
import { createProfileQr } from '../../../utils/profileQr';
import { SettingsLayout } from './SettingsLayout';

export default function InviteFriendsPage() {
  const { user } = useAuth(); const qr = useRef<SVGSVGElement>(null); const [busy, setBusy] = useState(false);
  const value = useMemo(() => {
    let url = '';
    try { url = profileInviteUrl(user?.publicId ?? ''); return { url, qr: createProfileQr(url), error: '' }; }
    catch (failure) { return { url, qr: null, error: (failure as Error).message }; }
  }, [user?.publicId]);
  const act = async (action: 'copy' | 'share' | 'qr') => {
    if (busy || !value.url) return; setBusy(true);
    try {
      if (action === 'copy') { await copyProfileLink(value.url); toast.success('Profile link copied'); }
      else if (action === 'share') { if (await shareProfileLink(value.url, user?.username ?? '') === 'copied') toast.success('Link copied. Paste it into your chat.'); }
      else if (qr.current) { if (await shareQrCode(qr.current) === 'downloaded') toast.success('QR download started'); }
    } catch (failure) { if (!wasShareCancelled(failure)) toast.error((failure as Error).message || 'Could not share right now. Please try again.'); }
    finally { setBusy(false); }
  };
  const size = (value.qr?.modules.length ?? 0) + 8;
  const path = value.qr?.modules.flatMap((row, y) => row.map((dark, x) => dark ? `M${x + 4},${y + 4}h1v1h-1z` : '')).join('') ?? '';
  return <SettingsLayout title="Invite friends">
    <div className="settings-intro"><span className="settings-eyebrow">BETTER WITH YOUR PEOPLE</span><h1>A little hello goes a long way.</h1><p>Let a friend scan your code or send them your profile link.</p></div>
    <section className="invite-card">
      <div className="invite-avatar">{user?.profilePhoto ? <img src={user.profilePhoto} alt="" /> : <IonIcon icon={personCircleOutline} />}</div>
      <h2>@{user?.username}</h2><p>Find me on LinkUp</p>
      {value.qr ? <div className="invite-qr"><svg ref={qr} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${size} ${size}`} width="260" height="260" role="img" aria-label={`QR code for ${user?.username}'s profile`} shapeRendering="crispEdges"><rect width={size} height={size} fill="#fff" /><path d={path} fill="#101020" /></svg></div> : <p role="alert">{value.error}</p>}
      <small>Scan with your phone camera</small>
    </section>
    <div className="invite-actions">
      <button className="settings-primary" disabled={busy || !value.url} onClick={() => void act('share')}><IonIcon icon={shareSocialOutline} />Share profile</button>
      <button className="settings-outline" disabled={busy || !value.url} onClick={() => void act('copy')}><IonIcon icon={copyOutline} />Copy profile link</button>
      <button className="settings-outline" disabled={busy || !value.qr} onClick={() => void act('qr')}><IonIcon icon={qrCodeOutline} />Share / save QR code</button>
    </div>
    {value.url && <p className="invite-url">{value.url}</p>}
    <p className="settings-footnote">Your link can be forwarded. It shares your username and opens your profile; it never includes your email or login details.</p>
  </SettingsLayout>;
}
