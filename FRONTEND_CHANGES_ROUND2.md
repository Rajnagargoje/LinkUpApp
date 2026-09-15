# LinkUp Frontend — Round 2 Changes

Everything below matches the backend's "Round 2" work (register-returns-
token, email OTP, photo upload, username-check). See the backend's
`BACKEND_CHANGES.md` for the server side of each item.

## Breaking changes fixed

- **`User` model rebuilt** (`src/common/user.model.ts`) to match the
  backend's actual `UserDTO` exactly: `publicId` (not `id`), all the new
  profile/preference/presence fields, `emailVerified`/`phoneVerified`
  instead of one `verified` boolean. Old fields the backend never
  returned (`phoneNumber`, `isActive`, `isBlocked`, `isDeleted`,
  `provider`, etc.) are gone.
- **`updateStatus` call shape fixed** — now sends `status` as a query
  param (`?status=ONLINE`), not a JSON body, matching what the backend
  actually reads.
- **Password regex tightened** to the exact symbol set the backend
  accepts (`@#$%^&+=!`), and **username minimum length fixed** to 4
  (was 3) — both would previously let the frontend accept input the
  backend would then reject at submit time.

## Register now authenticates immediately

`AuthContext.register()` no longer just creates the account — it applies
the session the same way `login()` does, since `/register` now returns
`{ user, token }` in one call. `register()` also now returns the created
`User` so callers can route based on it without waiting on a state update.

This is why onboarding no longer needs `username`/`email` passed through
`location.state` from SignUpPage — it just reads `useAuth().user`
directly, since the person is authenticated the moment they land there.

## New flow: Register → Verify Email → Onboarding → App

Three route guards now exist instead of one, because each screen in this
chain has different requirements:

| Wrapper | Used for | Rule |
|---|---|---|
| `PublicRoute` | `/`, `/signup` | Bounces already-logged-in users to `/app/home` |
| `AuthOnlyRoute` (new) | `/verify-email` | Just needs a session — works both right after register AND later, reopened from Settings |
| `OnboardingRoute` (new) | `/onboarding` | Needs a session AND `onboardingCompleted: false` — already-onboarded users get redirected to `/app/home` |
| `ProtectedRoute` (updated) | `/app/*` | Needs a session AND `onboardingCompleted: true` — incomplete profiles get redirected to `/onboarding` |

That last one matters: since register hands out a token immediately now,
without this a freshly-registered user could navigate straight to
`/app/home` and skip onboarding entirely just by typing the URL.

### `VerifyEmailPage` (new)
Auto-sends a code on mount, 6-digit input, resend with a 60s countdown
(mirrors the login-lockout pattern already in the app), and a "Skip for
now" that's honest about the tradeoff (no password reset until verified).
Reachable again later from a Settings reminder row if skipped — that
Settings link is the *only* way back once skipped, since nothing else
in the app prompts for it again on its own.

## Onboarding — real submission, not `console.log`

- **Username/email steps removed entirely** — no longer collected here
  since the account already exists by the time onboarding runs.
- **New Photos step** between Bio and Permissions: pick → uploads
  immediately (not batched), per-photo progress, first photo becomes the
  profile photo automatically, remove button calls the delete endpoint
  with an optimistic UI update that rolls back on failure.
- **Location capture wired into the Permissions step** — `requestLocation`
  now actually stores the coordinates from `getCurrentPosition`, not just
  a granted/denied flag.
- **"What are you looking for" changed from multi-select to single-select**
  — the backend's `lookingFor` field is one value, not a list; the
  original UI let you pick several, which had nowhere valid to go. If you
  want multi-select back, that needs a backend model change instead.
- **Finish now does real work**: `PATCH /me` with dob/gender/lookingFor/
  bio/interests, then `POST /users/{username}/location` if permission was
  granted (non-blocking — a location failure doesn't fail the whole flow,
  just shows a toast), then `refreshUser()` so `onboardingCompleted`
  updates before navigating into `/app/home` — otherwise `ProtectedRoute`
  would immediately bounce them right back to `/onboarding`.
- Photos are **not** re-sent in the `PATCH /me` payload — each upload
  already saved itself server-side; including them again would let that
  PATCH overwrite/duplicate what's already there.

## Username availability (SignUpPage)

Debounced (450ms) check as you type, skipped entirely for anything that
couldn't pass validation anyway (no point checking a 2-character name).
Shows a checking/available/taken state inline, and taken usernames show
tappable suggestion chips (server-generated and pre-verified, not guessed
client-side) that fill the field on tap.

## Bug I caught and fixed before shipping this

`uploadPhoto()` originally set `Content-Type: multipart/form-data`
manually on the request. That's wrong — without a `boundary` parameter
(which only the browser can generate), the backend can't parse the body
at all and every upload would silently fail. Fixed by not setting
Content-Type at all and letting the browser/axios set it correctly.

## What's still NOT done

- **`genderPreference`, `minAgePreference`, `maxAgePreference`,
  `maxDistanceKm`** — the backend has these dating-preference fields, but
  onboarding's UI never actually asks for them (it only asks the
  person's own `gender`, not who they want to be matched with). Not
  invented here since it wasn't asked for this round — flagging so it
  doesn't get missed.
- **`Me.tsx`** (profile display page) still doesn't show the new
  bio/photos/interests data — it shows the username correctly (fixed
  earlier) but the rest of the profile view wasn't touched this round.
- Camera-permission step doesn't yet feed into anything (no in-app camera
  capture flow) — photos step currently only supports picking from the
  device's file/photo picker, not taking a new photo directly.
