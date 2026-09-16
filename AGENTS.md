# AGENTS.md

## Project

- Name: python-codegen-app
- Started: 2026-09-14
- Owner: DoubleXie / 王君宇 attribution requested by user
- Purpose: Local and GitHub Pages web app that generates Python code through a user-configured OpenAI-compatible API.

## Stack

- Frontend: React 19, Vite, TypeScript, Tailwind CSS
- Backend: Express 5, TypeScript, Node.js 24
- Package manager: npm (package-lock.json)
- Main directories: `src/`, `server/`, `dist/`, `dist-server/`

## Commands

- Install: `npm install`
- Type check: `npm run typecheck`
- Test: `npm test`
- Build: `npm run build`
- Local production start: `npm start`

## Architecture

- Local mode uses the Express proxy at `/api/*`, so API keys stay on the server.
- Static GitHub Pages mode uses `src/lib/directConfig.ts`; API keys are stored in browser localStorage and requests go directly to the configured API.
- Conversation history is stored in browser localStorage.
- Streaming responses use SSE events: `meta`, `delta`, `done`, `error`.
- Keep API request changes aligned with the OpenAI-compatible chat completions contract unless a deliberate compatibility layer is added.

## Conventions

- Use strict TypeScript.
- Prefer existing helpers and small focused changes.
- Do not add speculative dependencies or abstractions.
- Keep UI text in Chinese when user-facing.
- Never hardcode or log secrets.

## Verification

- Run typecheck, tests, and build before reporting completion.
- For UI changes, verify the rendered page with Playwright when possible.
- Keep GitHub Pages deployment on the `gh-pages` branch; source of truth stays on `main`.