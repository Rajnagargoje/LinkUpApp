import React, { useState } from "react";
import {
  IonButton,
  IonInput,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonToast,
  IonIcon,
} from "@ionic/react";
import { closeOutline, enterOutline, addCircleOutline } from "ionicons/icons";

import "./JoinCreateRoom.scss";
import { useAuth } from "../../contexts/AuthContext";

interface RoomData {
  username: string;
  roomId: string;
}

interface JoinCreateRoomProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (data: RoomData) => void;
  onCreateRoom: (data: RoomData) => void;
}

const JoinCreateRoom: React.FC<JoinCreateRoomProps> = ({
  isOpen,
  onClose,
  onJoinRoom,
  onCreateRoom,
}) => {
  const { user } = useAuth();
  // Room chat now always sends messages as the logged-in user (see
  // RoomChatPage, which trusts the auth context over this value) — this
  // field is pre-filled and locked so nobody can pose as someone else.
  const [username, setUsername] = useState(user?.username ?? "");
  const [roomId, setRoomId] = useState("");

  React.useEffect(() => {
    if (user?.username) setUsername(user.username);
  }, [user?.username]);

  // Toast states
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Show toast message
  const showErrorToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };

  // Username validation
  const validateUsername = () => {
    const usernameValue = username.trim();

    if (!usernameValue) {
      showErrorToast("Please enter your username");
      return false;
    }

    if (usernameValue.length < 3) {
      showErrorToast("Username must be at least 3 characters");
      return false;
    }

    if (usernameValue.length > 20) {
      showErrorToast("Username cannot exceed 20 characters");
      return false;
    }

    return true;
  };

  // Room ID validation
  const validateRoomId = () => {
    const roomValue = roomId.trim();

    if (!roomValue) {
      showErrorToast("Please enter Room ID");
      return false;
    }

    if (roomValue.length < 3) {
      showErrorToast("Room ID must be at least 3 characters");
      return false;
    }

    if (roomValue.length > 20) {
      showErrorToast("Room ID cannot exceed 20 characters");
      return false;
    }

    return true;
  };

  // JOIN ROOM
  const handleJoinRoom = () => {
    // Validate username
    if (!validateUsername()) {
      return;
    }

    // Validate room ID
    if (!validateRoomId()) {
      return;
    }

    // Send data to Home
    onJoinRoom({
      username: username.trim(),
      roomId: roomId.trim(),
    });
  };

  // CREATE ROOM
  const handleCreateRoom = () => {
    // Username is required
    if (!validateUsername()) {
      return;
    }

    // Room ID is optional for creating room
    onCreateRoom({
      username: username.trim(),
      roomId: roomId.trim(),
    });
  };

  return (
    <>
      <IonModal
        isOpen={isOpen}
        onDidDismiss={onClose}
        id="example-modal"
        className="room-modal"
      >
        <IonHeader className="room-modal-header">
          <IonToolbar className="room-modal-toolbar">
            <IonTitle>Join or create a room</IonTitle>

            <IonButtons slot="end">
              <IonButton
                className="room-modal-close"
                onClick={onClose}
                aria-label="Close"
              >
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent className="room-modal-content ion-padding">
          <p className="room-modal-copy">
            Join an existing room by its ID, or create a new one.
          </p>

          {/* USERNAME — locked to the logged-in account so people can't
              send room messages under someone else's name. */}
          <IonInput
            className="room-input"
            value={username}
            fill="outline"
            labelPlacement="floating"
            label="Username"
            placeholder="e.g. abc123"
            maxlength={20}
            disabled
            readonly
          />

          {/* ROOM ID */}
          <IonInput
            className="room-input ion-margin-top"
            value={roomId}
            labelPlacement="floating"
            fill="outline"
            label="Room ID"
            placeholder="e.g. ptg"
            maxlength={20}
            onIonInput={(e) => setRoomId(e.detail.value ?? "")}
          />

          <div className="room-modal-actions">
            {/* JOIN ROOM */}
            <IonButton
              className="room-cta room-cta--primary"
              expand="block"
              shape="round"
              onClick={handleJoinRoom}
            >
              <IonIcon slot="start" icon={enterOutline} />
              Join Room
            </IonButton>

            {/* CREATE ROOM */}
            <IonButton
              className="room-cta room-cta--secondary"
              expand="block"
              shape="round"
              fill="outline"
              onClick={handleCreateRoom}
            >
              <IonIcon slot="start" icon={addCircleOutline} />
              Create Room
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      {/* TOAST */}
      <IonToast
        isOpen={showToast}
        message={toastMessage}
        duration={2500}
        position="bottom"
        color="dark"
        onDidDismiss={() => setShowToast(false)}
      />
    </>
  );
};

export default JoinCreateRoom;
