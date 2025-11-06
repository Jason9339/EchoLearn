# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EchoLearn is a language learning application with voice conversion capabilities, built with Next.js 15 (frontend) and Flask/FreeVC (backend). The project enables users to practice language shadowing with voice conversion features.

## Development Commands

### Frontend (Next.js)
```bash
# Development server (uses Turbopack)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Backend (Python Worker)
```bash
# Setup (first time only)
cd worker
uv venv
source .venv/bin/activate
uv pip install -r src/FreeVC/requirements.txt

# Start Flask server
cd worker
source .venv/bin/activate
python src/app.py
```

The Flask server runs on `http://localhost:5001`.

### Database Migrations
SQL migration files are located in `migrations/`. Run these manually via your PostgreSQL client or admin tool.

## Architecture

### Frontend Structure

- **Next.js 15 App Router**: Uses the `app/` directory structure
- **TypeScript**: Path alias `@/*` maps to `./src/*`
- **Authentication**: NextAuth v5 with credentials provider
  - JWT session strategy (session cookies expire on browser close)
  - Password hashing with bcrypt
  - Auth logic in `src/auth.ts` and `src/auth.config.ts`
- **Database**: PostgreSQL via `postgres` package (not Prisma)
  - Connection string from `POSTGRES_URL` env variable
  - Raw SQL queries with tagged template literals
- **Styling**: Tailwind CSS v4

### Backend Structure (Python Worker)

- **Framework**: Flask with Flask-CORS
- **Architecture**: Follows Routes → Services pattern for separation of concerns
- **Voice Conversion**: FreeVC model (see `worker/src/FreeVC/`)
- **Routes Structure** (`worker/src/routes/`):
  - `example.py` - Example blueprint
  - `audio.py` - Audio processing endpoints (template for future features)
  - `voice_conversion.py` - Voice conversion HTTP handlers
- **Services Layer** (`worker/src/services/`):
  - `voice_conversion_service.py` - FreeVC model management and conversion logic
  - `audio_service.py` - Audio processing services (template)
- **Model Loading**: FreeVC models (synthesizer, WavLM, speaker encoder) loaded once at app startup
- **Temporary Files**: Audio processing creates temp directories with UUID names, cleaned up after processing

### API Proxy Architecture

The Next.js app proxies requests to the Python backend:

1. Frontend makes requests to `/api/worker/*`
2. Next.js catch-all route at `src/app/api/worker/[...slug]/route.ts` forwards to Python backend
3. Python backend URL is set via `BACKEND_API_URL` environment variable
4. Supports Cloudflare Tunnel for local development (see `worker/readme.md`)

### Key Components

- **AudioPlayer** (`src/components/AudioPlayer.tsx`): Audio playback UI
- **RecordingButton** (`src/components/RecordingButton.tsx`): Audio recording interface (large, ~14KB)
- **RatingBar** (`src/components/RatingBar.tsx`): User rating component
- **useAudioRecorder** (`src/hooks/useAudioRecorder.ts`): Audio recording logic

### Type Definitions

Located in `src/app/lib/definitions.ts`:
- `User`: user account with optional student_id, gender, age, consent fields
- `Course`: language course data
- `PracticeSentence`: shadowing practice sentences with translations

## Environment Variables

Required environment variables (see `env.template`):

**Database (Supabase/PostgreSQL)**:
- `POSTGRES_URL` - Main connection URL
- `POSTGRES_URL_NON_POOLING` - Non-pooled connection (used for `DATABASE_URL`)
- `POSTGRES_PRISMA_URL` - Prisma connection URL
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_DATABASE`
- `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Authentication**:
- `AUTH_SECRET` - NextAuth secret

**Backend**:
- `BACKEND_API_URL` - Python Flask backend URL (e.g., `http://localhost:5001`)

## Git LFS (Large File Storage)

This repository uses Git LFS for large model files (`.pth` files). See `GIT_LFS_GUIDE.md` for full instructions.

**Quick setup**:
```bash
# Install Git LFS
brew install git-lfs  # macOS
git lfs install

# Clone and pull LFS files
git clone <repo-url>
cd EchoLearn
git lfs pull
```

**Important LFS files**:
- `worker/src/FreeVC/checkpoints/freevc.pth` - Main FreeVC model (download from [OneDrive](https://1drv.ms/u/s!AnvukVnlQ3ZTx1rjrOZ2abCwuBAh?e=UlhRR5))
- `worker/src/FreeVC/wavlm/WavLM-Large.pt` - WavLM model (download from [WavLM repository](https://github.com/microsoft/unilm/tree/master/wavlm))
- `worker/src/FreeVC/speaker_encoder/ckpt/pretrained_bak_5805000.pt` - Speaker encoder (included)

## Server Actions

Server actions are in `src/app/lib/actions.ts`:
- `authenticate()` - Login with credentials
- `registerAction()` - User registration with auto-login
- `updateUserInfo()` - Update user profile (student_id, gender, age, consent)

All server actions use raw SQL queries with the `postgres` package.

## Voice Conversion with FreeVC

### Overview

The backend uses [FreeVC](https://github.com/OlaWod/FreeVC) for high-quality text-free one-shot voice conversion. FreeVC converts the voice in source audio to match a target speaker while preserving the original content.

### How FreeVC Works

1. **Content Extraction**: Uses WavLM-Large to extract content features from source audio (what is being said)
2. **Speaker Encoding**: Uses speaker encoder to extract speaker characteristics from target audio (how it should sound)
3. **Voice Synthesis**: VITS-based synthesizer combines content + speaker identity to generate converted audio

### Key Features

- **Text-Free**: No transcription required - works directly with audio
- **One-Shot**: Only needs a single sample of target voice
- **16kHz Output**: Generates mono audio at 16kHz sampling rate
- **CPU-Compatible**: Runs on CPU (no GPU required)

### Required Models

All models are stored via Git LFS in `worker/src/FreeVC/`:
- `checkpoints/freevc.pth` (473 MB) - Main synthesizer model
- `wavlm/WavLM-Large.pt` (1.2 GB) - Content encoder
- `speaker_encoder/ckpt/pretrained_bak_5805000.pt` (17 MB) - Speaker encoder

### API Endpoint

**Endpoint**: `POST /api/worker/voice-conversion/convert`

**Request**: `multipart/form-data`
- `source_audio`: Source audio file (.wav) - content to preserve
- `target_audio`: Target audio file (.wav) - voice to mimic

**Response**: Converted audio file (.wav, 16kHz mono)

**Direct Backend** (when running Flask server locally):
```bash
curl -X POST \
  -F "source_audio=@source.wav" \
  -F "target_audio=@target.wav" \
  http://localhost:5001/worker/voice-conversion/convert \
  -o converted.wav
```

**Via Next.js Proxy** (in production/development):
```bash
curl -X POST \
  -F "source_audio=@source.wav" \
  -F "target_audio=@target.wav" \
  http://localhost:3000/api/worker/voice-conversion/convert \
  -o converted.wav
```

### Implementation Details

**Service Layer** (`worker/src/services/voice_conversion_service.py`):
- `load_models(hpfile, ptfile)` - Load FreeVC models at startup
- `are_models_loaded()` - Check if models are initialized
- `convert_voice(source_path, target_path, output_path)` - Perform voice conversion

**Route Layer** (`worker/src/routes/voice_conversion.py`):
- Handles HTTP request/response
- Validates uploaded files
- Manages temporary file storage
- Calls service layer for conversion

**Model Loading**: Models are loaded once at application startup in `app.py` to avoid repeated loading overhead (~3-4 seconds initial load time).

## Development Notes

- **Python Version**: Python 3.11+ (recommended: 3.12.7)
- **Package Manager**: Uses `uv` for Python package management
- **Turbopack**: Enabled for faster dev server and builds
- **Session Management**: Sessions are browser-session only (expire on close)
- **CORS**: Flask backend allows requests from `https://echo-learn.vercel.app` and `localhost:3000`
