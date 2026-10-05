import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { IonIcon } from '@ionic/react';
import { chatbubbleOutline, checkmarkCircleOutline } from 'ionicons/icons';
import toast from 'react-hot-toast';
import { createSupportRequest, getPublicSettings, getSupportRequests, PublicSettings, settingsError, SupportCategory, SupportTicket } from '../../../service/settingsService';
import { openSettingsLink } from '../../../service/inviteService';
import { SettingsLayout } from './SettingsLayout';

const categories: { value: SupportCategory; label: string }[] = [{ value: 'GENERAL', label: 'General question' }, { value: 'BUG', label: 'Something is not working' }, { value: 'SAFETY', label: 'Safety concern' }, { value: 'PRIVACY', label: 'Privacy request' }];
export default function ContactSupportPage() {
  const location = useLocation();
  const [category, setCategory] = useState<SupportCategory>(() => new URLSearchParams(location.search).get('category') === 'PRIVACY' ? 'PRIVACY' : 'GENERAL');
  const [subject, setSubject] = useState(''); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]); const [nextPage, setNextPage] = useState<number | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [config, setConfig] = useState<PublicSettings | null>(null);
  const load = useCallback(async (page = 0) => {
    setLoading(true); setError('');
    try { const data = await getSupportRequests(page); setTickets(old => page === 0 ? data.items : [...old, ...data.items]); setNextPage(data.nextPage); }
    catch { setError('Could not load your previous requests.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); void getPublicSettings().then(setConfig).catch(() => {}); }, [load]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (saving) return;
    if (!subject.trim() || message.trim().length < 10) { toast.error('Add a subject and at least 10 characters describing your request.'); return; }
    setSaving(true);
    try { const ticket = await createSupportRequest({ category, subject: subject.trim(), message: message.trim() }); setSubject(''); setMessage(''); toast.success(`Request #${ticket.id} submitted`); await load(); }
    catch (failure) { toast.error(settingsError(failure, 'Your request could not be submitted. Please try again.')); }
    finally { setSaving(false); }
  };
  return <SettingsLayout title="Contact support" back="/app/me/settings/help">
    <div className="settings-intro"><h1>Tell us what's happening.</h1><p>Your request is saved to your account. Replies appear below when support responds.</p></div>
    <form className="settings-card settings-form" onSubmit={event => void submit(event)}>
      <label htmlFor="support-category">What can we help with?</label><select id="support-category" value={category} disabled={saving} onChange={event => setCategory(event.target.value as SupportCategory)}>{categories.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      <label htmlFor="support-subject">Subject</label><input id="support-subject" placeholder="A short summary" value={subject} onChange={event => setSubject(event.target.value)} maxLength={120} required disabled={saving} />
      <label htmlFor="support-message">Message</label><textarea id="support-message" placeholder="Include what happened and what you expected." value={message} onChange={event => setMessage(event.target.value)} minLength={10} maxLength={2000} required rows={6} disabled={saving} /><small className="settings-character-count">{message.length}/2000</small>
      <p className="settings-footnote">Never include your password, verification codes or payment details. For immediate danger, contact local emergency services.</p>
      <button className="settings-primary settings-full" type="submit" disabled={saving}>{saving ? 'Sending…' : 'Send request'}</button>
    </form>
    {config?.supportEmail && <button className="settings-text-button" onClick={() => void openSettingsLink(`mailto:${config.supportEmail}?subject=LinkUp%20support`).catch(() => toast.error(`You can email ${config.supportEmail}`))}>Or email {config.supportEmail}</button>}
    <div className="settings-section-heading"><h2 className="settings-section-label">YOUR REQUESTS</h2><button disabled={loading} className="settings-text-button" onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    {error && <p className="settings-status" role="alert">{error}</p>}
    {!loading && !error && tickets.length === 0 && <p className="settings-footnote">Your submitted requests will appear here.</p>}
    {tickets.map(ticket => <details className="settings-card support-ticket" key={ticket.id}><summary><span><IonIcon icon={ticket.status === 'RESOLVED' ? checkmarkCircleOutline : chatbubbleOutline} />#{ticket.id} · {ticket.subject}</span><small>{ticket.status.replace('_', ' ')}</small></summary><p>{ticket.message}</p>{ticket.reply ? <div className="support-reply"><strong>Support reply</strong><p>{ticket.reply}</p></div> : <p className="settings-footnote">Waiting for a support reply.</p>}</details>)}
    {nextPage !== null && <button className="settings-outline settings-full" disabled={loading} onClick={() => void load(nextPage)}>Load more requests</button>}
  </SettingsLayout>;
}
