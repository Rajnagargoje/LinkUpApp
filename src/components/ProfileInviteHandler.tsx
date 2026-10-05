import { useEffect, useRef } from 'react';
import { useHistory, useLocation } from 'react-router';
import { App } from '@capacitor/app';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { useAuth } from '../contexts/AuthContext';
import { PENDING_INVITE_KEY, parseProfileInvite } from '../service/inviteService';

export default function ProfileInviteHandler() {
  const { isAuthenticated, user } = useAuth();
  const history = useHistory(); const location = useLocation();
  const latest = useRef({ isAuthenticated, user, pathname: location.pathname });
  latest.current = { isAuthenticated, user, pathname: location.pathname };
  const lastReceived = useRef({ id: '', at: 0 });
  const openPending = useRef(() => {});
  openPending.current = () => {
    const session = latest.current;
    const pending = localStorage.getItem(PENDING_INVITE_KEY);
    if (pending && !/^[A-Za-z0-9_-]{1,80}$/.test(pending)) { localStorage.removeItem(PENDING_INVITE_KEY); return; }
    if (!pending || !session.isAuthenticated || !session.user?.onboardingCompleted) return;
    // Let the existing login/onboarding redirect finish before opening the invite.
    if (session.pathname !== '/app' && !session.pathname.startsWith('/app/')) return;
    localStorage.removeItem(PENDING_INVITE_KEY);
    const destination = pending === session.user.publicId ? '/app/account' : `/app/person/${encodeURIComponent(pending)}`;
    if (session.pathname !== destination) history.push(destination);
  };
  useEffect(() => {
    let active = true; let listener: PluginListenerHandle | undefined;
    const accept = (url: string) => {
      if (!active) return;
      const id = parseProfileInvite(url); if (!id) return;
      // Some Android versions deliver a cold-start link through both APIs.
      if (lastReceived.current.id === id && Date.now() - lastReceived.current.at < 2000) return;
      lastReceived.current = { id, at: Date.now() };
      localStorage.setItem(PENDING_INVITE_KEY, id); openPending.current();
    };
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appUrlOpen', event => accept(event.url)).then(handle => { if (active) listener = handle; else void handle.remove(); }).catch(() => {});
      void App.getLaunchUrl().then(result => { if (result?.url) accept(result.url); }).catch(() => {});
    }
    return () => { active = false; void listener?.remove(); };
  }, []);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('invite');
    if (id && /^[A-Za-z0-9_-]{1,80}$/.test(id)) {
      localStorage.setItem(PENDING_INVITE_KEY, id);
      const params = new URLSearchParams(location.search); params.delete('invite');
      history.replace({ ...location, search: params.toString() ? `?${params}` : '' });
    }
    openPending.current();
  }, [isAuthenticated, user?.publicId, user?.onboardingCompleted, location.pathname, location.search]);
  return null;
}
