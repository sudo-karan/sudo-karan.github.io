# sudo-karan.github.io

Personal portfolio / résumé site for **Jaskaran Singh** — Assistant Director,
National Informatics Centre (NIC · MeitY), Government of India.

Live at **https://sudo-karan.github.io**

A single-page, dark-first (with light toggle) portfolio. No framework, no build
step — just HTML, CSS and vanilla JS, served straight off GitHub Pages.

## Editing the content

**Everything you'd want to change lives in one file:**
[`assets/js/data.js`](assets/js/data.js). It holds your profile, summary, stats,
experience, projects, skills, certifications, education and contact links. Edit
the values there and the page re-renders itself — you rarely need to touch the
HTML, CSS or JS.

### Common edits
- **Add a project** → add an object to the `projects` array in `data.js`. Set
  `category` to one of the `projectCategories`, add a `live` URL for a demo
  button and/or a `code` URL, and `featured: true` to float it to the top.
- **Update your résumé** → replace `assets/Jaskaran_Singh_Resume.pdf`.
- **Swap your photo** → replace `assets/img/avatar.png`.
- **Change colours** → edit the CSS custom properties at the top of
  [`assets/css/styles.css`](assets/css/styles.css) (`--accent`, `--accent-2`, …).

## Structure

```
index.html              # markup + mount points (mostly static skeleton)
assets/css/styles.css   # theme tokens + all styling (dark + light)
assets/js/data.js       # ← all site content (edit this)
assets/js/main.js       # renders sections from data.js + interactions
assets/img/avatar.png   # profile photo
assets/Jaskaran_Singh_Resume.pdf
.nojekyll               # serve files as-is (skip Jekyll)
```

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```
