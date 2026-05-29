# Pengxiang Fu Academic Homepage

This repository hosts the personal academic homepage for Pengxiang Fu.

Website:

```text
https://PengxiangFu2003.github.io
```

## Local Preview

Open `index.html` directly, or run a local static server:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Then visit:

```text
http://127.0.0.1:4173/
```

## Edit Content

Most homepage content is managed in:

```text
assets/js/data.js
```

The layout, typography, responsive behavior, and visual style are managed in:

```text
assets/css/styles.css
assets/js/main.js
```

## Quality Checks

Before publishing changes, run:

```powershell
node --check assets/js/data.js
node --check assets/js/main.js
node tools/validate-data.mjs
node tools/audit-page.mjs
```

## Structure

```text
index.html
assets/
tools/
README.md
CONTENT_GUIDE.md
```

This is a static site with no build step. GitHub Pages can serve it directly from the repository root.
