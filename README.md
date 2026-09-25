## ServersUp Website

Canonical host: **`https://serversup.armasn.dev`** (S3 `serversup-site` + CloudFront; DNS at Cloudflare).

GitHub repo: **`ServersUp/serversup.github.io`** (historical repo name; same repo ID as the former `servers-up-website` slug).

### Hosting and branches

| Branch | Role |
|--------|------|
| **`main`** | Product site source. Push to `main` runs [`.github/workflows/publish-site.yml`](.github/workflows/publish-site.yml) (OIDC → S3 sync + CloudFront invalidation). |
| **`pages-offline`** | Retained legacy redirect stubs. GitHub Pages is disabled, so this branch is not published. |

The legacy `https://serversup.github.io/` host returns HTTP 404. Keep GitHub Pages disabled so the CDN site remains the only published copy.

Canonical for indexing and links remains **`https://serversup.armasn.dev`**.

### Stack

- Self-contained CSS + vanilla JS
- Live status on `/` via same-origin `/status/latest.json`
- Install/docs on `/install/`
- Blog on `/blog/`

### Local preview

```bash
python3 -m http.server 5173
```

Status fetch uses same-origin `/status/latest.json` on `serversup.armasn.dev`; elsewhere (local preview) it falls back to `https://serversup.armasn.dev/status/latest.json` (CloudFront CORS `*`).

### Data

- `data/wow-servers.json` and `data/ffxiv-servers.json` - source lists
- `data/games-data.js` - bundled for offline preview (regenerate when JSON changes)

### Repo variables (publish workflow)

- `AWS_ROLE_SITE_PUBLISH` - IAM role ARN (`site_publish_role_arn` from `website-cdn`)
- `CLOUDFRONT_DISTRIBUTION_ID` - distribution id from `website-cdn`
