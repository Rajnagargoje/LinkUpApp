import { ReactNode } from 'react';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { chevronForwardOutline, refreshOutline } from 'ionicons/icons';
import { useHistory } from 'react-router';
import '../Settings.scss';

export function SettingsLayout({ title, children, back = '/app/me/settings' }: { title: string; children: ReactNode; back?: string }) {
  return <IonPage className="settings-page">
    <IonHeader className="settings-header"><IonToolbar className="settings-toolbar">
      <IonButtons slot="start"><IonBackButton defaultHref={back} text="" /></IonButtons><IonTitle>{title}</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent className="settings-content"><main className="settings-container">{children}</main></IonContent>
  </IonPage>;
}
export function SettingsLink({ icon, title, description, to, onClick, danger = false }: {
  icon: string; title: string; description?: string; to?: string; onClick?: () => void; danger?: boolean;
}) {
  const history = useHistory();
  return <button type="button" className={`settings-row${danger ? ' settings-row-danger' : ''}`} onClick={onClick ?? (() => to && history.push(to))}>
    <span className="settings-row-icon"><IonIcon icon={icon} aria-hidden="true" /></span>
    <span className="settings-row-copy"><strong>{title}</strong>{description && <small>{description}</small>}</span>
    <IonIcon className="settings-row-arrow" icon={chevronForwardOutline} aria-hidden="true" />
  </button>;
}
export function SettingsLoading({ text = 'Loading…' }: { text?: string }) {
  return <div className="settings-state" role="status"><IonSpinner name="crescent" /><p>{text}</p></div>;
}
export function SettingsError({ text, retry }: { text: string; retry: () => void }) {
  return <div className="settings-state" role="alert"><IonIcon icon={refreshOutline} /><p>{text}</p><button className="settings-primary" onClick={retry}>Try again</button></div>;
}
