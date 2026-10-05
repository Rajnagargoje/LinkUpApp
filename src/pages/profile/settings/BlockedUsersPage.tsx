import { useCallback, useEffect, useState } from 'react';
import { IonAlert, IonIcon, IonSpinner } from '@ionic/react';
import { banOutline, personCircleOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { getBlockedUsers, unblockUser, BlockedUser, settingsError } from '../../../service/settingsService';
import { notifyChatListChanged } from '../../../utils/chatPresentation';
import { SettingsError, SettingsLayout, SettingsLoading } from './SettingsLayout';

export default function BlockedUsersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<BlockedUser[]>([]); const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true); const [loadingMore, setLoadingMore] = useState(false); const [error, setError] = useState('');
  const [selected, setSelected] = useState<BlockedUser | null>(null); const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(async (page = 0) => {
    if (page === 0) setLoading(true); else setLoadingMore(true); setError('');
    try { const result = await getBlockedUsers(page); setItems(old => page === 0 ? result.items : [...old, ...result.items.filter(item => !old.some(existing => existing.id === item.id))]); setNextPage(result.nextPage); }
    catch (failure) { setError(settingsError(failure, 'Could not load your blocked users.')); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [user?.publicId]);
  useEffect(() => { void load(); }, [load]);
  const confirm = async (target: BlockedUser) => {
    if (busy !== null) return;
    setBusy(target.id); setSelected(null);
    try { await unblockUser(target.id); toast.success('User unblocked'); notifyChatListChanged(); await load(); }
    catch (failure) { toast.error(settingsError(failure, 'Could not unblock this user. Please try again.')); }
    finally { setBusy(null); }
  };
  return <SettingsLayout title="Blocked users">
    <div className="settings-intro"><span className="settings-eyebrow">YOUR BOUNDARIES</span><h1>A space you control.</h1><p>People you block cannot contact you through LinkUp.</p></div>
    {loading ? <SettingsLoading text="Loading blocked users…" /> : error && items.length === 0 ? <SettingsError text={error} retry={() => void load()} /> : items.length === 0 ? <div className="settings-empty"><IonIcon icon={shieldCheckmarkOutline} /><h2>No blocked users</h2><p>Anyone you block from a chat will appear here.</p></div> : <section className="settings-card blocked-users-list">
      {items.map(item => <div className="blocked-user" key={item.id}>
        {item.profilePhoto ? <img src={item.profilePhoto} alt="" loading="lazy" /> : <IonIcon className="blocked-avatar" icon={personCircleOutline} />}
        <div><strong>{item.username}</strong><small><IonIcon icon={banOutline} />Blocked</small></div>
        <button className="settings-outline compact" disabled={busy !== null} onClick={() => setSelected(item)} aria-label={`Unblock ${item.username}`}>{busy === item.id ? <IonSpinner /> : 'Unblock'}</button>
      </div>)}
    </section>}
    {!loading && nextPage !== null && <button className="settings-outline settings-full" disabled={loadingMore} onClick={() => void load(nextPage)}>{loadingMore ? 'Loading…' : 'Load more'}</button>}
    {error && items.length > 0 && <p className="settings-status" role="alert">{error}</p>}
    <p className="settings-footnote">Unblocking allows contact again when your other privacy settings permit it. It does not restore a friendship or remove a report. A block made by the other person remains in place.</p>
    <IonAlert isOpen={!!selected} onDidDismiss={() => setSelected(null)} header={selected ? `Unblock ${selected.username}?` : 'Unblock user'} message="They may be able to find and contact you again. You can block them again at any time." buttons={[{ text: 'Cancel', role: 'cancel' }, { text: 'Unblock', handler: () => { if (selected) void confirm(selected); } }]} />
  </SettingsLayout>;
}
