import { useState } from 'react';
import { IonAlert, IonIcon } from '@ionic/react';
import { useHistory } from 'react-router';
import { checkmarkCircle, logOutOutline, mailOutline, personOutline, trashOutline } from 'ionicons/icons';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { settingsError } from '../../../service/settingsService';
import { SettingsLayout, SettingsLink } from './SettingsLayout';

export default function AccountSettingsPage() {
  const { user, logout, deleteAccount } = useAuth(); const history = useHistory();
  const [confirmLogout, setConfirmLogout] = useState(false); const [deleting, setDeleting] = useState(false); const [confirmation, setConfirmation] = useState('');
  const remove = async () => {
    if (confirmation !== 'DELETE' || deleting) return;
    setDeleting(true);
    try { await deleteAccount(); toast.success('Account deleted'); history.replace('/'); }
    catch (error) { toast.error(settingsError(error, 'Unable to delete your account. Please try again.')); }
    finally { setDeleting(false); }
  };
  return <SettingsLayout title="Account">
    <div className="settings-intro"><h1>Your account, in one place.</h1><p>Manage your profile, verification and sign-in session.</p></div>
    <section className="settings-card account-details"><div><span>Username</span><strong>@{user?.username}</strong></div><div><span>Email</span><strong>{user?.email}</strong></div><div><span>Verification</span><strong className={user?.emailVerified ? 'settings-verified' : ''}>{user?.emailVerified ? <><IonIcon icon={checkmarkCircle} />Email verified</> : 'Not verified yet'}</strong></div></section>
    <section className="settings-card"><SettingsLink icon={personOutline} title="My profile" description="View and manage your profile" to="/app/account" />{!user?.emailVerified && <SettingsLink icon={mailOutline} title="Verify email" description="Confirm the email on your account" to="/verify-email" />}<SettingsLink icon={logOutOutline} title="Log out" description="Sign out on this device" onClick={() => setConfirmLogout(true)} /></section>
    <details className="settings-delete"><summary><IonIcon icon={trashOutline} />Delete account</summary><p>Your account will be disabled and identifying profile fields anonymized. Existing conversation content and safety records may remain. This action cannot be undone.</p><button className="settings-text-button" onClick={() => history.push('/app/me/settings/deletion')}>Read about account & data deletion</button><label htmlFor="delete-confirmation">Type DELETE to confirm</label><input id="delete-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} disabled={deleting} /><button className="settings-destructive" disabled={confirmation !== 'DELETE' || deleting} onClick={() => void remove()}>{deleting ? 'Deleting…' : 'Permanently delete account'}</button></details>
    <IonAlert isOpen={confirmLogout} onDidDismiss={() => setConfirmLogout(false)} header="Log out?" message="You can sign in again at any time." buttons={[{ text: 'Cancel', role: 'cancel' }, { text: 'Log out', role: 'destructive', handler: () => { logout(); history.replace('/'); } }]} />
  </SettingsLayout>;
}
