# Link shortener — setup

**karan98.in/urlshort** turns a long link into `karan98.in/s/<code>`. Anyone, anywhere can open
a short link. Only you can create or delete them, with your owner key. An open shortener on
this domain would invite phishing, and one flagged link can get the whole site flagged.

| Piece | Where |
|---|---|
| The page | `urlshort.html`, `assets/css/urlshort.css`, `assets/js/urlshort.js`, `assets/js/vendor/qrcode.js` (qrcode-generator 1.4.4, MIT) |
| Create / delete | `functions/api/urlshort.js`: `POST` / `DELETE /api/urlshort`, owner key required |
| Following a link | `functions/s/[code].js`: `GET /s/<code>` answers 302 to the saved URL, and unknown codes get a 404 page |
| Storage | a Cloudflare **KV namespace**, bound as `URLSHORT` in `wrangler.toml` |
| Owner key | the Cloudflare **secret** `URLSHORT_KEY` |

Until both the binding and the key exist, the page says the shortener isn't switched on yet. The
rest of the site is unaffected.

---

## One-time setup (about 5 minutes)

1. **Create the KV namespace.**
   - In the Cloudflare dashboard, open **Storage & Databases → KV** (older dashboards:
     **Workers & Pages → KV**), choose **Create**, and name it `urlshort`.
   - Copy its **ID**, a 32-character hex string.
2. **Bind it in `wrangler.toml`.**
   - `wrangler.toml` is this project's source of truth for bindings. While it exists,
     Cloudflare ignores bindings added in the dashboard, so the binding must go in the file.
   - Uncomment the block at the end of the file and paste the ID:
     ```toml
     [[kv_namespaces]]
     binding = "URLSHORT"
     id = "<the ID from step 1>"
     ```
   - Commit and push. Never commit a made-up ID: a deploy that names an unknown namespace fails.
3. **Add your owner key.**
   - Go to **Workers & Pages → sudo-karan-github-io → Settings → Variables and Secrets → Add**.
   - Choose type **Secret**, name `URLSHORT_KEY`.
   - For the value, use a long random string, for example from a password manager or
     `openssl rand -base64 24`.
   - Add it for **Production**. Also add it for **Preview** if you want pull-request previews to
     be able to create links. Previews share the same namespace.
4. **Deploy.**
   - The push in step 2 deploys.
   - If you added the key after that deploy finished, retry the latest deployment so the
     Function sees it: **Deployments → ⋯ → Retry deployment**.
5. **Use it.**
   - Open **https://karan98.in/urlshort** and paste a link.
   - Enter the key once, leaving **Remember on this device** ticked.

## Everyday use
- **Custom endings** (`karan98.in/s/resume`): 3–40 letters, digits or hyphens. Case doesn't
  matter.
- **Random codes** are 6 characters with no `0`/`o` or `1`/`l`/`i`, so they survive being read
  aloud.
- **Recent links** on the page live on the device that made them. You can copy or delete from
  there.
- **On a shared device**, use **Forget key** (under the Shorten button) when you're done. If you
  untick **Remember on this device**, the key is kept for that tab only.
- **Pasting:** on a computer you can paste a link anywhere on the page; on a phone, use the
  **Paste** button in the link field.
- **QR codes:** each new link comes with one, which you can save as PNG or SVG.
- **To change the key**, edit the secret, retry the deployment, and enter the new key on your
  devices.

## Limits and behaviour
- **KV free plan:** 100,000 link opens and 1,000 new or deleted links a day (resets at
  00:00 UTC).
- **Timing:** a new link works everywhere almost at once. A deleted link may keep redirecting
  for up to about a minute in some places, because of KV's edge caching.
- **Redirects:** links answer **302**, not 301, so a deleted link stops working for people who
  have already used it. They're also sent `noindex`.
- **Accepted links:** only `http(s)` links are saved. A bare address gets `https://`.
  `user:password@` links and links to another `karan98.in/s/…` are refused.
- **On the GitHub Pages mirror,** which has no Functions, `/urlshort` forwards to karan98.in.
