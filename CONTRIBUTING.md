# Contributing

Thanks for helping improve `typed-policy-kit`.

## Local workflow

Use Node.js 22.12 or newer and pnpm 11.

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm test:e2e
```

Keep changes focused and include tests for observable behavior. Public API changes should include compile-time coverage in a package `test-d` directory and an update to the relevant package README.

## Design expectations

- Preserve default-deny and deny-overrides-allow behavior
- Keep the core independent from React, Express, and storage concerns
- Do not treat browser-side decisions as authorization enforcement
- Document failure semantics and security tradeoffs explicitly
- Add an ADR before introducing a new policy execution model

## Commits and pull requests

Use short imperative commit subjects. A pull request should explain the problem, public API impact, verification commands, and any security implications.
