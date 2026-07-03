# Contact form — setup

The "Send a message" form hides what it collects from casual snoopers and works on
**both** Cloudflare (`karan98.in`, `*.pages.dev`) and the **GitHub Pages** mirror.
It takes two paths automatically:

| | **Cloudflare path** (preferred) | **GitHub Pages fallback** |
|---|---|---|
| Browser sends | a hybrid-**encrypted** blob `{enc}` | an **obfuscated** blob `{obf}` |
| IP / geo / ISP | derived **server-side** in the Function (never leaves the browser; no 3rd-party geo calls) | gathered client-side, then obfuscated |
| Turnstile verified in | the Cloudflare Function | the Apps Script |
| Then | Function decrypts + forwards to Apps Script | posts straight to Apps Script |

Either way the Network tab shows only an **opaque blob**, and the Apps Script logs
every message to a **Google Sheet** and **emails** you.

> **Honesty:** client-side JS is public, so this defeats *casual* inspection, not a
> determined reverse-engineer (they can read the source and breakpoint before the
> payload is encrypted). The Cloudflare path is the strong one — IP/geo/ISP are
> genuinely absent from the browser. The GitHub-Pages fallback is obfuscation only.

---

## Secrets & keys at a glance
| Name | Where it lives | Public? |
|---|---|---|
| Turnstile **site key** | `assets/js/data.js` | yes (by design) |
| Turnstile **secret key** | Cloudflare Function env **and** Apps Script property | no |
| RSA **public key** | `assets/js/data.js` (`contact.publicKey`) | yes (by design) |
| RSA **private key** | Cloudflare Function env `PRIVATE_KEY` only | **no** |
| `SHARED_SECRET` | Cloudflare Function env **and** Apps Script property (same value) | no |
| `OBFUSCATION_KEY` | `OBF_KEY` in `app.js` **and** Apps Script property (same value) | yes-ish (obscurity) |

The RSA keypair for this site is already generated — the **public** key is committed
in `data.js`; the **private** key was handed over separately to paste into the
Cloudflare `PRIVATE_KEY` env var. To rotate it, generate a new pair (Web Crypto
`RSA-OAEP`, 2048, SHA-256; export public as SPKI base64, private as PKCS8 base64).

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
   - `SHEET_ID` — *(optional)* the Sheet id; omit to use the bound Sheet.
4. **Deploy → New deployment → Web app** — *Execute as:* **Me**, *Who has access:*
   **Anyone** → run `doPost` once, **Allow** all permissions → copy the **`/exec`** URL.

## 3. Cloudflare Pages env vars
Cloudflare Pages → your project → **Settings → Environment variables** (Production
**and** Preview):
- `PRIVATE_KEY` — the RSA private key (PKCS8 base64) handed over separately.
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

---

## Verify
- **On karan98.in** (Cloudflare): open DevTools → Network, submit the form. The POST
  to `/api/contact` should carry only an opaque `{enc:{k,iv,ct}}` — **no** readable
  fields/meta, and **no** request to `ipwho.is`. A row appears in the Sheet with the
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
