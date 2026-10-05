import { useEffect, useState } from 'react';
import { useHistory } from 'react-router';
import { getLegalDocument, LegalDocument } from '../../../service/settingsService';
import { SettingsError, SettingsLayout, SettingsLoading } from './SettingsLayout';

export default function LegalSettingsPage({ kind }: { kind: 'privacy' | 'terms' | 'deletion' }) {
  const history = useHistory();
  const [document, setDocument] = useState<LegalDocument | null>(null); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setDocument(null); setError('');
    void getLegalDocument(kind).then(value => { if (active) setDocument(value); }).catch(() => { if (active) setError('This document could not be loaded. Please try again.'); });
    return () => { active = false; };
  }, [kind, retry]);
  const title = kind === 'privacy' ? 'Privacy policy' : kind === 'terms' ? 'Terms & conditions' : 'Account & data deletion';
  return <SettingsLayout title={title}>
    {error ? <SettingsError text={error} retry={() => setRetry(value => value + 1)} /> : !document ? <SettingsLoading text="Loading document…" /> : <article className="settings-legal"><span className="settings-eyebrow">LINKUP</span><h1>{document.title}</h1><p className="settings-legal-meta">Updated {document.updatedAt}<br />{document.operator}</p>{document.sections.map(section => <section key={section.title}><h2>{section.title}</h2><p>{section.text}</p></section>)}<button className="settings-primary settings-full" onClick={() => history.push('/app/me/settings/contact?category=PRIVACY')}>Contact us about your data</button></article>}
  </SettingsLayout>;
}
