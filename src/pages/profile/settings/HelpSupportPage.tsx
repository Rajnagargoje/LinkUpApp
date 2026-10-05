import { chatbubbleEllipsesOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { SettingsLayout, SettingsLink } from './SettingsLayout';

const questions = [
  ['How do I mute a conversation?', 'Press and hold a friend in your friends list, then choose Mute notifications. Repeat the action to unmute. Messages and unread badges remain available.'],
  ['How do I block or report someone?', 'Open their chat and use the menu in the top-right corner. You can review and unblock people from Settings → Blocked users. Unblocking does not restore a removed friendship.'],
  ['Why are nearby results empty?', 'Check your device location permission and location services. Try refreshing Nearby. People who hide discovery, and accounts hidden by blocks or reports, are excluded.'],
  ['How does my profile QR code work?', 'A friend can scan the code using their phone camera. The link opens a LinkUp invite page and offers an option to open your profile in the app.'],
  ['Why am I not receiving push notifications?', 'Check Settings → Notifications and the notification permission in your phone settings. Muted chats, battery restrictions or a force-stopped app can affect alerts.'],
];
export default function HelpSupportPage() {
  return <SettingsLayout title="Help & support">
    <div className="settings-intro"><span className="settings-eyebrow">WE'RE HERE TO HELP</span><h1>Let's get you sorted.</h1><p>Find a quick answer or send a request to support.</p></div>
    <section className="settings-card"><SettingsLink icon={chatbubbleEllipsesOutline} title="Contact support" description="Send a request and check replies" to="/app/me/settings/contact" /><SettingsLink icon={shieldCheckmarkOutline} title="Privacy request" description="Ask about access, correction or deletion" to="/app/me/settings/contact?category=PRIVACY" /></section>
    <h2 className="settings-section-label">QUICK ANSWERS</h2><section className="settings-card settings-faq">{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section>
  </SettingsLayout>;
}
