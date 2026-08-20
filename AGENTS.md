# Repository Guidelines

## Project Structure & Module Organization

This is a Nuxt 4 static site. Vue pages and components live in `app/`, filesystem content APIs in `server/api/content/`, and GitHub Pages publishes the generated `.output/public/` directory. Static bilingual content remains under `public/data/`; English base files pair with `.vi.json` or `.vi.html` companions. Browser-only integration adapters remain in `public/lib/`, and images belong in the matching `public/assets/` subtree. Backend code is isolated in `apps-script/Code.gs`, validation utilities in `tools/`, tests in `tests/`, and contributor documentation in `docs/`.

## Build, Test, and Development Commands

- `npm install --legacy-peer-deps` installs the pinned Nuxt toolchain with Node 22.
- `npm run dev` starts the Nuxt development server.
- `npm run generate` prerenders the complete static site into `.output/public/`.
- `npm run preview` serves the generated output locally.
- `node tools/check.mjs` runs the complete CI gate: content validation, ESM syntax checks, logging checks, and all tests.
- `node tools/check.mjs --only tests` runs only the test stage; `--list` shows available stages.
- `node tools/check.mjs --audit` adds a non-failing editorial report.
- `node tools/validate-content.mjs --stats` prints detailed content statistics.

Use Node 22 to match `.github/workflows/deploy.yml`.

## Coding Style & Naming Conventions

Follow existing JavaScript: two-space indentation, single quotes, semicolons, `camelCase` functions/variables, and `UPPER_SNAKE_CASE` constants. Use ES modules and keep comments short, in English, explaining why. Runtime `console.*` and Apps Script `Logger.log` calls are prohibited. Name tests `feature.test.mjs`. Content files use numbered kebab-case names such as `27-api-gateway-identity-edge.json`; preserve existing `item_id` values because they are persistent storage keys. Keep EN/VI pairs structurally identical. Do not edit vendored files in `public/vendor/`.

## Testing Guidelines

Tests use Node's built-in `node:test` with strict assertions. Add focused coverage for behavior, data contracts, and regressions; `tools/check.mjs` automatically discovers every `tests/*.test.mjs`. Run the full check before pushing. For content changes, follow `docs/content-playbook.md` and verify both languages in the browser.

## Commit & Pull Request Guidelines

Recent history favors brief, lowercase summaries such as `fix some UX UI` and `update sample`. Prefer a clearer imperative summary scoped to one change, and keep unrelated edits separate. Pull requests should explain the user-visible impact, identify affected routes or content topics, and report `node tools/check.mjs` results. Link relevant issues and include screenshots for UI changes. Never commit `public/config.js`, `secret/`, credentials, tokens, or personal exports.
