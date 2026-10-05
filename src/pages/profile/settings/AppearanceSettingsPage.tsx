import { IonIcon } from '@ionic/react';
import { checkmarkCircle, desktopOutline, moonOutline, sparklesOutline, sunnyOutline } from 'ionicons/icons';
import { useLinkUpTheme, ThemePreference } from '../../../contexts/ThemeContext';
import { SettingsLayout } from './SettingsLayout';

const themes: { value: ThemePreference; label: string; subtitle: string; icon: string }[] = [
  { value: 'light', label: 'Light', subtitle: 'Bright & familiar', icon: sunnyOutline },
  { value: 'dark', label: 'Dark', subtitle: 'Easy on the eyes', icon: moonOutline },
  { value: 'modern', label: 'Modern', subtitle: 'A little more color', icon: sparklesOutline },
];
export default function AppearanceSettingsPage() {
  const { preference, setTheme } = useLinkUpTheme();
  return <SettingsLayout title="Appearance">
    <div className="settings-intro"><span className="settings-eyebrow">MAKE IT YOURS</span><h1>Your space. Your style.</h1><p>Choose the look that feels right. Your choice applies across LinkUp.</p></div>
    <div className="theme-options" role="group" aria-label="App theme">
      {themes.map(item => <button key={item.value} className={`theme-option theme-preview-${item.value}${preference === item.value ? ' is-selected' : ''}`} aria-pressed={preference === item.value} onClick={() => setTheme(item.value)}>
        <span className="theme-phone" aria-hidden="true"><span className="theme-phone-top" /><span className="theme-phone-person" /><span className="theme-phone-line" /><span className="theme-phone-line short" /><span className="theme-phone-bubble" /><span className="theme-phone-nav" /></span>
        <span className="theme-option-label"><IonIcon icon={item.icon} /><strong>{item.label}</strong>{preference === item.value && <IonIcon className="theme-check" icon={checkmarkCircle} />}</span>
        <small>{item.subtitle}</small>
      </button>)}
    </div>
    <button className={`settings-system-theme${preference === 'system' ? ' is-selected' : ''}`} aria-pressed={preference === 'system'} onClick={() => setTheme('system')}>
      <IonIcon icon={desktopOutline} /><span><strong>Use device setting</strong><small>Switch automatically with your phone.</small></span>{preference === 'system' && <IonIcon icon={checkmarkCircle} />}
    </button>
    <p className="settings-footnote">Saved on this device. You can change it any time.</p>
  </SettingsLayout>;
}
