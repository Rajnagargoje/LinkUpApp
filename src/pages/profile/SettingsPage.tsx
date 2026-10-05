import { useEffect, useState } from "react";
import { IonIcon } from "@ionic/react";
import { Route, Switch, useHistory } from "react-router";
import {
  banOutline,
  chevronForwardOutline,
  colorPaletteOutline,
  documentTextOutline,
  helpCircleOutline,
  logoInstagram,
  logoTiktok,
  mailOutline,
  notificationsOutline,
  personCircleOutline,
  personOutline,
  qrCodeOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";
import { useLinkUpTheme } from "../../contexts/ThemeContext";
import { SettingsLayout, SettingsLink } from "./settings/SettingsLayout";
import AppearanceSettingsPage from "./settings/AppearanceSettingsPage";
import PrivacySettingsPage from "./settings/PrivacySettingsPage";
import BlockedUsersPage from "./settings/BlockedUsersPage";
import InviteFriendsPage from "./settings/InviteFriendsPage";
import AccountSettingsPage from "./settings/AccountSettingsPage";
import HelpSupportPage from "./settings/HelpSupportPage";
import ContactSupportPage from "./settings/ContactSupportPage";
import LegalSettingsPage from "./settings/LegalSettingsPage";
import { openSettingsLink } from "../../service/inviteService";
import {
  PublicSettings,
  getPublicSettings,
} from "../../service/settingsService";

function SettingsHome() {
  const { user } = useAuth();
  const { preference } = useLinkUpTheme();
  const history = useHistory();
  const [config, setConfig] = useState<PublicSettings | null>(null);
  useEffect(() => {
    let active = true;
    void getPublicSettings()
      .then((value) => {
        if (active) setConfig(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const follow = (url: string) =>
    void openSettingsLink(url).catch(() =>
      toast.error("Unable to open this link."),
    );
  return (
    <SettingsLayout title="Settings" back="/app/account">
      <div className="settings-intro settings-home-intro">
        <span className="settings-eyebrow">YOUR LINKUP</span>
        <h1>A little more you.</h1>
        <p>Make your space feel right.</p>
      </div>
      <div className="settings-profile-card">
        <button
          className="settings-profile-main"
          onClick={() => history.push("/app/me/settings/account")}
        >
          {user?.profilePhoto ? (
            <img src={user.profilePhoto} alt="" />
          ) : (
            <IonIcon icon={personCircleOutline} />
          )}
          <span>
            <strong>@{user?.username}</strong>
            <small>Manage your account</small>
          </span>
          <IonIcon
            className="settings-row-arrow"
            icon={chevronForwardOutline}
          />
        </button>
        <button
          className="settings-profile-qr"
          aria-label="My profile QR code"
          onClick={() => history.push("/app/me/settings/invite")}
        >
          <IonIcon icon={qrCodeOutline} />
        </button>
      </div>
      {!user?.emailVerified && (
        <section className="settings-card settings-verify">
          <SettingsLink
            icon={mailOutline}
            title="Verify your email"
            description="Keep your account details up to date"
            to="/verify-email"
          />
        </section>
      )}
      <h2 className="settings-section-label">YOUR EXPERIENCE</h2>
      <section className="settings-card">
        <SettingsLink
          icon={colorPaletteOutline}
          title="Appearance"
          description={
            preference === "system"
              ? "Following your device"
              : `${preference[0].toUpperCase()}${preference.slice(1)} theme`
          }
          to="/app/me/settings/appearance"
        />
        <SettingsLink
          icon={notificationsOutline}
          title="Notifications"
          description="Messages, friend activity & previews"
          to="/app/notifications/settings"
        />
        <SettingsLink
          icon={qrCodeOutline}
          title="Invite friends"
          description="Your QR code, profile link & sharing"
          to="/app/me/settings/invite"
        />
      </section>
      <h2 className="settings-section-label">PRIVACY & ACCOUNT</h2>
      <section className="settings-card">
        <SettingsLink
          icon={shieldCheckmarkOutline}
          title="Account privacy"
          description="Discovery, activity & message requests"
          to="/app/me/settings/privacy"
        />
        <SettingsLink
          icon={banOutline}
          title="Blocked users"
          description="Review your list and unblock people"
          to="/app/me/settings/blocked"
        />
        <SettingsLink
          icon={personOutline}
          title="Account"
          description="Profile, verification, log out & deletion"
          to="/app/me/settings/account"
        />
      </section>
      <h2 className="settings-section-label">HELP & INFORMATION</h2>
      <section className="settings-card">
        <SettingsLink
          icon={helpCircleOutline}
          title="Help & support"
          description="Answers and support requests"
          to="/app/me/settings/help"
        />
        <SettingsLink
          icon={documentTextOutline}
          title="Terms & conditions"
          to="/app/me/settings/terms"
        />
        <SettingsLink
          icon={shieldCheckmarkOutline}
          title="Privacy policy"
          to="/app/me/settings/privacy-policy"
        />
      </section>
      {(config?.instagramUrl || config?.tiktokUrl) && (
        <>
          <h2 className="settings-section-label">KEEP IN TOUCH</h2>
          <section className="settings-card">
            {config.instagramUrl && (
              <SettingsLink
                icon={logoInstagram}
                title="Follow on Instagram"
                onClick={() => follow(config.instagramUrl)}
              />
            )}
            {config.tiktokUrl && (
              <SettingsLink
                icon={logoTiktok}
                title="Follow on TikTok"
                onClick={() => follow(config.tiktokUrl)}
              />
            )}
          </section>
        </>
      )}
      <footer className="settings-footer">
        <strong>LinkUp</strong>
        <span>Good conversations start here.</span>
      </footer>
    </SettingsLayout>
  );
}
export default function SettingsPage() {
  return (
    <Switch>
      <Route exact path="/app/me/settings/appearance">
        <AppearanceSettingsPage />
      </Route>
      <Route exact path="/app/me/settings/privacy">
        <PrivacySettingsPage />
      </Route>
      <Route exact path="/app/me/settings/blocked">
        <BlockedUsersPage />
      </Route>
      <Route exact path="/app/me/settings/invite">
        <InviteFriendsPage />
      </Route>
      <Route exact path="/app/me/settings/account">
        <AccountSettingsPage />
      </Route>
      <Route exact path="/app/me/settings/help">
        <HelpSupportPage />
      </Route>
      <Route exact path="/app/me/settings/contact">
        <ContactSupportPage />
      </Route>
      <Route exact path="/app/me/settings/terms">
        <LegalSettingsPage kind="terms" />
      </Route>
      <Route exact path="/app/me/settings/privacy-policy">
        <LegalSettingsPage kind="privacy" />
      </Route>
      <Route exact path="/app/me/settings/deletion">
        <LegalSettingsPage kind="deletion" />
      </Route>
      <Route>
        <SettingsHome />
      </Route>
    </Switch>
  );
}
