<div align="center">
  <h1>🛡️ ANTIVIRUS PRO</h1>
  <p><strong>Next-Generation Multi-Layered Cybersecurity Protection Platform</strong></p>

  <img src="screenshots/demo_video.svg" alt="Real-time Demo" width="100%" style="border-radius: 12px; box-shadow: 0 0 20px rgba(0,255,65,0.2);">

  <br/><br/>

  ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
  ![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
  ![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)
  ![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
  ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
  ![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
</div>

---

## 📌 Overview

**Antivirus Pro** is a full-stack cybersecurity platform featuring a Rust-powered heuristic scan engine, a Python/FastAPI backend with VirusTotal & MetaDefender integration, and a real-time Next.js 15 SOC dashboard. Designed with a cyberpunk aesthetic, it delivers enterprise-grade threat detection with sub-millisecond analysis.

---

## ✨ Features

- 🔍 **Heuristic Engine** — Rust-based entropy scanning with `rayon` for parallel file analysis
- 🌐 **VirusTotal & MetaDefender Integration** — multi-engine cloud threat intelligence
- 📊 **Real-time SOC Dashboard** — WebSocket-powered live threat feed and system metrics
- 🔒 **Quarantine System** — automatic isolation of detected threats
- 📁 **File & Directory Scanner** — deep recursive scanning with customizable rules
- 🚨 **Threat Classification** — severity scoring (Critical / High / Medium / Low)
- 🗄️ **SQLite Persistence** — full scan history and threat log storage
- 🐳 **Docker-ready** — one-command deployment

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│           Next.js 15 SOC Dashboard          │  ← Real-time UI
│         (WebSocket + REST client)           │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│         FastAPI Backend (Python)            │  ← API & Logic
│   VirusTotal │ MetaDefender │ SQLite        │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│          Rust Heuristic Core                │  ← Scan Engine
│     rayon │ entropy │ signature matching    │
└─────────────────────────────────────────────┘
```

---

## 📸 Interface

<div align="center">
  <img src="screenshots/stage1.png" alt="Dashboard" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px;">
  <img src="screenshots/stage2.png" alt="Scan Engine" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px;">
  <img src="screenshots/stage3.png" alt="Threats & Quarantine" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px;">
  <img src="screenshots/stage4.png" alt="System Settings" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px;">
</div>

<div align="center">
  <img src="assets/screenshots/01_dashboard.png" alt="Main Dashboard" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px;">
  <img src="assets/screenshots/02_scan.png" alt="Active Scan" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px;">
  <img src="assets/screenshots/03_threats.png" alt="Threat Log" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px;">
  <img src="assets/screenshots/04_monitor.png" alt="System Monitor" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px;">
  <img src="assets/screenshots/05_settings.png" alt="Settings" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px;">
</div>

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, WebSocket |
| Backend | Python 3.11, FastAPI, SQLite, VirusTotal API |
| Scan Engine | Rust, rayon, sha2, serde |
| DevOps | Docker, Docker Compose, GitHub Actions |

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Rust (for local development)
- Python 3.11+
- Node.js 18+

### Run with Docker

```bash
git clone https://github.com/builtbysardor/antivirus-pro.git
cd antivirus-pro
cp .env.example .env   # Add your VirusTotal API key
make dev
```

App available at: `http://localhost:3000`

### Run Locally

```bash
# Install dependencies
make install

# Compile the Rust engine
make build-rust

# Start all services
make dev
```

---

## ⚙️ Configuration

```env
VIRUSTOTAL_API_KEY=your_api_key_here
METADEFENDER_API_KEY=your_api_key_here
DATABASE_URL=sqlite:///./antivirus.db
SCAN_THREADS=8
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/scan/file` | Scan a single file |
| `POST` | `/api/scan/directory` | Recursive directory scan |
| `GET` | `/api/threats` | List all detected threats |
| `POST` | `/api/quarantine/{id}` | Quarantine a threat |
| `GET` | `/api/stats` | Dashboard statistics |

---

## 📋 CI/CD

Automated testing and builds via GitHub Actions on every push to `main`.

---

## 📄 License

MIT © [Sardor Buriyev](https://github.com/builtbysardor)
