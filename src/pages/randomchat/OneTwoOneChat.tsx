import {
  IonActionSheet,
  IonAlert,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonModal,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  arrowDownOutline,
  arrowForwardOutline,
  bookmark,
  bookmarkOutline,
  chatbubbleEllipsesOutline,
  checkmark,
  checkmarkCircle,
  chevronForwardOutline,
  closeOutline,
  ellipsisHorizontal,
  flashOutline,
  heartOutline,
  peopleOutline,
  personAddOutline,
  personOutline,
  refreshOutline,
  send,
  shieldCheckmarkOutline,
  sparklesOutline,
  stopOutline,
  trashOutline,
} from "ionicons/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import {
  formatChatTime,
  formatChatListTime,
  chatTimestamp,
} from "../../utils/chatPresentation";
import useRandomChat from "./useRandomChat";
import { Preferences } from "./randomChat.types";
import "./OneTwoOneChat.scss";

const interests = ["Music", "Movies", "Travel", "Food", "Gaming", "Books"];
const starters = [
  "What made you smile today?",
  "What song is on repeat?",
  "Mountains or beaches?",
];
const dayLabel = (value: string) =>
  Number.isFinite(chatTimestamp(value))
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
      }).format(chatTimestamp(value))
    : "";
function Avatar({
  name,
  color = "violet",
  ai = false,
  large = false,
}: {
  name: string;
  color?: string;
  ai?: boolean;
  large?: boolean;
}) {
  return (
    <span
      className={`random-avatar random-avatar--${color}${large ? " random-avatar--large" : ""}`}
      aria-hidden="true"
    >
      <span>{Array.from(name)[0]?.toUpperCase() || "L"}</span>
      {ai && (
        <i>
          <IonIcon icon={sparklesOutline} />
        </i>
      )}
    </span>
  );
}
function RandomChatContent({
  username,
  initialInterests,
}: {
  username: string;
  initialInterests: string[];
}) {
  const history = useHistory();
  const chat = useRandomChat(username);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("");
  const [selected, setSelected] = useState<string[]>(
    initialInterests.slice(0, 6),
  );
  const [custom, setCustom] = useState("");
  const [allowAi, setAllowAi] = useState(true);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [removePersona, setRemovePersona] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [newMessages, setNewMessages] = useState(false);
  const content = useRef<HTMLIonContentElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const matched = chat.phase === "matched";
  const ai = chat.partner?.kind === "AI";
  const active = matched || chat.phase === "waiting";
  const canSend = matched && chat.connected && chat.busy !== "end";
  const prefs = useMemo<Preferences>(
    () => ({
      language,
      interests: [
        ...new Set([
          ...selected,
          ...custom
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        ]),
      ].slice(0, 10),
      aiFallback: allowAi,
    }),
    [language, selected, custom, allowAi],
  );
  const scrollDown = () => {
    nearBottom.current = true;
    setNewMessages(false);
    void content.current?.scrollToBottom(160);
  };
  useEffect(() => {
    setInput("");
    setMenu(false);
    setReport(false);
    nearBottom.current = true;
    setNewMessages(false);
  }, [chat.match]);
  useEffect(() => {
    if (!chat.messages.length && !chat.typing) {
      void content.current?.scrollToTop(0);
      return;
    }
    const latest = chat.messages[chat.messages.length - 1];
    if (nearBottom.current || latest?.mine) {
      requestAnimationFrame(() => void content.current?.scrollToBottom(120));
      setNewMessages(false);
    } else setNewMessages(true);
  }, [chat.messages, chat.typing, chat.phase]);
  useEffect(() => {
    if (composer.current) {
      composer.current.style.height = "auto";
      composer.current.style.height =
        Math.min(composer.current.scrollHeight, 112) + "px";
    }
  }, [input]);
  useEffect(() => {
    if (!chat.waitStarted && !chat.offer) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [chat.waitStarted, chat.offer]);
  const submit = (text = input) => {
    if (chat.send(text)) {
      setInput("");
      nearBottom.current = true;
      composer.current?.focus();
    }
  };
  const fallbackLeft = chat.waitStarted
    ? Math.max(
        0,
        chat.fallbackSeconds - Math.floor((now - chat.waitStarted) / 1000),
      )
    : chat.fallbackSeconds;
  const offerLeft = chat.offer
    ? Math.max(
        0,
        Math.ceil((new Date(chat.offer.expiresAt).getTime() - now) / 1000),
      )
    : 0;
  const requestLabel =
    chat.connectionStatus === "CONNECTED"
      ? "You’re friends"
      : chat.connectionStatus === "REQUEST_SENT"
        ? "Request sent"
        : chat.connectionStatus === "REQUEST_RECEIVED"
          ? "Accept request"
          : "Keep in touch";
  const keepInTouch = () => {
    if (ai) {
      if (!chat.saved) chat.command("companions/save");
    } else
      chat.command(
        chat.connectionStatus === "REQUEST_RECEIVED"
          ? "connection/accept"
          : "connect",
      );
  };
  const headerStatus = !chat.connected
    ? "Reconnecting…"
    : matched
      ? ai
        ? "Fictional character"
        : chat.partner?.guest
          ? "Guest · Connected"
          : "Member · Connected"
      : chat.phase === "waiting"
        ? "Finding your next conversation"
        : "A little curiosity goes a long way";
  const menuButtons = [
    {
      text: "Saved AI chats",
      icon: bookmarkOutline,
      handler: () => {
        chat.refreshCompanions();
        setSavedOpen(true);
      },
    },
    ...(matched && !ai && chat.partner?.publicId
      ? [
          {
            text: "View profile · leaves this chat",
            icon: personOutline,
            handler: () =>
              history.push(`/app/person/${chat.partner!.publicId}`),
          },
        ]
      : []),
    ...(matched
      ? [
          {
            text: ai ? "Report AI response" : "Report & block",
            icon: shieldCheckmarkOutline,
            handler: () => setReport(true),
          },
        ]
      : []),
    ...(matched && !ai
      ? [
          {
            text: "Block & leave",
            icon: closeOutline,
            role: "destructive",
            handler: () => chat.command("block"),
          },
        ]
      : []),
    ...(active
      ? [
          {
            text: "End chat",
            icon: stopOutline,
            role: "destructive",
            handler: () => chat.end(),
          },
        ]
      : []),
    { text: "Cancel", role: "cancel" },
  ];

  return (
    <IonPage className="random-chat-page">
      <IonHeader className="ion-no-border">
        <IonToolbar className="random-toolbar">
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/home" text="" />
          </IonButtons>
          <div className="random-header-copy">
            {matched && chat.partner && (
              <Avatar
                name={chat.partner.name}
                color={chat.partner.color}
                ai={ai}
              />
            )}
            <div>
              <h1>
                {matched ? chat.partner?.name : "Random chat"}
                {matched && ai && <span className="random-ai-badge">AI</span>}
              </h1>
              <p>
                <span
                  className={`random-connection-dot${chat.connected ? " is-connected" : ""}`}
                />
                {headerStatus}
              </p>
            </div>
          </div>
          <IonButtons slot="end">
            <IonButton aria-label="Chat options" onClick={() => setMenu(true)}>
              <IonIcon slot="icon-only" icon={ellipsisHorizontal} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        {chat.offer && (
          <div className="random-match-offer" role="status">
            <span className="random-offer-icon">
              <IonIcon icon={peopleOutline} />
            </span>
            <div>
              <strong>A person is ready to chat</strong>
              <p>
                {chat.offer.accepted
                  ? "Waiting for the other person to confirm…"
                  : `Start a fresh conversation · ${offerLeft}s`}
              </p>
            </div>
            <div className="random-offer-actions">
              <button
                disabled={chat.offer.accepted || !!chat.busy || !offerLeft}
                onClick={() =>
                  chat.command("offer", {
                    offerId: chat.offer!.id,
                    accept: true,
                  })
                }
              >
                {chat.offer.accepted ? (
                  <IonSpinner name="crescent" />
                ) : (
                  "Join chat"
                )}
              </button>
              <button
                aria-label="Stay in this AI chat"
                disabled={chat.offer.accepted || !!chat.busy}
                onClick={() =>
                  chat.command("offer", {
                    offerId: chat.offer!.id,
                    accept: false,
                  })
                }
              >
                Stay here
              </button>
            </div>
          </div>
        )}
      </IonHeader>
      <IonContent
        ref={content}
        className="random-content"
        scrollEvents
        onIonScroll={(event) => {
          void content.current?.getScrollElement().then((element) => {
            nearBottom.current =
              element.scrollHeight -
                event.detail.scrollTop -
                element.clientHeight <
              100;
            if (nearBottom.current) setNewMessages(false);
          });
        }}
      >
        <main className="random-shell">
          {chat.notice && (
            <div className="random-notice" role="status">
              <p>{chat.notice}</p>
              <button aria-label="Dismiss notice" onClick={chat.dismissNotice}>
                <IonIcon icon={closeOutline} />
              </button>
            </div>
          )}
          {(chat.phase === "idle" ||
            (chat.phase === "ended" && chat.messages.length === 0)) && (
            <>
              <section className="random-intro">
                <div className="random-intro-art" aria-hidden="true">
                  <span className="random-orbit orbit-one" />
                  <span className="random-orbit orbit-two" />
                  <span className="random-float random-float-one">
                    <IonIcon icon={heartOutline} />
                  </span>
                  <span className="random-float random-float-two">
                    <IonIcon icon={flashOutline} />
                  </span>
                  <span className="random-intro-icon">
                    <IonIcon icon={chatbubbleEllipsesOutline} />
                  </span>
                </div>
                <span className="random-eyebrow">A CONVERSATION AWAY</span>
                <h2>
                  One hello.
                  <br />A new connection.
                </h2>
                <p>
                  Meet someone new, find something in common,
                  <br className="random-wide-break" /> and see where the
                  conversation goes.
                </p>
                <div className="random-ready">
                  <span
                    className={`random-connection-dot${chat.connected ? " is-connected" : ""}`}
                  />
                  {chat.connected
                    ? "Ready when you are"
                    : "Connecting to chat…"}
                </div>
              </section>
              <section className="random-preferences">
                <div className="random-section-heading">
                  <h3>Set the mood</h3>
                  <span>Optional</span>
                </div>
                <label className="random-language">
                  I’d like to chat in
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    aria-label="Preferred language"
                  >
                    <option value="">Any language</option>
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Hinglish">Hinglish</option>
                    <option value="Marathi">Marathi</option>
                    <option value="Telugu">Telugu</option>
                  </select>
                </label>
                <p className="random-field-label">Something you’re into</p>
                <div className="random-interest-chips">
                  {[...new Set([...interests, ...selected])].map((value) => (
                    <button
                      key={value}
                      aria-pressed={selected.includes(value)}
                      onClick={() =>
                        setSelected((old) =>
                          old.includes(value)
                            ? old.filter((item) => item !== value)
                            : old.length < 10
                              ? [...old, value]
                              : old,
                        )
                      }
                    >
                      {selected.includes(value) && <IonIcon icon={checkmark} />}
                      {value}
                    </button>
                  ))}
                </div>
                <input
                  className="random-custom-interests"
                  aria-label="Other interests"
                  placeholder="Other interests, separated by commas"
                  maxLength={400}
                  value={custom}
                  onChange={(event) => setCustom(event.target.value)}
                />
                <label className="random-ai-preference">
                  <span>
                    <IonIcon icon={sparklesOutline} />
                    <strong>Keep the conversation going</strong>
                    <small>
                      Start an AI chat after {chat.fallbackSeconds} seconds if
                      nobody is available.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={allowAi}
                    onChange={(event) => setAllowAi(event.target.checked)}
                    aria-label="AI chat while waiting"
                  />
                </label>
              </section>
              {chat.companions.length > 0 && (
                <button
                  className="random-saved-shortcut"
                  onClick={() => {
                    chat.refreshCompanions();
                    setSavedOpen(true);
                  }}
                >
                  <span>
                    <IonIcon icon={bookmarkOutline} />
                  </span>
                  <div>
                    <strong>Your saved AI chats</strong>
                    <small>Pick up a previous conversation</small>
                  </div>
                  <b>{chat.companions.length}</b>
                  <IonIcon icon={chevronForwardOutline} />
                </button>
              )}
            </>
          )}
          {chat.phase === "waiting" && (
            <section className="random-waiting" role="status">
              <div className="random-radar" aria-hidden="true">
                <i />
                <i />
                <i />
                <span>
                  <IonIcon icon={peopleOutline} />
                </span>
              </div>
              <span className="random-eyebrow">A NEW HELLO IS ON ITS WAY</span>
              <h2>
                Finding your
                <br />
                next conversation
              </h2>
              <p>
                {chat.notice ||
                  (chat.waitStarted && allowAi
                    ? fallbackLeft > 0
                      ? `If nobody is available, AI chat starts in ${fallbackLeft}s.`
                      : "Starting your AI chat…"
                    : "Waiting for someone to join. You can cancel anytime.")}
              </p>
              <div className="random-wait-interests">
                {prefs.interests.slice(0, 4).map((interest) => (
                  <span key={interest}>{interest}</span>
                ))}
              </div>
              {!chat.waitStarted && allowAi && chat.aiAvailable === false && (
                <small>
                  AI chat is unavailable right now. We’ll keep searching for a
                  person.
                </small>
              )}
              <div className="random-wait-tip">
                <IonIcon icon={chatbubbleEllipsesOutline} />
                <p>
                  Try asking:
                  <strong>
                    “What’s the best thing that happened to you this week?”
                  </strong>
                </p>
              </div>
            </section>
          )}
          {matched && ai && (
            <div className="random-ai-context">
              <IonIcon icon={sparklesOutline} />
              <div>
                <strong>
                  Fictional profile
                  {chat.partner?.personaProfile
                    ? ` · ${chat.partner.personaProfile}`
                    : ""}
                </strong>
                <p>
                  {chat.searching
                    ? "Looking for a person while you chat."
                    : "People search is paused."}
                </p>
              </div>
              {!chat.offer && (
                <button
                  disabled={!!chat.busy || !chat.connected}
                  onClick={() =>
                    chat.command("search-people", {
                      searching: !chat.searching,
                    })
                  }
                >
                  {chat.searching ? "Pause search" : "Find a person"}
                </button>
              )}
            </div>
          )}
          {matched && chat.messages.length === 0 && chat.partner && (
            <section className="random-first-hello">
              <Avatar
                name={chat.partner.name}
                color={chat.partner.color}
                ai={ai}
                large
              />
              <h2>You’re connected</h2>
              <p>
                Say hello to <strong>{chat.partner.name}</strong>.
              </p>
              {chat.partner.sharedInterests.length > 0 && (
                <div className="random-wait-interests">
                  {chat.partner.sharedInterests.map((interest) => (
                    <span key={interest}>{interest}</span>
                  ))}
                </div>
              )}
              <small>
                {ai
                  ? "Send the first message when you’re ready."
                  : "A friendly question is a great place to start."}
              </small>
            </section>
          )}
          <div
            className="random-messages"
            role="log"
            aria-label="Chat messages"
            aria-live="polite"
            aria-relevant="additions"
          >
            {chat.messages.map((message, index) => (
              <div key={message.id}>
                {(index === 0 ||
                  dayLabel(message.timeStamp) !==
                    dayLabel(chat.messages[index - 1].timeStamp)) && (
                  <div className="random-day">
                    <span>{dayLabel(message.timeStamp)} · IST</span>
                  </div>
                )}
                <div
                  className={`random-message-row${message.mine ? " is-mine" : ""}`}
                >
                  {!message.mine && (
                    <Avatar
                      name={chat.partner?.name ?? message.sender}
                      color={chat.partner?.color}
                      ai={ai}
                    />
                  )}
                  <div
                    className={`random-bubble${message.status === "failed" ? " is-failed" : ""}`}
                  >
                    <p>{message.content}</p>
                    <div className="random-message-meta">
                      <time dateTime={message.timeStamp}>
                        {formatChatTime(message.timeStamp)}
                      </time>
                      {message.mine &&
                        (message.status === "sending" ? (
                          <IonSpinner name="dots" aria-label="Sending" />
                        ) : message.status === "sent" ? (
                          <IonIcon icon={checkmark} aria-label="Sent" />
                        ) : (
                          <span>Not sent</span>
                        ))}
                    </div>
                    {message.status === "failed" && matched && (
                      <button
                        className="random-retry-message"
                        disabled={!chat.connected}
                        onClick={() => chat.send(message.content, message)}
                      >
                        <IonIcon icon={refreshOutline} />
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {matched && chat.typing && (
            <div
              className="random-typing"
              role="status"
              aria-label={
                ai ? "AI is replying" : `${chat.partner?.name} is typing`
              }
            >
              <span>
                <i />
                <i />
                <i />
              </span>
              <small>
                {ai
                  ? `${chat.partner?.name} is replying`
                  : `${chat.partner?.name} is typing`}
              </small>
            </div>
          )}
          {matched && chat.aiError && (
            <div className="random-reply-error" role="alert">
              <p>{chat.aiError}</p>
              <button
                disabled={!!chat.busy || !chat.connected}
                onClick={() => chat.command("ai/retry")}
              >
                <IonIcon icon={refreshOutline} />
                Retry reply
              </button>
            </div>
          )}
          {matched &&
            chat.messages.filter((message) => message.mine).length === 0 && (
              <div className="random-starters">
                <span>BREAK THE ICE</span>
                {starters.map((text) => (
                  <button
                    key={text}
                    disabled={!canSend || (ai && chat.typing)}
                    onClick={() => submit(text)}
                  >
                    {text}
                    <IonIcon icon={arrowForwardOutline} />
                  </button>
                ))}
              </div>
            )}
          {chat.phase === "ended" && chat.messages.length > 0 && (
            <div className="random-ended">
              <IonIcon icon={checkmarkCircle} />
              <h3>Every hello is a beginning</h3>
              <p>
                {ai && chat.saved
                  ? "Your conversation is saved. Find it in Saved AI chats."
                  : "Ready to meet someone new?"}
              </p>
              {ai && chat.saved && chat.partner?.personaId && (
                <button
                  onClick={() => chat.resume(chat.partner!.personaId!, prefs)}
                  disabled={!chat.connected || !!chat.busy}
                >
                  Chat with {chat.partner.name} again
                </button>
              )}
            </div>
          )}
        </main>
      </IonContent>
      <IonFooter className="random-footer ion-no-border">
        {newMessages && (
          <button className="random-new-messages" onClick={scrollDown}>
            <IonIcon icon={arrowDownOutline} />
            New messages
          </button>
        )}
        <div className="random-footer-inner">
          {matched ? (
            <>
              <div className="random-conversation-actions">
                <button
                  className={`random-keep${(ai && chat.saved) || (!ai && chat.connectionStatus === "CONNECTED") ? " is-saved" : ""}`}
                  disabled={
                    !!chat.busy ||
                    !chat.connected ||
                    (ai
                      ? chat.saved
                      : ["CONNECTED", "REQUEST_SENT"].includes(
                          chat.connectionStatus,
                        ))
                  }
                  onClick={keepInTouch}
                >
                  <IonIcon
                    icon={
                      ai
                        ? chat.saved
                          ? bookmark
                          : bookmarkOutline
                        : chat.connectionStatus === "CONNECTED"
                          ? checkmarkCircle
                          : personAddOutline
                    }
                  />
                  {ai
                    ? chat.saved
                      ? "Chat saved"
                      : "Save chat"
                    : requestLabel}
                </button>
                <button
                  className="random-next"
                  disabled={!!chat.busy || !chat.connected}
                  onClick={() => chat.start(prefs)}
                >
                  Next
                  <IonIcon icon={arrowForwardOutline} />
                </button>
                <button
                  className="random-end"
                  aria-label="End chat"
                  disabled={!!chat.busy || !chat.connected}
                  onClick={chat.end}
                >
                  <IonIcon icon={stopOutline} />
                </button>
              </div>
              <div className="random-composer">
                <textarea
                  ref={composer}
                  aria-label="Message"
                  placeholder="Say something…"
                  rows={1}
                  maxLength={2000}
                  value={input}
                  disabled={!canSend}
                  onChange={(event) => {
                    setInput(event.target.value);
                    chat.writeTyping();
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                />
                <button
                  aria-label="Send message"
                  disabled={!canSend || !input.trim() || (ai && chat.typing)}
                  onClick={() => submit()}
                >
                  <IonIcon icon={send} />
                </button>
              </div>
              {input.length > 1800 && (
                <small className="random-character-count">
                  {input.length}/2000
                </small>
              )}
            </>
          ) : chat.phase === "waiting" ? (
            <button
              className="random-cancel"
              disabled={!chat.connected || chat.busy === "end"}
              onClick={chat.end}
            >
              {chat.busy === "end" ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon icon={closeOutline} />
              )}
              Cancel search
            </button>
          ) : (
            <>
              <button
                className="random-start"
                disabled={!chat.connected || !!chat.busy}
                onClick={() => chat.start(prefs)}
              >
                {chat.busy ? (
                  <IonSpinner name="crescent" />
                ) : (
                  <IonIcon icon={chatbubbleEllipsesOutline} />
                )}
                New chat
                <IonIcon icon={arrowForwardOutline} />
              </button>
              <p className="random-start-note">
                <IonIcon icon={shieldCheckmarkOutline} />
                Be kind. Share only what you’re comfortable with.
              </p>
            </>
          )}
        </div>
      </IonFooter>
      <IonActionSheet
        isOpen={menu}
        header="Chat options"
        onDidDismiss={() => setMenu(false)}
        buttons={menuButtons}
      />
      <IonAlert
        isOpen={report}
        onDidDismiss={() => setReport(false)}
        header={ai ? "Report AI response" : "Report & block"}
        message={
          ai
            ? "Your reason and the last 20 messages will be submitted for review. This ends the chat."
            : "Your reason and the last 20 messages will be submitted for review. This ends the chat and blocks this person."
        }
        inputs={[
          {
            name: "reason",
            type: "textarea",
            placeholder: "What happened?",
            attributes: { maxlength: 500 },
          },
        ]}
        buttons={[
          "Cancel",
          {
            text: "Submit report",
            handler: (data: { reason: string }) => {
              if (!data.reason?.trim()) return false;
              chat.command("report", { content: data.reason });
              return true;
            },
          },
        ]}
      />
      <IonAlert
        isOpen={removePersona !== null}
        onDidDismiss={() => setRemovePersona(null)}
        header="Remove saved chat?"
        message="This deletes the saved conversation. You can start a new AI chat later."
        buttons={[
          "Cancel",
          {
            text: "Remove",
            role: "destructive",
            handler: () => {
              if (removePersona)
                chat.command("companions/remove", { personaId: removePersona });
            },
          },
        ]}
      />
      <IonModal
        isOpen={savedOpen}
        className="random-saved-modal"
        onDidDismiss={() => setSavedOpen(false)}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle>Saved chats</IonTitle>
            <IonButtons slot="end">
              <IonButton
                aria-label="Close saved chats"
                onClick={() => setSavedOpen(false)}
              >
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="random-saved-body">
            <span className="random-saved-label">
              <IonIcon icon={sparklesOutline} />
              AI CHATS
            </span>
            <h2>A familiar hello</h2>
            <p>
              Continue a conversation with a fictional AI character. Your recent
              messages stay with each chat.
            </p>
            {active && (
              <p className="random-saved-hint">
                End your current chat to open a saved chat.
              </p>
            )}
            {chat.companions.length ? (
              chat.companions.map((companion) => (
                <div
                  className="random-companion-card"
                  key={companion.personaId}
                >
                  <Avatar name={companion.name} color={companion.color} ai />
                  <div>
                    <strong>
                      {companion.name}
                      <span>AI</span>
                    </strong>
                    <small>
                      Saved · {formatChatListTime(companion.updatedAt)}
                    </small>
                    <button
                      disabled={
                        active ||
                        !chat.connected ||
                        !!chat.busy ||
                        chat.aiAvailable === false
                      }
                      onClick={() => {
                        chat.resume(companion.personaId, prefs);
                        setSavedOpen(false);
                      }}
                    >
                      Chat again
                      <IonIcon icon={arrowForwardOutline} />
                    </button>
                  </div>
                  <button
                    className="random-remove-companion"
                    aria-label={`Remove ${companion.name}`}
                    disabled={!!chat.busy || !chat.connected}
                    onClick={() => setRemovePersona(companion.personaId)}
                  >
                    <IonIcon icon={trashOutline} />
                  </button>
                </div>
              ))
            ) : (
              <div className="random-no-companions">
                <IonIcon icon={bookmarkOutline} />
                <h3>No saved chats yet</h3>
                <p>
                  Tap Save chat during an AI conversation to return to it later.
                </p>
              </div>
            )}
            {chat.aiAvailable === false && (
              <p className="random-saved-hint">
                AI chat is unavailable right now. Your saved conversations
                remain saved.
              </p>
            )}
          </div>
        </IonContent>
      </IonModal>
    </IonPage>
  );
}
export default function OneTwoOneChat() {
  const { user } = useAuth();
  return (
    <RandomChatContent
      key={user?.publicId ?? "guest"}
      username={user?.username ?? ""}
      initialInterests={user?.interests ?? []}
    />
  );
}
