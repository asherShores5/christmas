# Christmas Swap

A small PWA that shows which household gives gifts to which each Christmas. The Draw for a year
is worked out in the browser from a fixed, seeded schedule, so everyone sees the same result.
See `docs/specs/2026-11-08-v1.md` and `GLOSSARY.md`.

## Layout

- `web/`: Vite + React + TypeScript PWA with an offline service worker.
- `infra/`: AWS CDK app (S3 + CloudFront hosting, added later).

## Commands

```sh
npm ci
npm test          # web + infra tests
npm run typecheck
npm run build:web # builds web/dist
npm run synth     # builds web, then synths the CDK app (once it has stacks)
```
