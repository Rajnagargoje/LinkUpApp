import { Redirect, Route, Switch } from "react-router-dom";
import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from "@ionic/react";
import {
  home,
  mailOutline,
  peopleOutline,
  personCircleOutline,
} from "ionicons/icons";

import HomePage from "./pages/homePage/HomePage";

import ChatPage from "./pages/roomchat/RoomChatPage";
import OneTwoOneChat from "./pages/randomchat/OneTwoOneChat";

import "./AppTabs.scss";
import SettingsPage from "./pages/profile/SettingsPage";
import ProfilePage from "./pages/profile/Me";
import PeoplePage from "./pages/people/PeoplePage";
import FriendsPage from "./pages/friends/FriendsPage";
import PersonDetailPage from "./pages/people/PersonDetailsPage";

import { useRealtimeConnection } from "./hooks/useRealtimeConnection";
import FriendChatPage from "./pages/friends/FriendChatPage";

// NOTE: this component renders *inside* the single top-level
// <IonReactRouter> from App.tsx. It previously mounted its own nested
// <IonApp>/<IonReactRouter>, which meant the app briefly had two
// routers fighting over history — removed as part of the routing
// cleanup.
const AppTabs: React.FC = () => {
  // Opens the shared, authenticated real-time socket for as long as the
  // authenticated app shell is mounted, and cleanly tears it down on
  // logout / unmount.
  useRealtimeConnection();

  return (
    <>
      {/* Pages with tabs */}
      <IonTabs>
        <IonRouterOutlet>
          <Route exact path="/app/home">
            <HomePage />
          </Route>

          <Route exact path="/app/people">
            <PeoplePage />
          </Route>

          <Route exact path="/app/friends">
            <FriendsPage />
          </Route>

          <Route exact path="/app/account">
            <ProfilePage />
          </Route>

          <Route exact path="/app">
            <Redirect to="/app/home" />
          </Route>
        </IonRouterOutlet>

        <IonTabBar slot="bottom" className="main-tab-bar">
          <IonTabButton tab="home" href="/app/home" className="main-tab-button">
            <IonIcon icon={home} />
            <IonLabel>Rooms</IonLabel>
          </IonTabButton>

          <IonTabButton
            tab="search"
            href="/app/friends"
            className="main-tab-button"
          >
            <IonIcon icon={mailOutline} />
            <IonLabel>Messages</IonLabel>
          </IonTabButton>

          <IonTabButton
            tab="series"
            href="/app/people"
            className="main-tab-button"
          >
            <IonIcon icon={peopleOutline} />
            <IonLabel>People</IonLabel>
          </IonTabButton>

          <IonTabButton
            tab="account"
            href="/app/account"
            className="main-tab-button"
          >
            <IonIcon icon={personCircleOutline} />
            <IonLabel>Me</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>

      {/* Chat page */}
      <Route exact path="/app/chatPage">
        <ChatPage />
      </Route>

      {/* Friend-to-friend direct chat */}
      <Route exact path="/app/friend-chat/:conversationId">
        <FriendChatPage />
      </Route>

      {/*ONE TWO ONE Chat page */}
      <Route exact path="/app/randomchat">
        <OneTwoOneChat />
      </Route>
      {/* Settings page */}
      <Route exact path="/app/me/settings">
        <SettingsPage />
      </Route>
      {/* Person detail — opened from the People grid */}
      <Route exact path="/app/person/:personId">
        <PersonDetailPage />
      </Route>
    </>
  );
};

export default AppTabs;
