import { useEffect, useRef } from 'react';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { checkmarkCircleOutline, chevronBackOutline, chevronForwardOutline, closeOutline, personCircleOutline } from 'ionicons/icons';

interface Props {
  photos: string[]; index: number | null; primary: string | null; busy: boolean;
  onChange: (index: number) => void; onClose: () => void; onMakePrimary: (url: string) => void;
}
export default function ProfilePhotoViewer({ photos, index, primary, busy, onChange, onClose, onMakePrimary }: Props) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const selected = index === null ? 0 : Math.max(0, Math.min(index, photos.length - 1));
  const url = photos[selected];
  useEffect(() => {
    if (index === null) return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && selected > 0) { event.preventDefault(); onChange(selected - 1); }
      if (event.key === 'ArrowRight' && selected < photos.length - 1) { event.preventDefault(); onChange(selected + 1); }
    };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [index, selected, photos.length, onChange]);
  return <IonModal isOpen={index !== null && photos.length > 0} className="profile-photo-modal" onDidDismiss={onClose} aria-label="Your profile photos">
    <IonHeader><IonToolbar><IonTitle>Photo {selected + 1} of {photos.length}</IonTitle><IonButtons slot="end"><IonButton aria-label="Close photos" onClick={onClose}><IonIcon slot="icon-only" icon={closeOutline} /></IonButton></IonButtons></IonToolbar></IonHeader>
    <IonContent scrollY={false}>
      <div className="profile-photo-viewer">
        <div className="profile-photo-stage" onTouchStart={event => { start.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }} onTouchEnd={event => {
          if (!start.current || !event.changedTouches[0]) return;
          const dx = event.changedTouches[0].clientX - start.current.x; const dy = event.changedTouches[0].clientY - start.current.y; start.current = null;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onChange(Math.max(0, Math.min(photos.length - 1, selected + (dx < 0 ? 1 : -1))));
        }}>
          <img key={url} src={url} alt={`Your photo ${selected + 1} of ${photos.length}`} />
          {photos.length > 1 && <><button className="photo-viewer-arrow photo-viewer-previous" aria-label="Previous photo" disabled={selected === 0} onClick={() => onChange(selected - 1)}><IonIcon icon={chevronBackOutline} /></button><button className="photo-viewer-arrow photo-viewer-next" aria-label="Next photo" disabled={selected === photos.length - 1} onClick={() => onChange(selected + 1)}><IonIcon icon={chevronForwardOutline} /></button></>}
        </div>
        <div className="profile-photo-viewer-actions"><p>{url === primary ? 'Your current profile photo' : 'Choose the photo people see first.'}</p><button disabled={busy || url === primary} onClick={() => url && onMakePrimary(url)}>{busy ? <IonSpinner name="crescent" /> : <IonIcon icon={url === primary ? checkmarkCircleOutline : personCircleOutline} />}{url === primary ? 'Profile photo' : busy ? 'Saving…' : 'Use as profile photo'}</button></div>
      </div>
    </IonContent>
  </IonModal>;
}
