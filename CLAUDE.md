# Video to Profile Picture Generator

## Project Overview
A Dockerized Node.js microservice that takes a video file (mp4/webm), extracts the best diverse face frames using Python+OpenCV, and generates a professional profile picture using Google Gemini API with multi-image input.

## Tech Stack
- **Runtime:** Node.js 20+ with Express
- **Face Detection:** Python 3 + OpenCV + ffmpeg (sidecar process, invoked via child_process.spawn)
- **Image Generation:** Google Gemini API direct (NOT fal.ai, NOT Vertex AI)
- **Container:** Single Docker container containing Node.js, Python 3, ffmpeg, and OpenCV
- **Language:** TypeScript (ESM, compiled to `dist/` via `tsc`)

## Architecture

### Single Docker Container
Everything runs in one container:
- Node.js Express server (main process)
- Python script invoked as child process for video processing
- ffmpeg installed for frame extraction
- OpenCV (python3-opencv / cv2) for face detection

### Directory Structure
```
video-to-profile-pic/
├── CLAUDE.md
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts              # Express server entry point
│   ├── types.ts              # Shared TypeScript interfaces
│   ├── routes/
│   │   ├── upload.ts          # POST /upload (accepts video + optional country)
│   │   └── result.ts          # GET /result/:id
│   ├── services/
│   │   ├── jobManager.ts      # Job state management + cleanup
│   │   ├── videoProcessor.ts  # Orchestrates the pipeline (spawns Python, calls Gemini)
│   │   └── geminiClient.ts    # Google Gemini API image editing client (multi-image)
│   └── config.ts              # Environment config
├── scripts/
│   └── extract_best_frame.py  # Python script: ffmpeg extract + OpenCV face detect + diversity selection
├── dist/                      # Compiled JS output (gitignored)
└── tmp/                       # Created at runtime, gitignored
    └── jobs/                  # Per-job directories
```

## API Endpoints

### POST /upload
- **Content-Type:** multipart/form-data
- **Fields:**
  - `video` (file field) — required
  - `country` (text field) — optional, used for culturally appropriate backgrounds in generation
- **Accepted formats:** `video/mp4`, `video/webm`
- **Max file size:** 50MB
- **Response:** `{ "id": "<uuid>" }`
- **Behavior:** Saves the video to `/tmp/jobs/{id}/input.{ext}`, sets job status to `processing`, starts the background pipeline asynchronously (do NOT await), returns the id immediately.

### GET /result/:id
Single endpoint that behaves differently based on job status:
- **processing:** Returns JSON `{ "status": "processing", "step": "extracting_frames" | "detecting_faces" | "generating_image" }`
- **completed:** Returns the generated profile picture directly as `Content-Type: image/jpeg` (binary image response, NOT JSON)
- **failed:** Returns JSON `{ "status": "failed", "error": "<message>" }` with HTTP 500
- **not found / expired:** Returns HTTP 404 `{ "status": "not_found" }`

## Processing Pipeline (Background Job)

When a video is uploaded, the following pipeline runs asynchronously:

### Step 1: Frame Extraction + Face Detection (Python sidecar)
- Invoke `scripts/extract_best_frame.py` via `child_process.spawn`
- The Python script:
  1. Uses ffmpeg to extract frames at configured FPS from the video
  2. For each frame, runs OpenCV Haar Cascade face detection (`haarcascade_frontalface_default.xml`)
  3. For frames where a face is detected, calculates a sharpness score using Laplacian variance
  4. Selects the top N frames (default 3) with diversity — avoids visually similar/adjacent frames using frame index distance
  5. Saves selected frames as `/tmp/jobs/{id}/best_frame_0.jpg`, `best_frame_1.jpg`, etc.
  6. Outputs JSON to stdout: `{"frames": ["/tmp/jobs/{id}/best_frame_0.jpg", ...]}`
  7. If no face is found in any frame, exits with error code 1 and prints error to stderr

### Step 2: Gemini API Multi-Image-to-Image
- Read all selected frames from disk
- Send them all to Google Gemini API as multiple base64 inline images along with the profile picture prompt
- If a country was provided at upload, append country-specific context to the prompt
- Model: Use the current Gemini image generation capable model (e.g., `gemini-3.1-flash-image-preview` or latest available image model)
- The API call:
  ```
  POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
  Header: x-goog-api-key: {GEMINI_API_KEY}
  Body: {
    contents: [{
      parts: [
        { inline_data: { mime_type: "image/jpeg", data: "<base64_frame_0>" } },
        { inline_data: { mime_type: "image/jpeg", data: "<base64_frame_1>" } },
        { inline_data: { mime_type: "image/jpeg", data: "<base64_frame_2>" } },
        { text: "<PROFILE_PROMPT> + optional country context" }
      ]
    }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"]
    }
  }
  ```
- Extract the generated image from the response (it comes as base64 in the response parts)
- Save as `/tmp/jobs/{id}/result.{ext}`

### Step 3: Update Status
- Set job status to `completed`
- If any step fails, set status to `failed` with error message

## Job Management

### In-Memory Store
Use a simple Map or plain object to track jobs:
```js
{
  id: string,
  status: "processing" | "completed" | "failed",
  step: "extracting_frames" | "detecting_faces" | "generating_image" | null,
  error: string | null,
  createdAt: number (Date.now()),
  inputPath: string,
  resultPath: string | null,
  country: string | null
}
```

### Cleanup
- Run a `setInterval` every 5 minutes
- Delete job directories older than `JOB_TTL_MS` (default: 1 hour / 3600000ms)
- Remove the job entry from the in-memory store
- Use `fs.rm(jobDir, { recursive: true, force: true })` for cleanup

## Environment Variables
```
PORT=3000                          # Server port
GEMINI_API_KEY=                    # Google Gemini API key (required)
PROFILE_PROMPT="..."               # Prompt sent to Gemini for image generation
JOB_TTL_MS=3600000                 # Job time-to-live in ms (default: 1 hour)
MAX_FILE_SIZE_MB=50                # Max upload size in MB
FRAME_RATE=2                       # Frames per second to extract from video
NUM_FRAMES=3                       # Number of diverse face frames to extract and send to Gemini
```

## Docker Setup

### Dockerfile
- Base image: `node:20-slim`
- Install: `python3`, `python3-pip`, `ffmpeg`, `libgl1-mesa-glx`, `libglib2.0-0`
- Install Python packages: `opencv-python-headless`, `numpy`
- Copy project files, run `npm install`, compile with `tsc`, then `npm prune --production`
- Expose port 3000
- CMD: `node dist/index.js`

### docker-compose.yml
- Single service
- Mount `.env` file
- Port mapping: `3000:3000`
- No volumes needed (tmp is ephemeral)

## Python Script: extract_best_frame.py

### Interface
```bash
python3 scripts/extract_best_frame.py <input_video_path> <output_dir> [frame_rate] [num_frames]
```
- Reads the video from `<input_video_path>`
- Extracts frames using ffmpeg subprocess at configured FPS
- Runs face detection on each frame, scores by sharpness (Laplacian variance)
- Selects top N diverse frames using greedy index-distance selection (avoids adjacent/similar frames)
- Saves selected frames as `<output_dir>/best_frame_0.jpg`, `best_frame_1.jpg`, etc.
- Prints JSON to stdout: `{"frames": ["<path_0>", "<path_1>", ...]}`
- May return fewer than `num_frames` if not enough diverse face frames exist (minimum 1)
- Exit code 0 on success, 1 on failure (no face found, video error, etc.)
- Error messages go to stderr

### Face Detection Details
- Use OpenCV's `CascadeClassifier` with `haarcascade_frontalface_default.xml`
- `detectMultiScale` parameters: `scaleFactor=1.1, minNeighbors=5, minSize=(80, 80)`
- Sharpness score: `cv2.Laplacian(gray_face_region, cv2.CV_64F).var()`
- Diversity: minimum frame index distance of `total_frames / (num_frames * 2)` between selected frames

## Important Notes
- Do NOT use any third-party AI API wrapper (no fal.ai, no openrouter). Use Google Gemini API directly via HTTP fetch.
- The Node.js `@google/genai` SDK can be used if it simplifies things, but plain fetch is also fine.
- Video processing is async — the upload endpoint returns immediately.
- All file I/O happens in `/tmp/jobs/{id}/` directories.
- No database. Everything is in-memory + filesystem.
- The service is stateless across restarts (jobs are lost on restart, that's fine).
- Handle errors gracefully: if Gemini API fails, if Python script crashes, if video has no faces — all should result in a proper `failed` status with a descriptive error.
- Use `multer` for file upload handling with mime type filtering (only mp4 and webm).
