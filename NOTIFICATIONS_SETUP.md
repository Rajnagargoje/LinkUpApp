# LinkUp notifications and Android push

## Included behavior

- Persistent notification inbox, All/Unread filters, pagination, individual reads and mark-all-read.
- Friend request and accepted-request notifications; unread request count on the Requests segment.
- Direct-message notifications and unread message badges. Reading a conversation clears messages through its read watermark, including matching Android tray entries. Marking the inbox read does not mark a conversation read.
- Report submission/review receipts and administrator announcements. Announcements use the admin-only `POST /api/moderation/announcements` endpoint with explicit recipient IDs.
- Live in-app alerts, reconnect/resume reconciliation, and separate settings for messages, friend activity, updates and push. Message previews are off by default.
- Muted/archived conversations suppress push. Delivery rechecks blocks, reports, account status and read state. Logout detaches the device; notification links are checked against the signed-in account.
- Random-chat messages and public-room messages do not generate individual push alerts. Existing history is not backfilled into notification records.

## Firebase setup

Push is disabled by default; the inbox and live notifications work without Firebase. This implementation targets Android. iOS native push and browser Web Push are not included.

1. Create/select a Firebase project and register an Android app with package name `com.linkup.app`. The Capacitor app ID, Android namespace/application ID and MainActivity Java package already use this value.
2. Download its `google-services.json` into `LinkUpApp/android/app/google-services.json`. This path is ignored by Git. Do not put a service-account private key in the app.
3. Enable the Firebase Cloud Messaging API. Give the backend's Google identity permission to send FCM messages in this project. Prefer an attached workload identity; for local development, store a service-account JSON outside both repositories and set `GOOGLE_APPLICATION_CREDENTIALS` to its absolute path. Never send this key in chat or commit it.
4. Configure the Spring backend with `LINKUP_PUSH_ENABLED=true` and `LINKUP_PUSH_PROJECT_ID=<firebase-project-id>`. Equivalent Spring properties are `linkup.push.enabled=true` and `linkup.push.project-id=<firebase-project-id>`. Restart the backend after credentials are available. A configured but invalid credential setup should be fixed before enabling push for users.
5. Copy `.env.example` to `.env.local` and set `VITE_API_HOST` to an HTTPS backend reachable from the phone. Desktop `localhost` is not the phone's backend. Allow the app's configured Capacitor origin in backend CORS. Rebuild after changing this variable.
6. Run `npm install`, `npm run build`, `npx cap sync android`, then `npx cap open android`. Build/install with Android Studio. Use a device or emulator with Google Play services.
7. Sign in, open Settings → Notifications, and enable notifications. Android 13+ asks for notification permission. If denied, enable it in Android settings. The app creates Messages, Friend activity and Updates channels; Android channel settings can override app preferences.

The backend adds JPA entities/tables `app_notifications`, `notification_preferences` and `push_devices`. Development schema auto-update can create them; production deployments should create reviewed migrations from these entities, including indexes, before enabling the feature. Keep device tokens private. Add retention policies appropriate to the deployment rather than retaining notification/device records indefinitely.

The worker checks for queued pushes every five seconds, retries transient failures up to five attempts and expires jobs older than 24 hours. Invalid or stale device tokens are removed. Delivery is at least once; a stable Android notification tag reduces duplicates. The persisted inbox is the source of truth when push cannot be delivered.

## Device acceptance checks

### Local backend launcher

The local backend defaults to Firebase project `linkup-7898e`. Once its Firebase Admin service-account JSON is saved outside the repositories, start the backend from `linkup-api` with:

```powershell
.\start-with-push.ps1 -CredentialsPath 'C:\path\outside-repo\firebase-admin.json'
```

The launcher validates the credential type and project without printing secrets, enables push for that process and starts Spring Boot. It does not enable push for ordinary backend starts or modify permanent environment settings. Obtain the credential through Firebase Console → Project settings → Service accounts → Firebase Admin SDK → Generate new private key. The Android `google-services.json` cannot authenticate the backend.

Use two registered accounts on separate devices/sessions:

1. Send a friend request. Verify the inbox, bell and Requests badge; open Requests and verify its unseen count clears. Accept and check the sender's notification opens the profile.
2. Send a message with the recipient foregrounded, backgrounded, and after normally closing the app. Check one appropriate alert, accurate unread counts, and tap navigation to the correct conversation. An already visible conversation should become read without an extra in-app toast.
3. Open a tray notification after a cold start and after login. Switch accounts and confirm a notification for the previous account does not open another user's content.
4. Disable previews, mute a conversation, disable categories, block/report the sender, and read messages before the next worker run. Verify the corresponding delivery suppression and generic lock-screen text.
5. Deny OS permission and confirm the inbox still works. Log out and verify subsequent pushes no longer target that session.
6. Submit a report and review it with an administrator; verify both receipt and review update. Test an administrator announcement only with explicit test recipients.

Real FCM delivery requires your Firebase project, credentials and a configured Android build; it has not been verified against a live Firebase project. Android force-stop, disabled channels, connectivity, battery restrictions and OEM policies can prevent or delay delivery. Normally closing the app is different from force-stopping it in Android settings.

## Related home/discovery changes

Home starts with random one-to-one chat, then four official rooms: LinkUp Feedback, Interests Lounge, Language Exchange and Everyday Chat. Each room displays its topic and rules before joining. Blocked users and users reported by the viewer are excluded from discovery; existing friends are also excluded from Nearby. Public-room history remains public to room participants.

## References

- [Capacitor 5 Push Notifications](https://capacitorjs.com/docs/v5/apis/push-notifications)
- [Firebase Admin setup and credentials](https://firebase.google.com/docs/admin/setup)
- [Send messages using Firebase Admin](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk)
- [Android background delivery behavior](https://firebase.google.com/docs/cloud-messaging/android/receive-messages)
