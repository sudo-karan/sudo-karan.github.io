# Link shortener — setup

**karan98.in/urlshort** turns a long link into `karan98.in/s/<code>`. Anyone, anywhere can open
a short link until it expires. Making links is limited to you, with your owner key, and to the
people whose email address is on your allow list, who get a one-time code by email. An open
shortener on this domain would invite phishing, and one flagged link can get the whole site
flagged. Every link made or deleted, and every visit to one, is logged to your Google Sheet.

| Piece | Where |
|---|---|
| The page | `urlshort.html`, `assets/css/urlshort.css`, `assets/js/urlshort.js`, `assets/js/vendor/qrcode.js` (qrcode-generator 1.4.4, MIT) |
| Make / delete | `functions/api/urlshort.js`: `POST` / `DELETE /api/urlshort`, with the owner key or an email pass |
| Following a link | `functions/s/[code].js`: `GET /s/<code>` answers 302 to the saved URL until the link expires, then a 410 "expired" page. Unknown codes get a 404 page |
| The log | `functions/api/urlshort/log.js`: the Apps Script collects events from here |
| Storage | a Cloudflare **KV namespace** bound as `URLSHORT` (the links), and a **D1 database** bound as `URLSHORT_DB` (the log), both in `wrangler.toml` |
| Owner key | the Cloudflare **secret** `URLSHORT_KEY` |
| Email codes | the contact form's Apps Script (`app=urlshort`): allow list `URLSHORT_WHITELIST`, and the secret `URLSHORT_GATE_SECRET`, set both there and in Cloudflare |
| The Sheet | the contact form's spreadsheet, in two tabs it adds: **Short links** and **Link visits** |
| Sealing | the contact form's key pair: the page seals each new link's request with the public key (`SITE_KEY` in `assets/js/urlshort.js`, a copy of `contact.publicKey` in `data.js`), and the Function opens it with the contact form's Cloudflare secret `PRIVATE_KEY`, which is already set |

Until the KV binding and at least one way in (the owner key, or the gate secret) exist, the page
says the shortener isn't switched on yet. It says so too if the contact form's `PRIVATE_KEY` is
ever missing, since that opens the page's sealed requests. Without the D1 database, nothing is
logged, and everything else works. The rest of the site is unaffected either way.

## Who can do what

| | Owner key | Email on the allow list | Anyone |
|---|---|---|---|
| Make a link | yes | yes, after an email code | no |
| How long it lasts | on the page, 10 minutes to 30 days, or never; 24 hours unless chosen (the API itself takes up to 10 years) | 10 minutes to 30 days; 24 hours unless chosen | – |
| Delete a link | any link | the links made with that email | no |
| Open a short link | yes | yes | yes, until it expires |

People who aren't on the list are told on the page that they can write to you (it links to the
contact form) to be added.

---

## One-time setup (about 15 minutes)

1. **Create the KV namespace** (the links).
   - In the Cloudflare dashboard, open **Storage & Databases → KV** (older dashboards:
     **Workers & Pages → KV**), choose **Create**, and name it `urlshort`.
   - Copy its **ID**, a 32-character hex string.
2. **Create the D1 database** (the log).
   - Open **Storage & Databases → D1 SQL Database → Create**, and name it `urlshort-log`.
   - Copy its **ID** (a UUID). Its table is created the first time something is logged.
3. **Bind both in `wrangler.toml`** (done: the IDs of `urlshort` and `urlshort-log` are in
   the file. Redo this only if you recreate either one).
   - `wrangler.toml` is this project's source of truth for bindings. While it exists,
     Cloudflare ignores bindings added in the dashboard, so the bindings must go in the file.
   - The two blocks at the end of the file hold the IDs:
     ```toml
     [[kv_namespaces]]
     binding = "URLSHORT"
     id = "<the KV ID from step 1>"

     [[d1_databases]]
     binding = "URLSHORT_DB"
     database_name = "urlshort-log"
     database_id = "<the D1 ID from step 2>"
     ```
   - Commit and push. Never commit a made-up ID: a deploy that names an unknown namespace or
     database fails. (Or send me the two IDs and I'll do it.)
4. **Add the two secrets in Cloudflare.**
   - Go to **Workers & Pages → sudo-karan-github-io → Settings → Variables and Secrets → Add**,
     type **Secret**, for **Production**:
     - `URLSHORT_KEY`: your owner key, a long random string (from a password manager, or
       `openssl rand -base64 24`).
     - `URLSHORT_GATE_SECRET`: another long random string (`openssl rand -hex 32`). It must
       differ from the forest map's and the PhD explorer's gate secrets.
   - Links can only be made or deleted at karan98.in itself: pull-request previews and older
     deployments at `*.pages.dev` addresses refuse to.
5. **Set up the Apps Script** (the contact form's: open the Sheet → **Extensions → Apps Script**).
   - Replace the code with [`functions/apps-script/Code.gs`](functions/apps-script/Code.gs).
   - **Project Settings → Script properties**, add:
     - `URLSHORT_GATE_SECRET`: the same value as in Cloudflare.
     - `URLSHORT_WHITELIST`: the addresses allowed to make links, comma- or newline-separated.
     - `URLSHORT_PASS_HOURS` (optional): how long a code keeps someone signed in on their
       device, 1–720 hours. Default 24.
     - `URLSHORT_TAB_ROWS` (optional): how many rows each log tab keeps, newest first,
       1,000–200,000. Default 100,000. See "What is logged".
   - In the editor, pick **installShortLinkSync** and press **Run** once. Approve the
     permissions it asks for: this code runs on a timer and connects to karan98.in to collect
     the log, which the old code didn't. From then on the **Short links** and **Link visits**
     tabs fill every 5 minutes. Running it again is harmless. Runs before step 6's deployment
     is live may fail (HTTP 404, 503 or 401) and Google may email you about them; that's
     expected.
   - Then **Deploy → Manage deployments → ✎ Edit → Version: New version → Deploy.** The web
     app's URL stays the same. (Approving first means the sign-in never runs without the
     permissions this code needs.)
6. **Deploy.**
   - Production deploys from `main`: merging the pull request that has the bindings deploys
     karan98.in. (A push to another branch only builds a preview at a `*.pages.dev` address.)
   - If you added a secret after that deploy finished, retry the latest production
     deployment so the Functions see it: **Deployments → ⋯ → Retry deployment**.
7. **Use it.**
   - Open **https://karan98.in/urlshort** and paste a link.
   - To use your owner key, choose **Use the owner key instead** when the page asks you to
     sign in. Enter the key once, leaving **Remember on this device** ticked.
   - What's remembered (your key, or an email pass) is kept in this browser's storage for
     karan98.in. Any page served under karan98.in can read it, including the GitHub Pages
     projects the site forwards there (`karan98.in/<project>/`). If that isn't acceptable,
     untick **Remember**: it is then kept for that tab only.

## What is logged

The page's footer tells visitors what the shortener logs. People who only follow a short link go
straight to its destination and don't see that notice. Each row in the Sheet has the time (IST)
and:

- **Short links** tab: each link made (and whether it was new, the same link again, or a
  renewal), deleted, or refused (a wrong key or pass); the short and long link; when it stops
  working; who made it (`owner`, or the email address); and the maker's IP address, approximate
  place (country, state, city, postal code, coordinates, from the IP address), network (ISP and
  ASN), browser, operating system and device. The page also sends the maker's browser and OS
  versions, device model, screen and window size, pixel ratio, colour scheme, time zone and UTC
  offset, languages, touch points, CPU cores, approximate memory and network type: a subset of
  what the contact form records.
- **Link visits** tab: every time a short link is opened: which link, whether it went through,
  had expired, or didn't exist, and the visitor's IP address, approximate place, network,
  browser, operating system, device type, language and the page they came from.

**What a browser shows.** Everything travels over HTTPS, so nobody between a browser and the
site can read it. The IP address, place, network and every visit are read by Cloudflare's server
from the connection itself and go to the Sheet server to server, so they never pass through
anyone's browser. When someone makes a link, the page seals the request (the link, its ending,
the timer and the device details) as the contact form seals its messages: AES-256-GCM under a
fresh key, which RSA-OAEP wraps for the site's public key. Their browser's Network tab then
shows only `{"enc": …}`. What it still shows is theirs anyway: the email address and code they
typed to sign in, their key or pass in the `Authorization` header, and the answer, which holds
the short link and the long one they pasted. A browser without Web Crypto (none in current use)
sends the request unsealed, over HTTPS all the same.

The log holds personal data. Keep the Sheet private. The events wait in the D1 database until the
Apps Script has copied them into the Sheet, and are deleted from D1 after that.

Each log tab keeps the newest 100,000 rows (`URLSHORT_TAB_ROWS`) and removes older ones as new
rows arrive. The tabs share the contact form's spreadsheet, and a spreadsheet holds at most 10
million cells, so this keeps a flood of visits from ever filling it. Two full tabs take about
6.6 million cells. If you'd rather keep everything, copy the old rows elsewhere now and then.

## Everyday use
- **How long links last:** choose under **Link lasts** when you make one: 10 minutes, 1 hour,
  24 hours (the default), 7 days, 30 days, or a custom time. With your owner key there's also
  **Never**. An expired link shows a "This link has expired" page for 30 days and then
  "doesn't lead anywhere". During those 30 days its ending stays reserved: only you, or the
  person who made it, can use it again.
- **Adding someone:** add their address to `URLSHORT_WHITELIST`. No redeploy is needed.
- **Removing someone:** take their address off the list. They can't get another code, but a
  pass they already have keeps working until it runs out (24 hours by default). To end every
  pass at once, change `URLSHORT_GATE_SECRET` in both Cloudflare and the Apps Script, then retry
  the latest deployment (**Deployments → ⋯ → Retry deployment**). Until that deployment is live,
  old passes keep working, new codes give passes the site refuses, and the Sheet stops filling
  (the events wait in D1).
- **Custom endings** (`karan98.in/s/resume`): 3–40 letters, digits or hyphens. Case doesn't
  matter.
- **Random codes** are 6 characters with no `0`/`o` or `1`/`l`/`i`, so they survive being read
  aloud.
- **Recent links** on the page live on the device that made them. You can copy or delete from
  there. The page keeps the latest 200 and shows 20 until you press **Show all**. The browser's
  storage for karan98.in is shared with every page there. If it ever fills up, the oldest links
  drop off the list first, and the page says how many. Links that drop off still work. If not
  even the newest fits (or the browser keeps no site data), the list is kept for that tab only,
  and the page says so.
- **On a shared device**, use **Forget key** or **Sign out** (under the Shorten button) when
  you're done. If you untick **Remember on this device**, it's kept for that tab only.
- **Pasting:** on a computer you can paste a link anywhere on the page; on a phone, use the
  **Paste** button in the link field.
- **QR codes:** each new link comes with one, which you can save as PNG or SVG.
- **To change the owner key**, edit the secret, retry the deployment, and enter the new key on
  your devices. Only karan98.in accepts writes, so once that deployment is live the old key stops
  working everywhere, even on older deployments that were built with it.
- **If an answer gets lost** (a dropped connection, say), **Try again** is safe. It finds the
  link the first attempt made instead of making a second one, or calling your own ending taken.

## Limits and behaviour
- **KV free plan:** 100,000 link opens and 1,000 new or deleted links a day (resets at
  00:00 UTC).
- **D1 free plan:** 100,000 rows written a day and 5 GB in all. Each logged event uses about 3
  of those writes (2 when it's logged, 1 when it's cleared after reaching the Sheet), so roughly
  30,000 events a day; beyond that, new events aren't logged until the reset at 00:00 UTC. Links
  keep working either way.
- **Email codes** come from the Apps Script's Gmail and share the contact form's daily cap
  (`OTP_DAILY_CAP`, 85 by default). Each address can ask for 3 codes an hour. Answers take about
  4 seconds on purpose, and they never say whether an address is on the list.
- **The Sheet** fills every 5 minutes, so the newest events can take that long to appear. If it
  stops filling, the `syncShortLinks` runs show as **Failed** on the Apps Script's
  **Executions** page (Google usually emails you about failed runs too), and the error says why:
  - HTTP 403 with a Cloudflare challenge page: **Bot Fight Mode** (Security → Bots) is stopping
    Google's call. Turn it off, or add a rule that skips it for `/api/urlshort/log`.
  - HTTP 401: the two `URLSHORT_GATE_SECRET` values (Cloudflare and the Apps Script) differ.
  - HTTP 503 `not-set-up`: the D1 database isn't bound yet, or Cloudflare has no
    `URLSHORT_GATE_SECRET`.

  Meanwhile the events wait in D1, and the next good runs catch up, up to 2,500 events each.
- **If you ever delete and recreate the D1 database,** also delete the Script Property
  `urlshort_log_last` in the Apps Script. It remembers how far the Sheet has got, and a new
  database counts from 1 again, so without the reset its first events would be skipped.
- **If the page says "Signing in by email isn't switched on yet",** the Apps Script doesn't
  have this `Code.gs` yet, or its `URLSHORT_GATE_SECRET` is missing or the same as another
  gate's. Paste the code, run **installShortLinkSync** once in the editor and approve the
  permissions it asks for (this `Code.gs` needs more than the old one did), then **Deploy →
  Manage deployments → ✎ Edit → Version: New version → Deploy**. Until then no code is
  emailed to anyone: the page asks in a way an older script ignores.
- **If every code is accepted but making a link then asks for a new code,** the two
  `URLSHORT_GATE_SECRET` values (Cloudflare and the Apps Script) aren't the same. Copy one into
  the other, and retry the latest deployment if you changed Cloudflare's.
- **Timing:** a new link works everywhere almost at once. A deleted link may keep redirecting
  for up to about a minute in some places, because of KV's edge caching. An expired one stops at
  once: the expiry time is checked on every visit.
- **Redirects:** links answer **302**, not 301, so a deleted or expired link stops working for
  people who have already used it. They're also sent `noindex`. If KV itself has a problem, a
  short link shows a "try again in a minute" page (503), never a "doesn't lead anywhere" one.
- **One ending, two links at once:** KV can't claim an ending atomically. If two different
  links are given the same ending at the same moment (from two tabs, say), both can report
  success, and the later one wins.
- **Accepted links:** only `http(s)` links are saved. A bare address gets `https://`.
  `user:password@` links and links to another `karan98.in/s/…` are refused.
- **Links made before timers existed** never expire, and only the owner key can delete them.
- **On the GitHub Pages mirror,** which has no Functions, `/urlshort` forwards to karan98.in.
