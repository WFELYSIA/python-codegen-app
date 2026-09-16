# MEMORY.md

## Long-Term Context

- The app was created as a student project and includes the visible attribution `学生王君宇作品`.
- GitHub repository: https://github.com/WFELYSIA/python-codegen-app
- GitHub Pages URL: https://wfelysia.github.io/python-codegen-app/
- GitHub Pages cannot run the Express backend, so the static deployment uses browser-side direct API mode.

## Decisions

- Local mode keeps API keys on the server; GitHub Pages mode stores them in browser localStorage and requires the configured API to allow browser CORS.
- The UI supports multi-turn conversation, streaming output, split code/explanation output, code copy/download, text-file import, and a 1-5 thinking-strength slider.
- The thinking-strength slider is sent as OpenAI-compatible `reasoning_effort`: levels 1-2 map to low, 3 to medium, and 4-5 to high.
- API requests target OpenAI-compatible `POST {baseUrl}/chat/completions` endpoints.

## Known Constraints

- Static GitHub Pages mode has a client-side API-key exposure risk.
- Secrets are intentionally not stored in this file.