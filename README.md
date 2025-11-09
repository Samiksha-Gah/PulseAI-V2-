# PulseAI

PulseAI is a CPR training assistant that provides real-time guidance and session summaries using AI (Google Gemini and OpenAI), plus text-to-speech (ElevenLabs). The project contains a frontend (React + Vite + TypeScript) and a Node/Express backend that proxies requests to LLMs and TTS services, transcribes audio, and returns concise, actionable answers suitable for live CPR coaching.

This README is meant to be a single reference for developers running the project locally or deploying it. It documents repository structure, environment variables, how to run the app, API endpoints, common troubleshooting, and security best practices.

## Table of contents
- Project structure
- Quick start (dev)
- Backend setup
- Frontend setup
- Environment variables
- API endpoints (server)
- Troubleshooting & common errors
- Security & secrets
- Testing & build
- Deployment notes
- Contributing
- License

---

## Project structure

Top-level:

- `backend/` — Express server, handles: /api/query, /api/transcribe, /api/tts, /api/summarize, health
- `frontend/` — React + Vite app (TypeScript). Main UI and components live here, including `AskQuestionModal.tsx`.
- `PROJECT_STORY.md`, `QUICK_FIX_RENDER.md`, `RENDER_DEPLOYMENT.md`, `replacements.txt` — project notes and docs

Frontend important files:
- `frontend/src/main.tsx`, `frontend/src/App.tsx` — app entry
- `frontend/src/components/AskQuestionModal.tsx` — modal that queries backend and plays TTS
- `frontend/package.json` — scripts: `dev`, `build`, `preview`

Backend important files:
- `backend/server.js` — Express application
- `backend/package.json` — start/dev scripts
- `backend/.env` (local; not committed) — environment variables (API keys)

---

## Quick start (development)

Prereqs:
- Node.js (16+ recommended) and npm
- A modern browser

1. Clone the repository and open the project root.
2. Install dependencies for both packages:

```powershell
# from project root
cd frontend
npm install
cd ../backend
npm install
```

3. Provide environment variables (see next section). Create `backend/.env` from `.env.example` and fill in keys (do NOT commit this file).

4. Start backend and frontend in separate terminals:

```powershell
# Backend (PowerShell)
cd "<project-root>\backend"
npm run dev

# Frontend (PowerShell)
cd "<project-root>\frontend"
npm run dev
```

Open the frontend URL shown by Vite (typically http://localhost:5173) and the backend runs on http://localhost:3001 by default.

---

## Backend setup (detailed)

1. Create a `.env` file in `backend/` (copy `.env.example`) and replace placeholders with your keys:

```
PORT=3001
ELEVENLABS_API_KEY=YOUR_ELEVENLABS_KEY
VOICE_ID=EXAVITQu4vr4xnSDxMaL
GEMINI_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

2. Start server:

```powershell
cd backend
npm run dev
```

The server will print a short health-check and configured keys (it will only say 'configured' or 'missing' — real keys are not printed).

### Notes
- The backend proxies requests to external AI/TTS APIs and includes logic to try Gemini first and fall back to OpenAI when appropriate. It also converts AI answers to TTS via ElevenLabs.
- If OpenAI returns an `invalid_api_key` error, the backend now returns HTTP 401 with `errorType: 'API_KEY_INVALID'` to help the frontend provide a clear message. Rotate/revoke keys if exposed.

---

## Frontend setup

1. Install dependencies and run dev server:

```powershell
cd frontend
npm install
npm run dev
```

2. The app uses a small Vite proxy in development so relative API URLs like `/api/query` are proxied to the backend.

3. Build for production:

```powershell
cd frontend
npm run build
```

---

## Environment variables (summary)

Backend - `backend/.env` (example keys shown in `backend/.env.example` as placeholders):

- PORT — server port (default 3001)
- ELEVENLABS_API_KEY — API key for ElevenLabs TTS
- VOICE_ID — ElevenLabs voice id
- GEMINI_API_KEY — Google Gemini (Generative Language) API key
- OPENAI_API_KEY — OpenAI API key (used for Whisper, chat completions fallback)

Important: Do not commit `.env` to the repo. The repo `.gitignore` excludes `backend/.env`.

---

## API endpoints (backend)

All endpoints live under the backend server (default `http://localhost:3001`):

- GET `/health` — basic health check
- POST `/api/tts` — accepts JSON { text } and returns `audio/mpeg` (ElevenLabs)
- POST `/api/transcribe` — accepts form-data `audio` file and returns transcription JSON `{ text }` (OpenAI Whisper)
- POST `/api/query` — accepts JSON `{ question, context?, returnText? }` and returns an audio response (`audio/mpeg`) with the text included in header `X-Answer-Text`. If `returnText` is set or `response=text`, the server returns JSON `{ answer, service }` instead of TTS audio.
- POST `/api/summarize` — accepts a session JSON and returns a structured summary (tries Gemini then OpenAI)

Error behavior:
- If an upstream service returns an error, the backend returns a helpful error JSON. If OpenAI reports an invalid API key, the backend returns HTTP 401 with `errorType: 'API_KEY_INVALID'`.

---

## Troubleshooting & common errors

- `ERROR_CODE: FETCH_FAILED` or frontend can't reach `/api/query`: Check backend is running on `PORT` and Vite proxy is configured, or use the full backend URL in `frontend/src/config.ts`.
- `OpenAI API key invalid` / `invalid_api_key`: Revoke and rotate your OpenAI key immediately, update `backend/.env`, and restart the backend. Do NOT commit keys.
- `Audio playback error` when playing TTS: Check CORS, ensure backend returns `Content-Type: audio/mpeg` and the `X-Answer-Text` header is present.
- Large bundle warnings (Vite): The app currently bundles a lot of TFJS/Tensorflow modules. For production, consider dynamic imports for heavy modules and enable code-splitting.

If you need a fast check, run the backend health endpoint:

```powershell
Invoke-RestMethod http://localhost:3001/health
```

---

## Security & secrets

- Treat API keys as secrets. If you accidentally expose a key (e.g., commit it), assume it is compromised: revoke it in the provider dashboard and rotate to a new key.
- `backend/.env` must remain local and be listed in `.gitignore` (the repository already ignores `backend/.env`). If you have committed secrets, remove them from the repository and remote history (use BFG or git filter-repo) or at minimum `git rm --cached backend/.env` and rotate keys.
- Avoid logging full API keys. The backend should log `✓ Configured` vs `✗ Missing` rather than the keys themselves. Consider adding masking for accidental prints.

---

## Testing & validation

- There are no automated tests included by default. For changes to the AI proxy behavior, add unit tests around request/response parsing and error handling.
- Quick smoke tests:

  - Start backend and call `/api/query` with `returnText: true` to avoid TTS and see JSON:

  ```powershell
  Invoke-RestMethod -Method POST -Uri http://localhost:3001/api/query -ContentType 'application/json' -Body '{"question":"how deep?","context":"CPR training","returnText":true}'
  ```

---

## Deployment notes

- Use environment variables on your hosting platform. Do not commit secrets to the repository.
- If deploying frontend and backend together, consider serving the built frontend statically behind a simple web server and running the backend separately; configure CORS or an ingress/proxy to route `/api/*` to the backend.
