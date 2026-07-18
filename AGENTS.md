# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 15 App Router site that produces a static export. Route entry points live in `app/`; dynamic routes use folders such as `app/team/[slug]/`. Reusable React components belong in `app/components/`, while prediction logic, data adapters, and shared utilities live in `lib/`. Source datasets and dated forecast snapshots are stored in `data/`. Maintenance and generation tasks live in `scripts/`, and browser-served images and downloadable datasets live in `public/`. Treat `.next/` and `out/` as generated build artifacts; do not edit them by hand.

## Build, Test, and Development Commands

- `npm ci` installs the exact dependency versions recorded in `package-lock.json`.
- `npm run dev` starts the local Next.js server on `http://localhost:3100`.
- `npx tsc --noEmit` performs a strict TypeScript check without generating files.
- `npm run build` refreshes news and forecast exports, then writes the static site to `out/`.
- `npm run data:elo` refreshes `data/clubelo-latest.csv` from ClubElo.

Build and data commands can access external feeds and modify tracked JSON/CSV files. Review those diffs before committing.

## Coding Style & Naming Conventions

Use two-space indentation, double quotes, and semicolons, matching the existing TypeScript. Keep React component names and component files in PascalCase (`ForecastTable.tsx`); use camelCase for functions and variables, and uppercase snake case for constants. Prefer the `@/` path alias for cross-directory imports. Route folders should remain lowercase, with descriptive hyphenated segments when needed. No formatter or linter is configured, so preserve nearby style and rely on TypeScript and build checks.

## Testing Guidelines

There is currently no automated test framework or coverage threshold. For every change, run `npx tsc --noEmit` and `npm run build`, then manually verify affected routes. For model or simulation changes, check representative match, league, and snapshot output. If adding a test runner, colocate tests as `*.test.ts` or `*.test.tsx` and prioritize deterministic tests for `lib/` calculations.

## Commit & Pull Request Guidelines

Git history is not available in this checkout, so no repository-specific commit convention can be inferred. Use short imperative subjects, for example `Add Elo snapshot validation`, and keep unrelated generated-data updates separate. Pull requests should explain the user-visible or model impact, list validation commands, link relevant issues, identify changed data sources, and include before/after screenshots for UI changes.
