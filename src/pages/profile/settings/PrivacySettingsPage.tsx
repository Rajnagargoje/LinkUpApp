import { useEffect, useRef, useState } from 'react';
import { IonIcon, IonToggle } from '@ionic/react';
import { eyeOutline, locationOutline, chatbubbleEllipsesOutline, shieldCheckmarkOutline, banOutline, documentTextOutline } from 'ionicons/icons';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { getPrivacySettings, savePrivacySettings, PrivacySettings, settingsError } from '../../../service/settingsService';
import { SettingsError, SettingsLayout, SettingsLink, SettingsLoading } from './SettingsLayout';

const controls: { key: keyof PrivacySettings; label: string; description: string; icon: string }[] = [
  { key: 'discoverable', label: 'Appear in People & Nearby', description: 'Let people discover your profile. Turning this off keeps your existing friendships.', icon: locationOutline },
  { key: 'activityVisible', label: 'Online & last seen', description: 'Let others see when you are online and when you were last active.', icon: eyeOutline },
  { key: 'messageRequestsEnabled', label: 'Messages from non-friends', description: 'Allow introduction messages before becoming friends. Friends can always message you.', icon: chatbubbleEllipsesOutline },
];
export default function PrivacySettingsPage() {
  const { user } = useAuth();
  const [value, setValue] = useState<PrivacySettings | null>(null);
  const [error, setError] = useState(''); const [retry, setRetry] = useState(0); const [saving, setSaving] = useState(false);
  const requestInFlight = useRef(false);
  useEffect(() => {
    let active = true; setValue(null); setError('');
    void getPrivacySettings().then(data => { if (active) setValue(data); }).catch(() => { if (active) setError('Unable to load privacy settings.'); });
    return () => { active = false; };
  }, [user?.publicId, retry]);
  const save = async (key: keyof PrivacySettings, checked: boolean, toggle: HTMLIonToggleElement) => {
    if (!value) return;
    if (requestInFlight.current || value[key] === checked) { toggle.checked = value[key]; return; }
    requestInFlight.current = true;
    const previous = value; setValue({ ...value, [key]: checked }); setSaving(true);
    try {
      const confirmed = await savePrivacySettings({ ...value, [key]: checked }); setValue(confirmed);
      toggle.checked = confirmed[key];
      window.dispatchEvent(new CustomEvent('linkup:privacy-changed', { detail: confirmed }));
      toast.success('Privacy updated');
    } catch (failure) {
      setValue(previous);
      // Ionic changes its own checked property before React renders. Restore it even if a fast failure batches both state updates.
      toggle.checked = previous[key];
      toast.error(settingsError(failure, 'Could not save this change. Please try again.'));
    }
    finally { requestInFlight.current = false; setSaving(false); }
  };
  return <SettingsLayout title="Account privacy">
    <div className="settings-feature-icon"><IonIcon icon={shieldCheckmarkOutline} /></div>
    <div className="settings-intro"><h1>Connect on your terms.</h1><p>Control how people find you and get in touch.</p></div>
    {error ? <SettingsError text={error} retry={() => setRetry(v => v + 1)} /> : !value ? <SettingsLoading text="Loading privacy settings…" /> : <section className="settings-card">
      {controls.map(control => <div className="settings-toggle-row" key={control.key}>
        <div className="settings-toggle-heading"><IonIcon icon={control.icon} /><IonToggle checked={value[control.key]} disabled={saving} onIonChange={event => void save(control.key, event.detail.checked, event.target)}>{control.label}</IonToggle></div>
        <p>{control.description}</p>
      </div>)}
    </section>}
    <p className="settings-footnote">Discovery visibility does not hide your profile from people with your link. Random chats and rooms you choose to join are separate from direct message requests.</p>
    <section className="settings-card"><SettingsLink icon={banOutline} title="Blocked users" description="Review who you have blocked" to="/app/me/settings/blocked" /><SettingsLink icon={documentTextOutline} title="Privacy policy" description="Understand how your information is used" to="/app/me/settings/privacy-policy" /></section>
  </SettingsLayout>;
}
