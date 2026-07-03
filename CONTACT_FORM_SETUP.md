# Contact form — setup

The "Send a message" form posts **directly to a Google Apps Script web app**
(no Cloudflare Function — works on karan98.in, the `*.pages.dev` URL, and the
GitHub Pages mirror alike). The Apps Script verifies the **Cloudflare Turnstile**
token, appends a row to a **Google Sheet**, and emails you. Submitter metadata
(IP, city/state/country, ISP, browser, OS, timezone, …) is gathered in the
browser via a free IP lookup and sent along.

> **Secrets:** the Turnstile *site key* is public (in `assets/js/data.js`). The
> Turnstile *secret key* lives only in the Apps Script **Script properties** —
> never in the repo or the browser. The single-use Turnstile token is verified
> and discarded, never stored.

---

## 1. Cloudflare Turnstile
1. Cloudflare dashboard → **Turnstile** → your widget (Site Key
   `0x4AAAAAADsvK3etT1iNEaDP`).
2. **Hostnames** — include every domain the form is used on: `karan98.in`,
   `sudo-karan.github.io`, and your `*.pages.dev` host.
3. Copy the widget's **Secret Key** (used in step 2 below).

## 2. Google Sheet + Apps Script
1. Create a Google **Sheet** (your submissions log).
2. **Extensions → Apps Script** → replace the contents with
   [`functions/apps-script/Code.gs`](functions/apps-script/Code.gs).
3. **Project Settings → Script properties** → add:
   - `TURNSTILE_SECRET` — the Turnstile **secret key** from step 1.
   - `RECIPIENT` — `jaskaran.pta@gmail.com`.
   - `SHEET_ID` — *(optional)* the Sheet id from its URL; omit to use this Sheet.
4. **Deploy → New deployment → Web app**:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**  ← required (the browser posts anonymously)
   - Deploy, authorise, and copy the **`/exec`** URL.
5. Put that `/exec` URL into `assets/js/data.js` → `contact.formEndpoint`
   (already set to the current deployment).

> Editing `Code.gs` later? Re-deploy: **Manage deployments → ✏️ edit → Version:
> New version → Deploy** (the `/exec` URL stays the same).
>
> **After widening the columns** (this version captures ~45 fields — device model,
> OS version, CPU/GPU, screen, viewport, network, timezone offset, languages,
> Do-Not-Track, page URL, …): if the Sheet already holds an older, shorter header
> row, **clear the Sheet once** (select all → delete) so the new header is written
> fresh and the columns line up. The Sheet **and** the email now show the exact
> same field set (a single `FIELDS` list in `Code.gs` drives both).

That's it — **no Cloudflare env vars or Functions** are involved.

---

## Verify
- Open the site, fill the form, complete the Turnstile check, **Send** → you see
  the "Message sent" panel (with a **Send another message** button, no page reload).
- A new row appears in the Google Sheet with the full field set (name/email/subject/
  org/message + IP, ISP, ASN, city/state/country/postal, lat-long, browser +
  version, OS + version, device type/model, CPU arch/cores, GPU, memory, network,
  screen/viewport/pixel-ratio, colour scheme, timezone + offset, languages, …).
- An **email** arrives at `RECIPIENT` showing the **same** fields (empty ones are
  omitted); replying goes to the sender.
- A bot that can't solve Turnstile is rejected server-side (no row, no email).

> **What can't be captured:** Apple hides the exact iPhone/iPad model and iOS
> Safari/Firefox don't expose User-Agent Client Hints, so on those browsers
> device-model / OS-version / CPU-arch come through blank — everything else still
> lands. Chromium browsers (Chrome/Edge/Android) fill the most.

## Notes
- The browser posts in `no-cors` mode (Apps Script can't send CORS headers), so
  the page confirms success once the request is sent rather than reading a
  response. The Sheet/email are the source of truth that it worked.
- IP/geo come from `https://ipwho.is/` (free, no key); if it's ever unreachable
  the message still sends, just without the geo fields.
- `wrangler.toml` remains only so the static Cloudflare Pages build is
  unaffected; the form no longer depends on any Cloudflare Function.
