# Contact form — setup

The "Send a message" form hides what it collects from casual snoopers and works on
**both** Cloudflare (`karan98.in`, `*.pages.dev`) and the **GitHub Pages** mirror.
It takes two paths automatically:

| | **Cloudflare path** (preferred) | **GitHub Pages fallback** |
|---|---|---|
| Browser → Function | a hybrid-**encrypted** blob `{enc}` | *(no Function on this host)* |
| IP / geo / ISP | derived **server-side** in the Function from `request.cf` (never gathered by the browser; no 3rd-party geo calls) | gathered client-side, then obfuscated |
| Delivery to Apps Script | the Function returns a **sealed** blob (encrypted and signed with `RELAY_SECRET`, which the page never sees); the **browser relays** it to Apps Script as `{sealed}` | browser posts the `{obf}` blob straight to Apps Script |
| Turnstile verified in | the Apps Script (token relayed untouched) | the Apps Script |

> **Why the browser relays it:** Google blocks Cloudflare's Worker egress IPs from
> POSTing to an Apps Script web app (a 401 sign-in page). So the Function does the
> server-only work (decrypt + add IP/geo) and hands a sealed blob back; the
> **browser** — which Google *does* accept — posts it to Apps Script.

Either way the Network tab shows only an **opaque blob**, and the Apps Script logs
every message to a **Google Sheet** and **emails** you.

> **Honesty:** client-side JS is public, so the GitHub Pages fallback's obfuscation
> defeats only *casual* inspection. The Cloudflare path is real encryption on both
> hops: the `browser→Function` hop is RSA-encrypted, and the relayed blob is sealed with
> `RELAY_SECRET`, held only by the Function and the Apps Script (section 4), so nothing in
> the page decodes the IP/geo/ISP the Function adds. Until `RELAY_SECRET` is set on
> Cloudflare, the relayed blob is the older obfuscated one, readable with `OBF_KEY`.

---

## Secrets & keys at a glance
| Name | Where it lives | Public? |
|---|---|---|
| Turnstile **site key** | `assets/js/data.js` | yes (by design) |
| Turnstile **secret key** | Apps Script property `TURNSTILE_SECRET` (verifies both paths) | no |
| RSA **public key** | `assets/js/data.js` (`contact.publicKey`), and a copy in `assets/js/urlshort.js` (`SITE_KEY`): the link shortener seals its requests with it too | yes (by design) |
| RSA **private key** | Cloudflare Function env `PRIVATE_KEY` — the **only** env var it needs; the link shortener's Function opens its sealed requests with it too | **no** |
| `OBFUSCATION_KEY` | `OBF_KEY` in `app.js`, the Function, and Apps Script property (same value): the GitHub Pages fallback, and the Function's relay until `RELAY_SECRET` is set | yes-ish (obscurity) |
| `RELAY_SECRET` | Cloudflare secret on this project, and Apps Script property (same value): seals the Function's relay (section 4) | **no** |
| `RELAY_SECRET_PREVIOUS` | Apps Script property, only while `RELAY_SECRET` is being rotated (section 4) | **no** |
| `ICTD_WHITELIST` | Apps Script property only (the Odisha forest map's sign-in, below) | **no** |
| `ICTD_GATE_SECRET` | Apps Script property, and the map's Cloudflare env `ICTD_GATE_SECRET` (same value) | **no** |
| `PHD_WHITELIST` | Apps Script property only (the PhD explorer's sign-in, below) | **no** |
| `PHD_GATE_SECRET` | Apps Script property, and the explorer's Cloudflare env `PHD_GATE_SECRET` (same value, not ICTD's) | **no** |
| `URLSHORT_KEY` | Cloudflare secret on this project: the link shortener's owner key ([`URLSHORT_SETUP.md`](URLSHORT_SETUP.md)) | **no** |
| `URLSHORT_WHITELIST` | Apps Script property only: the addresses allowed to make short links | **no** |
| `URLSHORT_GATE_SECRET` | Apps Script property, and a Cloudflare secret on this project (same value, not ICTD's or PhD's): signs the shortener's email passes and its log key | **no** |

> The Function reads only **`PRIVATE_KEY`** and **`RELAY_SECRET`** now. The old `TURNSTILE_SECRET` /
> `APPS_SCRIPT_URL` / `SHARED_SECRET` Cloudflare env vars are **unused** (harmless to
> leave, safe to delete) — Turnstile is verified in Apps Script and delivery goes
> through the browser, so the Function never calls Apps Script.

The RSA keypair for this site is already generated — the **public** key is committed
in `data.js`; the **private** key was handed over separately to paste into the
Cloudflare `PRIVATE_KEY` env var. To rotate it, generate a new pair (Web Crypto
`RSA-OAEP`, 2048, SHA-256; export public as SPKI base64, private as PKCS8 base64), then, in
this order:
1. Set the new `PRIVATE_KEY` in Cloudflare. The live deployment keeps the old one until the
   next deployment, so nothing breaks yet.
2. Straight away, push one commit that puts the new public key in **both** `data.js`
   (`contact.publicKey`) and `assets/js/urlshort.js` (`SITE_KEY`). Its deployment is the first
   with both new halves.
3. If the secret was set after that deployment started, retry it (**Deployments → ⋯ → Retry
   deployment**). Until both halves match, the link shortener answers "Something went wrong on
   the server" to every new link, while the contact form quietly uses its fallback path. A tab
   left open from before needs a reload.

---

## 1. Cloudflare Turnstile
1. Cloudflare dashboard → **Turnstile** → your widget (Site Key `0x4AAAAAADsvK3etT1iNEaDP`).
2. **Hostnames** — include every domain the form runs on: `karan98.in`,
   `sudo-karan.github.io`, and your `*.pages.dev` host.
3. Copy the widget's **Secret Key**.

## 2. Google Sheet + Apps Script
1. Create a Google **Sheet** (your submissions log).
2. **Extensions → Apps Script** → replace the contents with
   [`functions/apps-script/Code.gs`](functions/apps-script/Code.gs).
3. **Project Settings → Script properties** → add:
   - `TURNSTILE_SECRET` — the Turnstile secret key (used on the GitHub-Pages path).
   - `RECIPIENT` — `jaskaran.pta@gmail.com`.
   - `SHARED_SECRET` — any long random string; **must match** the Cloudflare env below.
   - `OBFUSCATION_KEY` — *(optional)* must match `OBF_KEY` in `app.js`; if omitted,
     the built-in default in `Code.gs` (which matches `app.js`) is used.
   - `RELAY_SECRET` — opens the Function's sealed relay; **must match** the Cloudflare
     secret of the same name, and is set here first. See section 4.
   - `OTP_DAILY_CAP` — *(optional)* max verification codes emailed per day (default
     **85**); the rest of Gmail's ~100/day stays reserved for message notifications.
   - `SHEET_ID` — *(optional)* the Sheet id; omit to use the bound Sheet.
   - `ICTD_WHITELIST` — the addresses allowed into the Odisha forest map, comma- or
     newline-separated, compared lower-case. See the last section.
   - `ICTD_GATE_SECRET` — a long random string; **must match** the map's Cloudflare
     env `ICTD_GATE_SECRET`. See the last section.
   - `PHD_WHITELIST` — the addresses allowed into the PhD explorer, comma- or
     newline-separated, compared lower-case. See the last section.
   - `PHD_GATE_SECRET` — another long random string, not the map's; **must match** the
     explorer's Cloudflare env `PHD_GATE_SECRET`. See the last section.
   - `URLSHORT_WHITELIST`, `URLSHORT_GATE_SECRET` and the optional `URLSHORT_PASS_HOURS` and
     `URLSHORT_TAB_ROWS` —
     for the link shortener's makers and its log; see [`URLSHORT_SETUP.md`](URLSHORT_SETUP.md)
     (which also has you run `installShortLinkSync` once).
4. **Deploy → New deployment → Web app** — *Execute as:* **Me**, *Who has access:*
   **Anyone** → run `doPost` once, **Allow** all permissions → copy the **`/exec`** URL.

## 3. Cloudflare Pages env vars
Cloudflare Pages → your project → **Settings → Environment variables** (Production
**and** Preview):
- `PRIVATE_KEY` — the RSA private key (PKCS8 base64) handed over separately.
- `RELAY_SECRET` (type **Secret**) — the same value as the Apps Script property. Set it
  only once the Apps Script side is live: see section 4.
- `TURNSTILE_SECRET` — the Turnstile secret key.
- `APPS_SCRIPT_URL` — the `/exec` URL from step 2.
- `SHARED_SECRET` — the same value as the Apps Script property.

Then **redeploy** so the Function (`functions/api/contact.js`) picks them up. The
Function auto-routes to `/api/contact` (Pages convention); `wrangler.toml` already
declares the project so `functions/` compiles.

> Editing `Code.gs` later? Re-deploy: **Manage deployments → ✏️ edit → Version:
> New version → Deploy**. **After a columns change**, if the Sheet already holds an
> older header row, **clear the Sheet once** (select all → delete) so the new,
> wider header is written fresh. A single `FIELDS` list in `Code.gs` drives both the
> Sheet columns and the email, so they always match.

## 4. Sealed relay (`RELAY_SECRET`)
The Function hands the browser the record it has enriched (the message, plus the IP
address, place and ISP that Cloudflare sees) for the browser to post to the Apps Script.
With `RELAY_SECRET` set on both sides, that blob is **sealed**: encrypted and signed with
keys derived from a secret the page never sees. DevTools then shows only
`{"ok":true,"sealed":"…"}`, which nothing in the page decodes. The browser can't change it
either: the Apps Script refuses a blob whose signature doesn't match. Without
`RELAY_SECRET` on Cloudflare, the Function sends the older `relay`, which anyone can decode
with `OBF_KEY` from `app.js`.

**Set it up once, in this order:**
1. Make the secret: `openssl rand -hex 32`. Keep it out of the repository and the page.
2. **The Apps Script first.** Paste this `Code.gs`, add the Script Property `RELAY_SECRET`
   with the value, then **Deploy → Manage deployments → ✏️ Edit → Version: New version →
   Deploy** (the `/exec` URL stays the same). This `Code.gs` still takes the older `{obf}`
   relay, so nothing changes yet.
3. **Then Cloudflare.** **Workers & Pages → sudo-karan-github-io → Settings → Variables and
   Secrets → Add**, type **Secret**, name `RELAY_SECRET`, the same value, for
   **Production** (and **Preview**, if you test the form on previews). Then redeploy: merge
   the pull request, or **Deployments → ⋯ → Retry deployment** if it is merged already. A
   secret reaches the Function only with the next deployment. (From a terminal:
   `npx wrangler pages secret put RELAY_SECRET --project-name sudo-karan-github-io`, then
   redeploy the same way.)
4. **Check it.** On karan98.in, with DevTools → Network open, send yourself a message. The
   answer from `/api/contact` is `{"ok":true,"sealed":"…"}`, with no `relay`; the POST to
   `script.google.com` carries `{"sealed":"…"}`; the row and the email arrive as before.

Merging the pull request before steps 2 and 3 is safe: until Cloudflare has
`RELAY_SECRET`, the Function keeps sending the older relay, which every `Code.gs` takes.

**Never set it on Cloudflare first.** An older `Code.gs`, or one without the property,
can't open `{sealed}`, so the message is dropped, while the sender still sees "Message
sent": the browser posts it without reading the Apps Script's answer. This `Code.gs`
emails `RECIPIENT` when a sealed relay doesn't open (at most once every 6 hours; anyone can
post a made-up one, so one such email alone may be noise), and logs an error on the Apps
Script's **Executions** page each time.

**Rotate it** if it may have leaked, or now and then:
1. Make a new value: `openssl rand -hex 32`.
2. In the Apps Script's Script properties, copy the current `RELAY_SECRET` into a new
   property `RELAY_SECRET_PREVIOUS`, then set `RELAY_SECRET` to the new value. Properties are
   read on every request, so this needs no new deployment, and the script now opens relays
   sealed with either value.
3. In Cloudflare, set `RELAY_SECRET` to the new value and retry the latest deployment.
4. Send a test message. Once it arrives, delete `RELAY_SECRET_PREVIOUS`.

Step 2 must come before step 3, or the messages sent in between are dropped. Whoever has
an old secret can read the relays sealed with it that they captured, so rotating protects
the messages that come after it.

**The format** (`seal()` in `functions/api/contact.js`, `openSealed()` in `Code.gs`).
Apps Script has HMAC-SHA256 but no AES or RSA, so the cipher is built from HMAC:
- Keys: HKDF-SHA256 over `RELAY_SECRET` (whitespace around it trimmed, as UTF-8), salt
  `karan98.in contact relay`; `kEnc` with info `v1 enc` and `kMac` with info `v1 mac`, 32
  bytes each.
- A random 16-byte nonce for each message. Keystream block *i* =
  HMAC-SHA256(`kEnc`, nonce ‖ *i* as 4 bytes, big-endian); the ciphertext is the UTF-8 JSON
  XOR the keystream.
- Tag = HMAC-SHA256(`kMac`, `0x01` ‖ nonce ‖ ciphertext): encrypt-then-MAC. The Apps
  Script compares it in constant time before decrypting anything.
- `sealed` = base64(`0x01` ‖ nonce ‖ ciphertext ‖ tag).

`tests/contact-relay.test.mjs` runs the real Function and the real `Code.gs`: the round
trip, tampered blobs refused, the older relay still taken, rotation, and a second
implementation written from this description. Run it with `node --test "tests/*.test.mjs"`
(Node 22 or later, nothing to install).

---

## Verify
- **On karan98.in** (Cloudflare): open DevTools → Network, submit the form. The POST
  to `/api/contact` should carry only an opaque `{enc:{k,iv,ct}}` — **no** readable
  fields/meta, and **no** request to `ipwho.is`. Its answer is `{ok, sealed}`, and the
  relay to `script.google.com` is `{sealed}`; a `relay` field instead means Cloudflare
  doesn't have `RELAY_SECRET` yet (section 4). A row appears in the Sheet with the
  full field set including server-derived **IP / city / ISP / ASN / colo**; an email
  arrives at `RECIPIENT`.
- **On sudo-karan.github.io** (mirror): the POST goes straight to the Apps Script as
  an opaque `{obf}` blob (IP/geo gathered client-side); the row + email still land.
- A bot that can't solve Turnstile is rejected (no row, no email).
- The form degrades gracefully: if the Function is unreachable it falls back to the
  obfuscated direct path (it only avoids that when the Turnstile token was already
  spent, to prevent a double-verify failure).

> **What can't be captured:** Apple hides the exact iPhone/iPad model, and iOS
> Safari/Firefox don't expose User-Agent Client Hints, so device-model / OS-version /
> CPU-arch come through blank there — everything else still lands. Chromium browsers
> (Chrome/Edge/Android) fill the most. On the Cloudflare path, IP/geo/ISP always land
> (from the edge) regardless of browser.

---

## Email verification (OTP) & typo-catch

The form offers **optional** email verification. After a visitor hits Send, a popup
asks whether to verify their email via a 6-digit code (or send without). It reuses
**your Gmail** (no new service) via JSONP calls to the Apps Script `/exec`:

- **Send/verify:** `doGet(action=send-otp|verify-otp)` — a code is emailed, held for
  10 min in `CacheService`, max 5 tries. Up to **3 codes per email per hour** (1 send
  + 2 resends); the popup shows a live "N left" counter, then a ~1-hour cooldown
  message with the remaining minutes.
- **Server-authoritative badge:** `OTP-verified` comes from Apps Script's own `ver_`
  cache — never the browser's claim, so it can't be faked. The "a code was sent"
  fact is recorded against a **per-submission flow id** (`fs_<flow>`), not the email,
  so a code from an *earlier* attempt on the same address can't bleed into a later
  message where the sender simply chose not to verify. `doPost` stamps the
  **"Email verified"** column with one of these:
  - `OTP-verified ✅` — code confirmed.
  - `OTP sent, not verified ⚠️` — a code **was emailed in this flow but never
    confirmed** (the sender skipped it). Floored by the server's own `fs_` marker for
    that flow, so an honest client that sent a code can't have it silently dropped.
  - `OTP limit reached, not verified ⚠️` — the sender used all 3 codes for the hour
    without confirming.
  - `Too many wrong attempts, not verified ⚠️` — the sender entered the wrong code
    too many times.
  - `Verification unavailable ⚠️` — a code couldn't be sent (quota/outage), not the
    sender's fault.
  - `Not verified` — the sender chose not to verify at all.
- **Daily cap:** at most `OTP_DAILY_CAP` (default **85**) codes/day, and OTP always
  leaves **>15** of Gmail's daily quota free — your message notifications can never be
  starved. When the cap is hit, the popup says verification is delayed and lets the
  visitor send without it.
- **Typo-catch:** an always-on, client-only hint under the email field ("Did you mean
  **gmail.com**?") for common domain misspellings — no backend.
- **Failure fallback:** if a send fails, the visitor gets an **Open-in-email-app**
  button (pre-loads name/subject/message only — no metadata) and a **Copy message**
  button.

**Setup:** just re-paste `Code.gs` and redeploy a new version (adds `doGet` OTP
handlers + the "Email verified" column). Optionally set the `OTP_DAILY_CAP` property.
Clear the Sheet once so the new column header writes fresh. No new accounts or keys.

---

## The Odisha forest map's sign-in (`app=ictd`)

The map (repository `sudo-karan/ICTD_Project`, its own Cloudflare Pages project) opens
only for addresses on a whitelist. Its sign-in page uses this same `/exec`, by JSONP from
the browser, with `app=ictd` on both actions. **Without `app=ictd` nothing changes for
the contact form.**

| | Contact form | `app=ictd` |
|---|---|---|
| Who gets a code | any address | only an address in `ICTD_WHITELIST`; any other gets `{sent: false, reason: "not-listed"}` and no e-mail |
| Answer to a right code | `{verified: true}` | `{verified: true, token}`, if the address is still on the list |
| Codes and hourly limit (3 per address) | its own | the map's own (cache keys start `ictd_`); a code for one never works for the other |
| Daily cap (`OTP_DAILY_CAP`) | shared | shared: both spend the same Gmail quota |
| E-mail subject | names karan98.in | names the map |

**Why a token:** Google refuses calls from Cloudflare's servers, so the browser carries the
answer back to the map's Function, and an answer the browser carries proves nothing unless
it is signed. The token is `base64url(JSON {email, exp})` + `.` +
`base64url(HMAC-SHA256(ICTD_GATE_SECRET, payload))`: `payload` is the text before the dot,
`base64url` has no padding, and `exp` is in seconds, 10 minutes ahead.

**Setup:** add `ICTD_WHITELIST` and `ICTD_GATE_SECRET` (`openssl rand -hex 32`) as script
properties, re-paste `Code.gs`, and deploy a new version of the existing deployment so the
`/exec` URL stays the same. No new permissions are needed. With either property missing,
nobody gets a code for the map (`not-listed`, `not-set-up`).

---

## The PhD explorer's sign-in (`app=phd`)

The PhD Forest Stand Explorer (repository `sudo-karan/phd-code`, its own Cloudflare Pages
project) opens only for addresses on a whitelist of its own. Its sign-in page uses this
same `/exec`, by JSONP from the browser, with `app=phd` on both actions. **Without
`app=phd` nothing changes for the contact form or the map.**

| | Contact form | `app=ictd` | `app=phd` |
|---|---|---|---|
| Who gets a code | any address | only an address in `ICTD_WHITELIST` | only an address in `PHD_WHITELIST` |
| Answer to `send-otp` | `{sent: true}` | `{sent: false, reason: "not-listed"}` to an address not on the list | `{ok: true, remaining}` to every address the limits allow, listed or not; it doesn't say who is listed |
| Answer to a wrong code | `wrong`, then `too-many` | `not-listed` to an address not on the list | `wrong`, then `too-many`, listed or not |
| Answer to a right code | `{verified: true}` | `{verified: true, token}` | `{verified: true, token}`, the token's claim carrying `aud: "phd"` |
| Time taken by `send-otp` | as long as it takes | as long as it takes | always `PHD_ANSWER_MS` (4 s) from the request |
| Codes and hourly limit (3 per address) | its own | the map's own (`ictd_`) | the explorer's own (`phd_`); a code for one never works for another |
| Daily cap (`OTP_DAILY_CAP`) | shared | shared | shared |
| E-mail subject | names karan98.in | names the map | names the PhD Forest Stand Explorer |

The token is built as the map's is (above), over `{email, exp, aud: "phd"}` and signed
with `PHD_GATE_SECRET`. The explorer's Function takes no token or cookie without
`aud: "phd"`, so the map's tokens and cookies don't open it, and being on `ICTD_WHITELIST`
gets nobody in.

**Setup:** add `PHD_WHITELIST` and `PHD_GATE_SECRET` (`openssl rand -hex 32`; not the
same as `ICTD_GATE_SECRET`, or nobody gets in) as script properties, re-paste `Code.gs`,
and deploy a new version of the existing deployment so the `/exec` URL stays the same. No
new permissions are needed. Adding or taking off an address later needs no new
deployment: the list is read on every request.
