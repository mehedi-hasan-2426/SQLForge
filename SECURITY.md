# Security Policy

SQLForge is a community learning project. The current `main` branch is the
supported scope; there is no response-time guarantee or long-term support release.

## Reporting

Use the repository's Security tab and private vulnerability reporting when
available. If that option is unavailable, contact the maintainer through their
GitHub profile to arrange a private channel. Do not put credentials, private
browser exports or exploit details in public issues.

Include the affected commit, a minimal reproduction with synthetic data,
expected and observed behaviour, and likely impact.

## Boundaries

- There are no accounts, authentication tokens, server-side SQL endpoints or
  shared learner databases. SQL runs in a newly seeded SQLite Web Worker.
- Queries are capped at 12,000 characters; a worker is terminated after
  3.5 seconds. Only the first 500 result rows are displayed. These limits
  do not guarantee constant memory use for every SQLite expression.
- SQL is intentionally user-authored code against fictional data. Never load
  real company or personal databases into the training environment.
- Progress imports are capped at 1 MB and validated. React escapes displayed
  input; generated print reports HTML-escape text and contain no inline scripts.
- Progress lives in browser localStorage. Active exam answers are retained until
  grading. Browser storage is not encrypted against other users of that browser.
- Sharing is explicit. Opening a WhatsApp link sends its encoded text to WhatsApp.
- HTTPS is required for offline use outside localhost. Vercel headers restrict
  framing, referrers and browser permissions. They do not apply to the dev server.
- CSP permits `wasm-unsafe-eval` for SQLite WebAssembly, not JavaScript
  `unsafe-eval`. Inline styles are permitted because CodeMirror injects styles.
  Inline scripts remain blocked.
- Dependency scripts are disabled. The lockfile pins the dependency graph.
  CI audits dependencies, scans for secrets and runs extended CodeQL queries.

Authentication and tenant isolation are not applicable to this static, anonymous
app. Hosting-provider access logs and the user's browser/device are separate
trust boundaries. Clearing website data removes local progress and caches, not
exported files or copies shared with other people.

The project is not a security certification or an examination authority.
Real-device and deployed-header checks remain part of each deployment.
