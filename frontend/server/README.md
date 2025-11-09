# PulseAI Remux Server

This minimal Express server accepts a recorded WebM upload and uses `ffmpeg` to trim/remux the last N seconds and return a clean MKV (or other format).

Requirements
- Node 14+
- ffmpeg installed and available on PATH

Install & run

```powershell
cd server
npm install
node index.js
```

Endpoint
- POST /remux
  - form field `file` - uploaded webm blob
  - optional field `trimSeconds` - integer (default 10)
  - optional field `outFormat` - `mkv` (default) or `mp4`

Response: downloadable remuxed file (attachment)

Notes
- This server transcodes video to H.264 and audio to AAC for robust playback.
- Running ffmpeg on server requires CPU and disk; for production consider background jobs and size limits.
