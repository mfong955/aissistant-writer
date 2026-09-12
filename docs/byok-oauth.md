# BYOK via OpenRouter OAuth (PKCE)

Implementation spec. Read `AGENTS.md`'s "What's next" #1 first — this replaces the manual
copy-paste API key flow with a one-click connect, for the users who don't touch it already.

**The problem this solves.** BYOK is the default, recommended path (`AGENTS.md` Monetization
strategy) — it costs the project nothing and the user pays no markup. But right now "bring your
own key" means: leave the app, find OpenRouter's key-creation page, generate a key, copy it,
come back, paste it into a password field. That's real friction at exactly the moment onboarding
is designed to minimize friction (the cold-start writer at the blank page). OpenRouter has a
standard OAuth+PKCE connect flow built for this; it's just never been wired up.

---

## 1. Flow

Entirely client-driven PKCE, no server-side session state needed between the redirect out and
the redirect back — the verifier lives in the browser's `sessionStorage` for the few seconds the
round trip takes, the same tab.

1. User clicks "Connect with OpenRouter" on the settings page.
2. Browser generates a random `code_verifier` (128 bytes → base64url), computes
   `code_challenge = base64url(SHA-256(code_verifier))` via `crypto.subtle.digest`, and stores
   the verifier in `sessionStorage`.
3. Redirects to `https://openrouter.ai/auth?callback_url=<app>/openrouter/callback&code_challenge=...&code_challenge_method=S256&key_label=Smartaiss`.
4. User authorizes on OpenRouter's site (existing account or creates one) and is redirected back
   to `/openrouter/callback?code=...`.
5. The callback page reads `code` from the URL and the verifier from `sessionStorage`, and POSTs
   both to `POST /api/settings/api-key/oauth`.
6. That route exchanges them server-side: `POST https://openrouter.ai/api/v1/auth/keys` with
   `{ code, code_verifier, code_challenge_method: "S256" }` → `{ key: "sk-or-v1-..." }`. The
   returned key is encrypted with the existing `encryptApiKey` and stored via
   `dbUpsertUserSettings` — **identical storage path to a manually pasted key**; nothing
   downstream (chat, model listing, billing branch) needs to know or care which path produced it.
7. Callback page redirects to `/settings` with a success/error state.

The exchange itself (step 6) happens server-side, not in the browser: it's a plain fetch to a
public token endpoint (no secret required on our side), but there's no reason to let the raw key
transit through client JS before it's encrypted when routing it through our own API achieves the
same UX with one fewer place a key is ever in the open.

---

## 2. What doesn't change

- `encryptApiKey`/`decryptApiKey`, `dbUpsertUserSettings`, and every consumer of
  `openrouter_api_key_encrypted` (chat route, model listing, the two-track billing branch) are
  untouched. OAuth is a second *way in* to the exact same column.
- The manual paste field on the settings page stays — OAuth is additive, offered first/above it,
  not a replacement. Some users will still want to paste an existing key rather than authorize a
  new one, and OpenRouter's own account may not always be the one they want linked.

## 3. Failure modes handled

- **User denies/cancels on OpenRouter's side** — no `code` in the callback query string; the
  callback page shows an error and a link back to settings, doesn't hang.
- **Verifier missing** (e.g. the callback opened in a different tab/browser than the one that
  started the flow, or `sessionStorage` was cleared) — the exchange can't succeed without it;
  same error treatment, message explains to retry from settings rather than reload the callback
  URL directly.
- **Exchange call fails or OpenRouter returns an error body** — surfaced as the same in-page error
  state, not a raw 500; mirrors the try/catch pattern already used for Stripe checkout
  (`checkout/route.ts`).

Not handled, deliberately: retrying automatically. A failed connect is rare enough (network blip,
denied consent) that sending the user back to settings to click the button again is simpler than
building retry state for it.

---

## 4. Build order

1. `POST /api/settings/api-key/oauth` — server-side code exchange + encrypt + store, reusing
   `encryptApiKey`/`dbUpsertUserSettings`.
2. `/openrouter/callback` page — reads `code`, reads verifier from `sessionStorage`, calls the
   route above, shows success/error, redirects to `/settings`.
3. Settings page: PKCE generation (verifier/challenge, `sessionStorage`) + "Connect with
   OpenRouter" button, placed above the existing manual-paste field.
