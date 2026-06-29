# Contact form — one-time setup

The "Send a message" form on the site posts to a **Cloudflare Pages Function**
(`functions/api/contact.js`), which verifies a **Cloudflare Turnstile** token
server-side, enriches the submission with request metadata, and forwards it to a
**Google Apps Script** web app that logs to a **Google Sheet** and emails you.

Until you finish the steps below, the form runs with Turnstile **test keys**
(always pass) and will return `not-configured` on submit (the page then shows an
"email me directly" fallback). After setup it works end-to-end and is bot-protected.

> **Where secrets live:** the Turnstile *site key* is public (in `assets/js/data.js`).
> The Turnstile *secret key*, the Apps Script URL, and the shared secret live only
> as **encrypted Cloudflare Pages environment variables** — never in the repo or the
> browser. Turnstile *tokens* are single-use and are never stored.

---

## 1. Cloudflare Turnstile (the bot check)
1. Cloudflare dashboard → **Turnstile** → **Add widget**.
2. Hostnames — add **all** the domains the site is served from, so the widget
   renders everywhere:
   - `karan98.in`
   - `sudo-karan.github.io`  ← so the form also works on the GitHub Pages mirror
   - `sudo-karan-github-io.pages.dev`  (and preview subdomains)
   - `localhost` (optional, for local testing)
3. Widget type: **Managed**. Create it.
4. Copy the **Site Key** and **Secret Key**.
5. Paste the **Site Key** into `assets/js/data.js` → `contact.turnstileSiteKey`,
   then commit/push.

## 2. Google Sheet + Apps Script (storage + email)
1. Create a new **Google Sheet** (this is your submissions log).
2. **Extensions → Apps Script**. Delete the placeholder and paste the contents of
   [`functions/apps-script/Code.gs`](functions/apps-script/Code.gs).
3. **Project Settings → Script properties** → add:
   - `SHARED_SECRET` — any long random string (you'll reuse it in step 3).
   - `RECIPIENT` — `jaskaran.pta@gmail.com`.
   - `SHEET_ID` — *(optional)* the Sheet id from its URL; omit to use this Sheet.
4. **Deploy → New deployment → Web app**:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - Deploy, authorise, and copy the **Web app URL** (ends in `/exec`).

## 3. Cloudflare Pages environment variables
Cloudflare dashboard → your Pages project → **Settings → Environment variables**
→ add for **Production** *and* **Preview**:
- `TURNSTILE_SECRET_KEY` — the secret key from step 1.
- `APPS_SCRIPT_URL` — the `/exec` URL from step 2.
- `SHARED_SECRET` — the same random string from step 2.

Mark them as **encrypted/Secret**. Then **redeploy** (or push a commit) so the
Function picks them up.

---

## Verify
- Open the site (karan98.in **and** sudo-karan.github.io), fill the form, complete
  the Turnstile check, submit → you should see "Message sent ✓".
- A new row appears in the Google Sheet (with name/email/subject/org/message plus
  IP, browser, OS, ISP, city/state/country, lat-long, etc.).
- An email arrives at `RECIPIENT`; hitting reply goes to the sender's address.
- Submitting without completing Turnstile is rejected.

## Local testing (optional)
```bash
npx wrangler pages dev .          # serves the static site + Functions at :8788
```
Create a gitignored `.dev.vars` with `TURNSTILE_SECRET_KEY`, `APPS_SCRIPT_URL`,
`SHARED_SECRET` for local runs. (`.dev.vars` is already in `.gitignore`.)

## Notes
- The form posts to the **absolute** URL `https://karan98.in/api/contact` (see
  `data.js`) so it works from the GitHub Pages mirror too; CORS is enabled on the
  Function. If your Cloudflare domain changes, update `contact.formEndpoint`.
- Email volume: Gmail/Apps Script sends up to ~100 emails/day (consumer) — plenty
  for a contact form. The Sheet keeps the full record regardless.
