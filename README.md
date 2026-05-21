# Antivirus Pro

![Python](https://img.shields.io/badge/Python-3.11%2B-blue?logo=python&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.75%2B-orange?logo=rust&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

Antivirus Pro is a full-stack cybersecurity scanner with a Rust heuristic engine, FastAPI backend, and Next.js dashboard.

---

## Features

- **Rust-powered heuristic analysis** — multi-threaded file scanning via `rayon` with entropy scoring, PE header inspection, and suspicious-string matching
- **VirusTotal cloud scanning** — optional cloud reputation lookup against 70+ antivirus engines via the VirusTotal v3 API
- **Real-time file system monitoring** — `notify`-based watcher that continuously monitors configured directories and auto-scans new/modified files
- **File quarantine with XOR obfuscation** — infected files are isolated and obfuscated in a configurable quarantine directory so they cannot execute
- **WebSocket progress streaming** — live scan-progress events pushed to the dashboard over WebSockets for immediate feedback
- **Dark cyberpunk UI** — Next.js 15 dashboard with Tailwind CSS, real-time charts, and a threat-level colour system

---

## Architecture

Antivirus Pro is composed of three loosely-coupled layers that communicate over HTTP/WebSocket:

```
┌─────────────────────────────────────────────────────┐
│                   Browser / Client                  │
│          Next.js 15  ·  Tailwind CSS  ·  Recharts   │
│               http://localhost:3000                 │
└────────────────────────┬────────────────────────────┘
                         │ REST + WebSocket
┌────────────────────────▼────────────────────────────┐
│                  Python Backend                     │
│     FastAPI  ·  aiosqlite  ·  httpx  ·  aiofiles    │
│               http://localhost:8000                 │
└───────────┬────────────────────────┬────────────────┘
            │ subprocess / FFI       │ VirusTotal API
┌───────────▼────────────┐    ┌──────▼──────────────┐
│      Rust Core         │    │   VirusTotal v3      │
│  av-core binary        │    │   (cloud, optional)  │
│  heuristics · rayon    │    └─────────────────────┘
│  sha2 · notify · regex │
└────────────────────────┘
```

| Layer | Responsibility |
|---|---|
| **Rust core** (`core/`) | CPU-intensive heuristic scanning, hash computation, real-time FS monitoring |
| **Python backend** (`backend/`) | REST API, WebSocket hub, DB persistence, quarantine management, VirusTotal proxy |
| **Next.js frontend** (`frontend/`) | Interactive dashboard, file upload, scan history, quarantine management |

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/builtbysardor/antivirus-pro.git
cd antivirus-pro

# 2. Install all dependencies (Python + Node.js)
make install

# 3. Build the Rust heuristic engine
make build-rust

# 4. Start both dev servers (backend on :8000, frontend on :3000)
make dev
```

> **Tip:** Run `make help` at any time to see all available Make targets.

---

## Configuration

Copy `.env.example` to `.env` and set the variables below before starting the server.

| Variable | Default | Description |
|---|---|---|
| `VIRUSTOTAL_API_KEY` | *(none)* | VirusTotal v3 API key. Leave empty to disable cloud scanning. |
| `DATABASE_URL` | `sqlite:///./av.db` | SQLite or PostgreSQL connection string for scan history. |
| `QUARANTINE_DIR` | `/tmp/av_quarantine` | Directory where quarantined files are stored (XOR-obfuscated). |
| `DEV_MODE` | `false` | Set to `true` to enable verbose logging and skip production guards. |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/scan/upload` | Upload a file for scanning; returns a scan `id` immediately. |
| `GET` | `/api/scan/result/{id}` | Fetch the completed scan result by scan ID. |
| `GET` | `/api/scan/history` | List all past scans (paginated). |
| `GET` | `/api/stats` | Aggregate statistics (total scans, threats found, clean files). |
| `GET` | `/api/scan/quarantine` | List all files currently in quarantine. |
| `POST` | `/api/scan/quarantine` | Quarantine a specific file by path. |
| `DELETE` | `/api/scan/quarantine` | Restore or permanently delete a quarantined file. |
| `GET` | `/health` | Liveness probe — returns `{"status": "ok"}`. |

Full interactive docs are available at `http://localhost:8000/docs` (Swagger UI) and `http://localhost:8000/redoc` (ReDoc) when the backend is running.

---

## Tech Stack

### Rust Core (`core/`)

| Crate | Purpose |
|---|---|
| `tokio` | Async runtime for the realtime monitor |
| `rayon` | Data-parallel file scanning |
| `notify` | Cross-platform file system event watcher |
| `sha2` | SHA-256 hash computation for signature matching |
| `regex` | Suspicious-string pattern matching |
| `clap` | CLI argument parsing for the `av-core` binary |

### Python Backend (`backend/`)

| Package | Purpose |
|---|---|
| `FastAPI` | Async REST API framework |
| `uvicorn` | ASGI server with WebSocket support |
| `aiofiles` | Non-blocking file I/O for uploads and quarantine |
| `aiosqlite` | Async SQLite adapter for scan history |
| `httpx` | Async HTTP client for VirusTotal API calls |

### TypeScript Frontend (`frontend/`)

| Package | Purpose |
|---|---|
| `Next.js 15` | React framework with App Router and server components |
| `Tailwind CSS` | Utility-first CSS — dark cyberpunk theme |
| `Recharts` | Animated charts for scan statistics |
| `Lucide React` | Icon library |

---

## Development

```bash
make help            # list all targets
make install         # install dependencies
make build-rust      # compile Rust engine (release)
make build-frontend  # compile Next.js production build
make build           # both of the above
make dev             # start backend + frontend dev servers
make test-rust       # run Rust unit tests
make lint            # run ESLint on the frontend
make docker-up       # build & start the full Docker Compose stack
make docker-down     # stop the Docker Compose stack
make clean           # remove all build artefacts
```

---

## Docker

The project ships with a `docker-compose.yml` at the repo root.

```bash
make docker-up    # builds and starts all services
make docker-down  # tears everything down
```

Services exposed:

| Service | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:8000` |
| API Docs | `http://localhost:8000/docs` |

---

## License

This project is licensed under the [MIT License](LICENSE).

---

*Built with Rust, Python, and TypeScript by [builtbysardor](https://github.com/builtbysardor).*
