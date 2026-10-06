import { useCallback, useEffect, useRef, useState } from "react";
import socketService from "../../service/socketService";
import { useNotifications } from "../../contexts/NotificationContext";
import {
  ChatEvent,
  ChatMessage,
  Companion,
  ConnectionStatus,
  Partner,
  Phase,
  Preferences,
} from "./randomChat.types";

const id = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export default function useRandomChat(username: string) {
  const [connected, setConnected] = useState(socketService.isConnected());
  const [phase, setPhase] = useState<Phase>("idle");
  const [partner, setPartner] = useState<Partner | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [typing, setTyping] = useState(false);
  const [aiError, setAiError] = useState("");
  const [saved, setSaved] = useState(false);
  const [searching, setSearching] = useState(false);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [fallbackSeconds, setFallbackSeconds] = useState(15);
  const [waitStarted, setWaitStarted] = useState<number | null>(null);
  const [offer, setOffer] = useState<{
    id: string;
    expiresAt: string;
    accepted: boolean;
  } | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("NONE");
  const [match, setMatch] = useState<string | undefined>();
  const { revision } = useNotifications();
  const matchRef = useRef<string>();
  const selfId = useRef<string>();
  const phaseRef = useRef<Phase>("idle");
  const kindRef = useRef<"HUMAN" | "AI">("HUMAN");
  const action = useRef("");
  const aiPending = useRef(false);
  const alive = useRef(false);
  const engaged = useRef(false);
  const next = useRef<Preferences | null>(null);
  const preferences = useRef<Preferences>({
    language: "",
    interests: [],
    aiFallback: true,
  });
  const acknowledgements = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const busyTimeout = useRef<ReturnType<typeof setTimeout>>();
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();
  const outgoingTyping = useRef<ReturnType<typeof setTimeout>>();
  const lastTyping = useRef(0);
  const setPhaseNow = (value: Phase) => {
    phaseRef.current = value;
    setPhase(value);
  };
  const finishAction = () => {
    clearTimeout(busyTimeout.current);
    action.current = "";
    setBusy("");
  };
  const clearPending = () => {
    acknowledgements.current.forEach(clearTimeout);
    acknowledgements.current.clear();
  };
  const clearTyping = () => {
    clearTimeout(typingTimeout.current);
    clearTimeout(outgoingTyping.current);
    lastTyping.current = 0;
    setTyping(false);
    aiPending.current = false;
  };
  const publish = useCallback(
    (destination: string, body: object) =>
      socketService.publish(`/app/random/${destination}`, body),
    [],
  );
  const begin = (name: string) => {
    action.current = name;
    setBusy(name);
    clearTimeout(busyTimeout.current);
    busyTimeout.current = setTimeout(() => {
      if (!alive.current) return;
      action.current = "";
      setBusy("");
      setNotice(
        "The server is taking longer than usual. You can retry or end the chat.",
      );
    }, 12000);
  };
  const resetThread = () => {
    clearPending();
    matchRef.current = undefined;
    setMatch(undefined);
    setMessages([]);
    setPartner(null);
    clearTyping();
    setAiError("");
    setSaved(false);
    setOffer(null);
    setNotice("");
    setConnectionStatus("NONE");
  };
  const join = (prefs: Preferences) => {
    resetThread();
    preferences.current = prefs;
    engaged.current = true;
    setPhaseNow("waiting");
    setWaitStarted(null);
    begin("start");
    if (!publish("join", prefs)) {
      engaged.current = false;
      finishAction();
      setPhaseNow("idle");
      setNotice("Connection lost. Please try again when connected.");
    }
  };
  const queueAck = (clientId: string) => {
    clearTimeout(acknowledgements.current.get(clientId));
    acknowledgements.current.set(
      clientId,
      setTimeout(() => {
        if (!alive.current) return;
        acknowledgements.current.delete(clientId);
        setMessages((old) =>
          old.map((message) =>
            message.clientId === clientId && message.status === "sending"
              ? { ...message, status: "failed" }
              : message,
          ),
        );
        aiPending.current = false;
        setTyping(false);
      }, 10000),
    );
  };
  useEffect(() => {
    alive.current = true;
    const receive = (event: ChatEvent) => {
      if (!alive.current) return;
      if (
        action.current === "end" &&
        !["ENDED", "ERROR", "COMPANIONS"].includes(event.type)
      )
        return;
      // A late reply, receipt or typing event can never cross into the next conversation.
      if (
        event.matchId &&
        !["MATCHED", "MATCH_UPDATED"].includes(event.type) &&
        event.matchId !== matchRef.current
      )
        return;
      switch (event.type) {
        case "COMPANIONS":
          setCompanions(event.companions ?? []);
          setAiAvailable(!!event.aiAvailable);
          setFallbackSeconds(event.fallbackSeconds ?? 15);
          if (action.current === "remove") finishAction();
          break;
        case "WAITING":
          if (!engaged.current || action.current === "end") break;
          setPhaseNow("waiting");
          finishAction();
          setNotice(event.message ?? "");
          setOffer(null);
          setWaitStarted(event.aiAvailable ? Date.now() : null);
          if (event.fallbackSeconds) setFallbackSeconds(event.fallbackSeconds);
          break;
        case "MATCHED":
        case "MATCH_UPDATED": {
          if (!engaged.current || action.current === "end" || !event.matchId)
            break;
          const fresh = matchRef.current !== event.matchId;
          if (fresh) {
            clearPending();
            setMessages([]);
            setNotice("");
            setConnectionStatus("NONE");
          }
          matchRef.current = event.matchId;
          setMatch(event.matchId);
          selfId.current = event.selfId;
          kindRef.current = event.partnerKind ?? "HUMAN";
          setPartner({
            name: event.partner ?? "Your partner",
            kind: kindRef.current,
            guest: !!event.partnerGuest,
            publicId: event.partnerPublicId,
            personaId: event.personaId,
            color: event.personaColor,
            personaProfile: event.personaProfile,
            sharedInterests: event.sharedInterests ?? [],
          });
          if (event.messages)
            setMessages(
              event.messages.map((message) => ({
                ...message,
                mine: message.senderId === event.selfId,
                status: "sent",
              })),
            );
          setPhaseNow("matched");
          clearTyping();
          setWaitStarted(null);
          setOffer(null);
          setSaved(!!event.saved);
          setSearching(!!event.searching);
          setAiError(
            event.retryReply
              ? "The last reply was interrupted. You can retry it."
              : "",
          );
          finishAction();
          break;
        }
        case "MESSAGE": {
          if (!event.id || !event.content || phaseRef.current !== "matched")
            break;
          if (event.clientId) {
            clearTimeout(acknowledgements.current.get(event.clientId));
            acknowledgements.current.delete(event.clientId);
          }
          const mine = event.senderId
            ? event.senderId === selfId.current
            : event.sender === username;
          const message: ChatMessage = {
            id: event.id,
            clientId: event.clientId,
            content: event.content,
            sender: event.sender ?? "",
            senderId: event.senderId,
            timeStamp: event.timeStamp ?? new Date().toISOString(),
            mine,
            status: "sent",
          };
          setMessages((old) => {
            const index = old.findIndex(
              (m) =>
                m.id === message.id ||
                (mine && !!message.clientId && m.clientId === message.clientId),
            );
            return (
              index < 0
                ? [...old, message]
                : old.map((m, i) => (i === index ? message : m))
            ).slice(-200);
          });
          if (!mine) {
            clearTimeout(typingTimeout.current);
            setTyping(false);
            aiPending.current = false;
            setAiError("");
          }
          break;
        }
        case "TYPING":
          clearTimeout(typingTimeout.current);
          setTyping(!!event.typing);
          if (kindRef.current === "AI") aiPending.current = !!event.typing;
          else if (event.typing)
            typingTimeout.current = setTimeout(() => setTyping(false), 5000);
          if (action.current === "retry") finishAction();
          break;
        case "AI_ERROR":
          setTyping(false);
          aiPending.current = false;
          setAiError(event.message ?? "Could not reply. Please try again.");
          finishAction();
          break;
        case "HUMAN_OFFER":
          if (event.offerId && event.expiresAt)
            setOffer({
              id: event.offerId,
              expiresAt: event.expiresAt,
              accepted: false,
            });
          if (action.current === "search-people") finishAction();
          break;
        case "OFFER_ACCEPTED":
          setOffer((old) =>
            old && old.id === event.offerId ? { ...old, accepted: true } : old,
          );
          finishAction();
          break;
        case "OFFER_ENDED":
          setOffer(null);
          setSearching(false);
          finishAction();
          setNotice("You can keep chatting here, or look for another person.");
          break;
        case "SEARCHING":
          setSearching(!!event.searching);
          finishAction();
          break;
        case "COMPANION_SAVED":
          setSaved(!!event.saved);
          finishAction();
          break;
        case "CONNECTION":
          if (event.connectionStatus)
            setConnectionStatus(event.connectionStatus);
          if (event.message) setNotice(event.message);
          finishAction();
          break;
        case "NOTICE":
        case "REGISTER_REQUIRED":
          setNotice(event.message ?? "");
          finishAction();
          break;
        case "ERROR":
          if (event.clientId) {
            clearTimeout(acknowledgements.current.get(event.clientId));
            acknowledgements.current.delete(event.clientId);
            setMessages((old) =>
              old.map((m) =>
                m.clientId === event.clientId ? { ...m, status: "failed" } : m,
              ),
            );
            aiPending.current = false;
            setTyping(false);
          }
          if (action.current === "start" || action.current === "resume") {
            engaged.current = false;
            setPhaseNow("idle");
          }
          setNotice(event.message ?? "Something went wrong. Please try again.");
          finishAction();
          break;
        case "ENDED": {
          // Partner departure is not our leave acknowledgement. Next must wait for the latter.
          const requestedNext = !event.matchId ? next.current : null;
          if (!event.matchId) next.current = null;
          engaged.current = false;
          clearPending();
          matchRef.current = undefined;
          setMatch(undefined);
          setPhaseNow("ended");
          clearTyping();
          setOffer(null);
          setWaitStarted(null);
          setSearching(false);
          setAiError("");
          setNotice(event.message ?? "Chat ended.");
          setMessages((old) =>
            old.map((m) =>
              m.status === "sending" ? { ...m, status: "failed" } : m,
            ),
          );
          if (action.current !== "end" || !event.matchId) finishAction();
          if (requestedNext) join(requestedNext);
          break;
        }
      }
    };
    const subscribe = () => {
      socketService.subscribe("random-chat", "/user/queue/random", receive);
      publish("companions/list", {});
    };
    if (socketService.isConnected()) subscribe();
    const disconnect = socketService.onConnectionChange((value) => {
      if (!alive.current) return;
      setConnected(value);
      if (value) {
        subscribe();
        return;
      }
      next.current = null;
      engaged.current = false;
      clearPending();
      matchRef.current = undefined;
      setMatch(undefined);
      setOffer(null);
      setPhaseNow("ended");
      clearTyping();
      setWaitStarted(null);
      finishAction();
      setNotice(
        "Connection lost. Start a new chat after reconnecting. Saved chats are still available.",
      );
      setMessages((old) =>
        old.map((m) =>
          m.status === "sending" ? { ...m, status: "failed" } : m,
        ),
      );
    });
    return () => {
      alive.current = false;
      disconnect();
      clearPending();
      clearTimeout(busyTimeout.current);
      clearTimeout(typingTimeout.current);
      clearTimeout(outgoingTyping.current);
      if (engaged.current && socketService.isConnected()) publish("leave", {});
      socketService.unsubscribe("random-chat");
    };
  }, [username, publish]);
  useEffect(() => {
    if (connected && match && partner?.kind === "HUMAN")
      publish("connection/status", { matchId: match });
  }, [revision, connected, match, partner?.kind, publish]);

  const start = (prefs: Preferences) => {
    if (!socketService.isConnected() || action.current) return;
    if (engaged.current) {
      next.current = prefs;
      begin("end");
      if (!publish("leave", {})) {
        next.current = null;
        finishAction();
      }
    } else join(prefs);
  };
  const end = () => {
    if (!socketService.isConnected() || action.current === "end") return;
    next.current = null;
    begin("end");
    if (!publish("leave", {})) finishAction();
  };
  const send = (content: string, retry?: ChatMessage) => {
    if (
      !content.trim() ||
      content.length > 2000 ||
      !socketService.isConnected() ||
      phaseRef.current !== "matched" ||
      action.current === "end" ||
      (kindRef.current === "AI" && aiPending.current)
    )
      return false;
    const clientId = retry?.clientId ?? id();
    if (
      !publish("message", {
        matchId: matchRef.current,
        content: content.trim(),
        clientId,
      })
    )
      return false;
    const message: ChatMessage = {
      id: retry?.id ?? clientId,
      clientId,
      sender: username,
      senderId: selfId.current,
      content: content.trim(),
      timeStamp: retry?.timeStamp ?? new Date().toISOString(),
      mine: true,
      status: "sending",
    };
    setMessages((old) =>
      retry
        ? old.map((m) => (m.id === retry.id ? message : m))
        : [...old, message].slice(-200),
    );
    queueAck(clientId);
    if (kindRef.current === "AI") aiPending.current = true;
    return true;
  };
  const command = (destination: string, data = {}) => {
    if (!socketService.isConnected() || action.current) return;
    begin(destination.split("/").pop() ?? destination);
    if (!publish(destination, { matchId: matchRef.current, ...data }))
      finishAction();
  };
  const resume = (personaId: string, prefs: Preferences) => {
    if (engaged.current || action.current || !socketService.isConnected())
      return;
    resetThread();
    preferences.current = prefs;
    engaged.current = true;
    begin("resume");
    if (!publish("companions/resume", { personaId, preferences: prefs })) {
      engaged.current = false;
      finishAction();
    }
  };
  const writeTyping = () => {
    if (
      !matchRef.current ||
      kindRef.current === "AI" ||
      !socketService.isConnected()
    )
      return;
    if (Date.now() - lastTyping.current > 2000) {
      publish("typing", { matchId: matchRef.current, typing: true });
      lastTyping.current = Date.now();
    }
    clearTimeout(outgoingTyping.current);
    const typingMatch = matchRef.current;
    outgoingTyping.current = setTimeout(() => {
      if (typingMatch === matchRef.current)
        publish("typing", { matchId: typingMatch, typing: false });
    }, 1600);
  };
  return {
    connected,
    phase,
    partner,
    messages,
    notice,
    busy,
    typing,
    aiError,
    saved,
    searching,
    companions,
    aiAvailable,
    fallbackSeconds,
    waitStarted,
    offer,
    connectionStatus,
    match,
    start,
    end,
    send,
    command,
    resume,
    writeTyping,
    dismissNotice: () => setNotice(""),
    refreshCompanions: () => publish("companions/list", {}),
  };
}
