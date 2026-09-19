import {
  IonAvatar,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonText,
  useIonViewWillEnter,
} from "@ionic/react";

import {
  chatboxOutline,
  personCircleSharp,
  checkmarkOutline,
  closeOutline,
  ellipsisVerticalOutline,
} from "ionicons/icons";

import { useMemo, useState } from "react";
import { useHistory } from "react-router";
import toast from "react-hot-toast";

import Header from "../../header/Header";

import {
  acceptConnectionRequest,
  getFriends,
  getReceivedRequests,
  rejectConnectionRequest,
} from "../../service/connectionService";

import {
  getMyConversations,
  getOrCreateDirectConversation,
} from "../../service/chatService";

import { ConnectionResponse } from "../../common/connection.model";
import { ConversationResponse } from "../../common/chat.model";

import "./FriendsPage.scss";

type FriendsTab = "friends" | "requests";

const FriendsPage: React.FC = () => {
  const history = useHistory();

  const [activeTab, setActiveTab] = useState<FriendsTab>("friends");

  const [friends, setFriends] = useState<ConnectionResponse[]>([]);
  const [requests, setRequests] = useState<ConnectionResponse[]>([]);

  /**
   * Conversations are required for unread counts.
   *
   * Each conversation contains:
   *
   * friendPublicId
   * unreadCount
   * lastMessage
   * etc.
   */
  const [conversations, setConversations] = useState<ConversationResponse[]>(
    [],
  );

  const [searchText, setSearchText] = useState("");

  const [loading, setLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [chatLoadingId, setChatLoadingId] = useState<number | null>(null);

  /**
   * Load accepted friends.
   */
  const loadFriends = async () => {
    try {
      const response = await getFriends();

      setFriends(response.data.data ?? []);
    } catch (error) {
      console.error("Failed to load friends:", error);
    }
  };

  /**
   * Load received friend requests.
   */
  const loadRequests = async () => {
    try {
      const response = await getReceivedRequests();

      setRequests(response.data.data ?? []);
    } catch (error) {
      console.error("Failed to load friend requests:", error);
    }
  };

  /**
   * Load conversations.
   *
   * This is where unreadCount comes from.
   */
  const loadConversations = async () => {
    try {
      const data = await getMyConversations();

      setConversations(data ?? []);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  };

  /**
   * Load complete page data.
   */
  const loadData = async () => {
    try {
      setLoading(true);

      await Promise.all([loadFriends(), loadRequests(), loadConversations()]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Important for unread counts.
   *
   * Ionic pages often stay mounted when navigating.
   *
   * Therefore normal useEffect([]) is not enough.
   *
   * This runs:
   *
   * - first time page opens
   * - when returning from FriendChatPage
   *
   * Example:
   *
   * Rahul unread = 3
   *      ↓
   * open Rahul chat
   *      ↓
   * messages marked read
   *      ↓
   * press back
   *      ↓
   * this executes again
   *      ↓
   * unread = 0
   */
  useIonViewWillEnter(() => {
    void loadData();
  });

  /**
   * Accept friend request.
   */
  const handleAccept = async (connectionId: number) => {
    try {
      setActionLoading(connectionId);

      const response = await acceptConnectionRequest(connectionId);

      const acceptedFriend = response.data.data;

      setRequests((previous) =>
        previous.filter((request) => request.connectionId !== connectionId),
      );

      if (acceptedFriend) {
        setFriends((previous) => [acceptedFriend, ...previous]);
      } else {
        await loadFriends();
      }
    } catch (error) {
      console.error("Failed to accept request:", error);

      toast.error("Could not accept friend request.");
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Reject friend request.
   */
  const handleReject = async (connectionId: number) => {
    try {
      setActionLoading(connectionId);

      await rejectConnectionRequest(connectionId);

      setRequests((previous) =>
        previous.filter((request) => request.connectionId !== connectionId),
      );
    } catch (error) {
      console.error("Failed to reject request:", error);

      toast.error("Could not reject friend request.");
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Friend search.
   */
  const filteredFriends = useMemo(() => {
    const value = searchText.trim().toLowerCase();

    if (!value) {
      return friends;
    }

    return friends.filter((friend) =>
      friend.username?.toLowerCase().includes(value),
    );
  }, [friends, searchText]);

  /**
   * Friend request search.
   */
  const filteredRequests = useMemo(() => {
    const value = searchText.trim().toLowerCase();

    if (!value) {
      return requests;
    }

    return requests.filter((request) =>
      request.username?.toLowerCase().includes(value),
    );
  }, [requests, searchText]);

  /**
   * Find conversation belonging to this friend.
   *
   * ConnectionResponse:
   *
   * friend.userId
   *
   * ConversationResponse:
   *
   * conversation.friendPublicId
   */
  const getFriendConversation = (
    friendPublicId: string,
  ): ConversationResponse | undefined => {
    return conversations.find(
      (conversation) => conversation.friendPublicId === friendPublicId,
    );
  };

  /**
   * Open friend profile.
   */
  const openProfile = (publicId: string) => {
    history.push(`/app/person/${publicId}`);
  };

  /**
   * Open/create direct conversation.
   */
  const openChat = async (friend: ConnectionResponse) => {
    try {
      setChatLoadingId(friend.connectionId);

      const conversation = await getOrCreateDirectConversation(friend.userId);

      /**
       * Keep local conversation data updated.
       *
       * If conversation already exists → replace it.
       *
       * Otherwise → add it.
       */
      setConversations((previous) => {
        const exists = previous.some(
          (item) => item.conversationId === conversation.conversationId,
        );

        if (exists) {
          return previous.map((item) =>
            item.conversationId === conversation.conversationId
              ? conversation
              : item,
          );
        }

        return [...previous, conversation];
      });

      history.push(`/app/friend-chat/${conversation.conversationId}`, {
        conversation,
        friend,
      });
    } catch (error) {
      console.error("Failed to open friend chat:", error);

      toast.error("Could not open this chat.");
    } finally {
      setChatLoadingId(null);
    }
  };

  return (
    <IonPage>
      <Header />

      <IonContent fullscreen>
        <IonSearchbar
          value={searchText}
          onIonInput={(event) => setSearchText(event.detail.value ?? "")}
          placeholder="Search friends"
        />

        <IonSegment
          value={activeTab}
          onIonChange={(event) =>
            setActiveTab(event.detail.value as FriendsTab)
          }
        >
          <IonSegmentButton value="friends">
            <IonLabel>YOUR FRIENDS</IonLabel>
          </IonSegmentButton>

          <IonSegmentButton value="requests">
            <IonLabel>
              FRIEND REQUESTS
              {requests.length > 0 && ` (${requests.length})`}
            </IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {loading ? (
          <div className="friends-loading">
            <IonSpinner name="crescent" />

            <p>Loading...</p>
          </div>
        ) : (
          <>
            {/* ================= FRIENDS ================= */}

            {activeTab === "friends" && (
              <IonList>
                {filteredFriends.length === 0 ? (
                  <div className="friends-empty">
                    <IonIcon icon={personCircleSharp} />

                    <h3>No friends yet</h3>

                    <p>Connect with people nearby to build your friend list.</p>
                  </div>
                ) : (
                  filteredFriends.map((friend) => {
                    /**
                     * Find matching conversation.
                     */
                    const conversation = getFriendConversation(friend.userId);

                    /**
                     * Get unread count.
                     */
                    const unreadCount = conversation?.unreadCount ?? 0;

                    return (
                      <IonItem
                        key={friend.connectionId}
                        lines="none"
                        className="friend-item"
                        button
                        onClick={() => openProfile(friend.userId)}
                      >
                        {/* Profile photo */}

                        <IonAvatar slot="start">
                          {friend.profilePhoto ? (
                            <img
                              src={friend.profilePhoto}
                              alt={friend.username}
                            />
                          ) : (
                            <IonIcon size="large" icon={personCircleSharp} />
                          )}
                        </IonAvatar>

                        {/* Friend information */}

                        <IonLabel>
                          <h2>{friend.username}</h2>

                          <IonText color={friend.online ? "success" : "medium"}>
                            <p>
                              <span
                                className={`status-dot ${
                                  friend.online ? "online" : "offline"
                                }`}
                              />

                              {friend.online ? "Online" : "Offline"}
                            </p>
                          </IonText>
                        </IonLabel>

                        {/* ================= UNREAD BADGE ================= */}

                        {unreadCount > 0 && (
                          <IonBadge
                            slot="end"
                            color="danger"
                            style={{
                              marginRight: "8px",
                            }}
                          >
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </IonBadge>
                        )}

                        {/* ================= ACTIONS ================= */}

                        <IonButtons slot="end">
                          <IonButton
                            fill="clear"
                            disabled={chatLoadingId === friend.connectionId}
                            onClick={(event) => {
                              event.stopPropagation();

                              void openChat(friend);
                            }}
                          >
                            {chatLoadingId === friend.connectionId ? (
                              <IonSpinner name="crescent" />
                            ) : (
                              <IonIcon slot="icon-only" icon={chatboxOutline} />
                            )}
                          </IonButton>

                          <IonButton
                            fill="clear"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <IonIcon
                              slot="icon-only"
                              icon={ellipsisVerticalOutline}
                            />
                          </IonButton>
                        </IonButtons>
                      </IonItem>
                    );
                  })
                )}
              </IonList>
            )}

            {/* ================= REQUESTS ================= */}

            {activeTab === "requests" && (
              <IonList>
                {filteredRequests.length === 0 ? (
                  <div className="friends-empty">
                    <IonIcon icon={personCircleSharp} />

                    <h3>No friend requests</h3>

                    <p>New connection requests will appear here.</p>
                  </div>
                ) : (
                  filteredRequests.map((request) => (
                    <IonItem
                      key={request.connectionId}
                      lines="none"
                      className="friend-item"
                    >
                      <IonAvatar slot="start">
                        {request.profilePhoto ? (
                          <img
                            src={request.profilePhoto}
                            alt={request.username}
                          />
                        ) : (
                          <IonIcon size="large" icon={personCircleSharp} />
                        )}
                      </IonAvatar>

                      <IonLabel>
                        <h2>{request.username}</h2>

                        {request.age && <p>{request.age} years old</p>}

                        <p className="request-text">
                          Wants to connect with you
                        </p>
                      </IonLabel>

                      <IonButtons slot="end">
                        <IonButton
                          color="success"
                          fill="clear"
                          disabled={actionLoading === request.connectionId}
                          onClick={() => handleAccept(request.connectionId)}
                        >
                          <IonIcon slot="icon-only" icon={checkmarkOutline} />
                        </IonButton>

                        <IonButton
                          color="danger"
                          fill="clear"
                          disabled={actionLoading === request.connectionId}
                          onClick={() => handleReject(request.connectionId)}
                        >
                          <IonIcon slot="icon-only" icon={closeOutline} />
                        </IonButton>
                      </IonButtons>
                    </IonItem>
                  ))
                )}
              </IonList>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default FriendsPage;
