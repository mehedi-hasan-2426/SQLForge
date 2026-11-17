# Contributing

Small fixes, clearer German explanations and reproducible bug reports are welcome.
Discuss large changes before building them. This is a browser-only learning app;
accounts, remote SQL execution and cloud progress storage are separate scope.

## Development

Use Node.js 22.12 or newer and npm 10.9.2.

```powershell
npm ci --ignore-scripts
npm run dev
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

Keep the npm lockfile authoritative. Dependency install scripts are disabled in
`.npmrc`; do not blanket-enable them. Review new dependencies and their licences.
Keep GitHub Actions pinned to verified upstream commit SHAs.

## Changes

- Open one focused branch and pull request per improvement.
- Preserve existing browser progress formats unless migration is intentional.
- Keep user-facing text in German and source names descriptive.
- Add focused tests for changed behaviour and failure paths.
- Use synthetic data only. Do not copy official exam papers or private material.
- Keep source, scripts and workflows comment-free except required tool directives.
- Update documentation when setup, browser storage or deployment behaviour changes.
- Report the checks actually run; do not bypass failing security checks.

See [SECURITY.md](SECURITY.md) for private vulnerability reporting.
Contributions must be compatible with the [MIT License](LICENSE).
