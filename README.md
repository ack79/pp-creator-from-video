# Video to Profile Picture Generator

A Dockerized microservice that extracts the best face frame from a video and generates a professional profile picture using Google Gemini API.

## How It Works

1. Upload an MP4 or WebM video (optionally specify a country)
2. The service extracts multiple frames and selects the top diverse face frames using OpenCV
3. Those frames are sent to Google Gemini API to generate a polished profile picture
4. Poll for the result and download the final image

## Quick Start

### Prerequisites

- Docker and Docker Compose
- A [Google Gemini API key](https://aistudio.google.com/apikey)

### Setup

```bash
# Clone the repo
git clone <repo-url> && cd pp-creator

# Configure your API key
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here

# Build and run
docker compose up --build
```

The server starts at `http://localhost:6232`.

## API

### Upload a Video

```
POST /upload
Content-Type: multipart/form-data
```

| Field | Type | Description |
|-------|------|-------------|
| `video` | file | MP4 or WebM video (max 50MB) |
| `country` | text | *(Optional)* Country of the person, used to generate culturally appropriate backgrounds |

**Response** `202`

```json
{ "id": "a1b2c3d4-..." }
```

**Example**

```bash
curl -X POST -F "video=@myvideo.mp4" -F "country=Turkey" http://localhost:6232/upload
```

### Check Result

```
GET /result/:id
```

**Processing** `200`

```json
{ "status": "processing", "step": "extracting_frames" }
```

Steps progress through: `extracting_frames` → `detecting_faces` → `generating_image`

**Completed** `200` — Returns the image directly as `image/png`.

```bash
curl http://localhost:6232/result/a1b2c3d4-... --output profile.png
```

**Failed** `500`

```json
{ "status": "failed", "error": "No face detected in any frame" }
```

**Not Found** `404`

```json
{ "status": "not_found" }
```

### Health Check

```
GET /health
```

Returns `{ "status": "ok" }`.

## Configuration

All options are set via environment variables in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `6232` | Server port |
| `GEMINI_API_KEY` | — | **Required.** Google Gemini API key |
| `PROFILE_PROMPT` | *(see .env.example)* | Prompt sent to Gemini for image generation |
| `JOB_TTL_MS` | `3600000` | Job expiry time in ms (1 hour) |
| `MAX_FILE_SIZE_MB` | `50` | Max upload file size |
| `FRAME_RATE` | `2` | Frames per second to extract from video |
| `NUM_FRAMES` | `3` | Number of diverse face frames to send to Gemini |

## Project Structure

```
├── Dockerfile
├── docker-compose.yml
├── package.json
├── scripts/
│   └── extract_best_frame.py   # Frame extraction + face detection
├── tsconfig.json
├── src/
│   ├── index.ts                # Express server
│   ├── config.ts               # Environment config
│   ├── types.ts                # Shared TypeScript interfaces
│   ├── routes/
│   │   ├── upload.ts           # POST /upload
│   │   └── result.ts           # GET /result/:id
│   └── services/
│       ├── jobManager.ts       # In-memory job store + cleanup
│       ├── videoProcessor.ts   # Processing pipeline orchestrator
│       └── geminiClient.ts     # Gemini API client
```

## Tech Stack

- **Node.js 20** + Express + **TypeScript**
- **Python 3** + OpenCV for face detection
- **ffmpeg** for frame extraction
- **Google Gemini API** for image generation (multi-image input)
- **Docker** — single container with all dependencies

## Notes

- Jobs are stored in memory and on disk under `/tmp/jobs/`. They are automatically cleaned up after 1 hour.
- State is not persisted across container restarts.
- The service processes one video at a time per upload — there is no queue, but multiple concurrent uploads are supported.

## License

MIT
