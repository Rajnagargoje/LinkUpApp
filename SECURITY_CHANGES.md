# LinkUp — Security, Auth & Real-Time Changes

Everything below was added/changed on top of your project. Nothing in your
UI design, colors, or screen layouts was touched — only auth, routing,
sessions, and the real-time chat plumbing.

## 1. New files

| File | What it does |
|---|---|
| `src/config/api.config.ts` | **Single place** for API base URL, WebSocket URL, endpoint paths, and the password policy regex. Edit this file if any backend route differs. |
| `src/service/tokenStorage.ts` | Stores/reads the JWT + user, decodes the JWT to check expiry (no network call needed). |
| `src/service/socketService.ts` | One shared, authenticated STOMP/SockJS connection reused by every chat screen instead of each screen opening its own socket. |
| `src/hooks/useRealtimeConnection.ts` | Opens the socket when logged in, closes it on logout, tracks a live "who's online" presence set. |
| `src/contexts/AuthContext.tsx` | The core of the app: `login`, `register`, `logout`, `deleteAccount`, session bootstrap, auto-logout on 401/403 or expiry, multi-tab sync. |
| `src/routes/ProtectedRoute.tsx` | Blocks `/app/*` from anyone not logged in. |
| `src/routes/PublicRoute.tsx` | Blocks `/`, `/signup`, `/onboarding` from anyone already logged in. |
| `src/components/SplashScreen.tsx` | Loading screen shown for the split-second the app is validating a stored session, so you never see a flash of the wrong screen. |

## 2. Rewritten files

- **`axiosClient.ts`** — unified on `Authorization: Bearer <token>` (was
  mixing a raw `token` header with manual `Bearer` in one place). Fixed a
  bug where 401 responses were silently swallowed instead of rejected, so
  callers' `catch` blocks never ran.
- **`userService.ts`** — real `login`/`register` matching your exact API
  response shapes, plus `getMe`, `logout`, `deleteAccount`, `updateStatus`.
- **`App.tsx`** — wraps the app in `AuthProvider`, adds the splash screen,
  and routes `/`, `/signup`, `/onboarding` through `PublicRoute` and `/app`
  through `ProtectedRoute`.
- **`AppTabs.tsx`** — removed a bug where it mounted a *second*
  `<IonReactRouter>` nested inside the one in `App.tsx` (two routers
  fighting over history). Now opens the real-time connection for the
  session via `useRealtimeConnection()`.
- **`LoginPage.tsx` / `SignUpPage.tsx`** — real forms wired to the API
  (previously just faked a 2s delay and pushed you into the app). Sign-up
  validates a password policy matching your `Pass@123` example and sends
  new users into the onboarding flow you built.
- **`SettingsPage.tsx`** — "Log out" and "Delete account" are now real,
  each behind a confirmation alert.
- **`RoomChatPage.tsx`** — switched from opening its own throwaway,
  unauthenticated socket to the shared authenticated one. Also fixed a
  dead import (`../menu/pages/MyProfile`, a folder that didn't exist,
  which would have failed the build).
- **`OneTwoOneChat.tsx`**, **`Me.tsx`**, **`JoinCreateRoom.tsx`** —
  swapped the hardcoded `"Ganesh"` username for the real logged-in user.
- **`OnboardingPage.tsx`** (your file) — now receives the username/email
  from sign-up, skips re-asking for them, and locks "back" from wandering
  into fields that must match the account that was just created.

## 3. Endpoints I had to guess

Your message only gave me `/user/register` and `/user/login`. Everything
else routes through `src/config/api.config.ts`, and here's what to check
against your Spring backend:

```ts
logout: "/user/logout",        // POST, best-effort
deleteAccount: "/user/me",     // DELETE
updateStatus: "/user/status",  // PATCH { status }
me: "/details",                // GET current user (was already in your code)
```

The WebSocket endpoint is assumed to be `http://localhost:8081/chat`
(matches what was already in `RoomChatPage.tsx`), with the JWT sent as an
`Authorization` STOMP CONNECT header — confirm your backend's
`ChannelInterceptor` actually reads it from there.

## 4. Known gap / your call

`OnboardingPage.finishOnboarding()` currently just shows a toast and sends
the user to login, because `/user/register` doesn't return a token, so
there's no session yet to attach the collected profile data (dob, gender,
interests, bio, permissions) to. Once you add a "save profile" endpoint
and the user is logged in, that's a one-line `axiosClient.patch(...)` call
— the data is already fully shaped in `data`/`permissions`.

## 5. Production hardening notes (not yet done, flagging for you)

- Token is stored in `localStorage` (readable by any JS on the page). For
  a hardened mobile build, swap `tokenStorage.ts`'s get/set/clear for
  `@capacitor/preferences` — every other file reads through that one
  module, so nothing else would need to change.
- No CSRF concern for a bearer-token API, but make sure your backend
  actually validates the JWT signature + expiry server-side on every
  request — the client-side expiry check here is only for UX (auto-logout
  before a request fails), never trust it for authorization.
