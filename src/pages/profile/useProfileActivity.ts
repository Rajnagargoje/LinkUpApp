import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectionResponse } from '../../common/connection.model';
import { ConversationResponse } from '../../common/chat.model';
import { getFriends } from '../../service/connectionService';
import { getMyConversations } from '../../service/chatService';
import { isNotificationAppActive } from '../../contexts/NotificationContext';
import socketService from '../../service/socketService';
import { STOMP } from '../../config/api.config';
import { CHAT_LIST_CHANGED } from '../../utils/chatPresentation';

/** Uses the existing shared socket and keeps requests scoped to the visible profile. */
export default function useProfileActivity(owner: string, active: boolean, revision: number) {
  const [friends, setFriends] = useState<ConnectionResponse[] | null>(null);
  const [conversations, setConversations] = useState<ConversationResponse[] | null>(null);
  const [errors, setErrors] = useState({ friends: '', chats: '' });
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(false); const visible = useRef(active); visible.current = active;
  const flight = useRef<Promise<void> | null>(null); const queued = useRef(false);
  const presence = useRef(new Map<string, boolean>());
  const loaded = useRef(false);
  const refresh = useCallback((queueIfBusy = false): Promise<void> => {
    if (!mounted.current || !visible.current || !isNotificationAppActive()) return Promise.resolve();
    if (flight.current) { if (queueIfBusy) queued.current = true; return flight.current; }
    setRefreshing(true);
    const request = Promise.allSettled([getFriends(), getMyConversations()]).then(([friendsResult, chatResult]) => {
      if (!mounted.current) return;
      if (friendsResult.status === 'fulfilled') {
        const items = friendsResult.value.data.data ?? [];
        setFriends([...new Map(items.filter(friend => friend.status === 'ACCEPTED').map(friend => [friend.userId,
          presence.current.has(friend.username) ? { ...friend, online: presence.current.get(friend.username)! } : friend])).values()]);
      }
      if (chatResult.status === 'fulfilled') setConversations((chatResult.value ?? []).map(chat =>
        presence.current.has(chat.friendUsername) ? { ...chat, friendOnline: presence.current.get(chat.friendUsername)! } : chat));
      setErrors({ friends: friendsResult.status === 'rejected' ? 'Could not refresh your friends.' : '', chats: chatResult.status === 'rejected' ? 'Could not refresh your chats.' : '' });
      loaded.current = true;
    }).finally(() => {
      if (flight.current === request) flight.current = null;
      if (!mounted.current) return;
      setRefreshing(false);
      if (queued.current) { queued.current = false; void refresh(); }
    });
    flight.current = request;
    return request;
  }, [owner]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, [owner]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => { void refresh(true); }, loaded.current ? 150 : 0);
    return () => clearTimeout(timer);
  }, [active, revision, refresh]);
  useEffect(() => {
    const update = () => { if (visible.current && isNotificationAppActive()) void refresh(true); };
    window.addEventListener(CHAT_LIST_CHANGED, update);
    window.addEventListener('linkup:app-resume', update);
    document.addEventListener('visibilitychange', update);
    return () => { window.removeEventListener(CHAT_LIST_CHANGED, update); window.removeEventListener('linkup:app-resume', update); document.removeEventListener('visibilitychange', update); };
  }, [refresh]);
  useEffect(() => {
    if (!active) return;
    const key = `profile-presence-${owner}`;
    const subscribe = () => {
      presence.current.clear();
      if (!socketService.isConnected()) return;
      socketService.subscribe(key, STOMP.presenceTopic, (event: { username?: string; status?: string }) => {
        if (!mounted.current || !visible.current || !event.username || !['ONLINE', 'OFFLINE'].includes(event.status ?? '')) return;
        const online = event.status === 'ONLINE'; presence.current.set(event.username, online);
        if (presence.current.size > 1000) presence.current.delete(presence.current.keys().next().value!);
        setFriends(items => items?.some(friend => friend.username === event.username && friend.online !== online)
          ? items.map(friend => friend.username === event.username ? { ...friend, online } : friend) : items);
        setConversations(items => items?.some(chat => chat.friendUsername === event.username && chat.friendOnline !== online)
          ? items.map(chat => chat.friendUsername === event.username ? { ...chat, friendOnline: online } : chat) : items);
      });
    };
    subscribe();
    const stop = socketService.onConnectionChange(connected => { if (connected) { subscribe(); void refresh(true); } });
    return () => { stop(); socketService.unsubscribe(key); presence.current.clear(); };
  }, [active, owner, refresh]);
  return { friends, conversations, errors, refreshing, refresh };
}
