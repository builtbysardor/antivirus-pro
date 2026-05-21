<div align="center">
  <img src="screenshots/dashboard_v2.png" alt="Antivirus Pro - Enterprise Cybersecurity" style="border-radius: 12px; border: 2px solid #00ff41; box-shadow: 0 0 20px rgba(0, 255, 65, 0.2); margin-bottom: 20px;">

  <h1>🛡️ ANTIVIRUS PRO</h1>
  <p><strong>Next-Generation Heuristic Threat Detection & Response Engine</strong></p>

  <p>
    <a href="https://rust-lang.org"><img src="https://img.shields.io/badge/Rust-1.75%2B-FA4F00?style=for-the-badge&logo=rust&logoColor=white" alt="Rust"></a>
    <a href="https://python.org"><img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"></a>
    <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-00FF41?style=for-the-badge&logo=opensourceinitiative&logoColor=white" alt="License"></a>
  </p>
</div>

---

## ⚡ ARCHITECTURE OVERVIEW

Antivirus Pro deploys a zero-trust, high-performance architecture operating across three isolated layers. The multi-threaded Rust core handles bare-metal heuristic scanning, communicating securely via REST/WebSocket to the FastAPI hub, ultimately rendered in a low-latency Next.js cyberpunk command center.

```text
+-------------------------------------------------------------+
|                     COMMAND CENTER                          |
|             Next.js 15  ·  Tailwind  ·  Recharts            |
|                   [ Port 3000 ]                             |
+------------------------------+------------------------------+
                               | WSS / HTTPS
+------------------------------v------------------------------+
|                    NEURAL PROXY HUB                         |
|         FastAPI  ·  aiosqlite  ·  httpx  ·  aiofiles        |
|                   [ Port 8000 ]                             |
+--------------+-------------------------------+--------------+
               | FFI / Subprocess              | VirusTotal API
+--------------v---------------+ +-------------v--------------+
|        HEURISTIC CORE        | |      THREAT INTEL          |
|    Rust · rayon · notify     | |      VirusTotal v3         |
|  Entropy · PE Header Checks  | |   (Global Reputation)      |
+------------------------------+ +----------------------------+
```

---

## 🎛️ BENTO FEATURES

<table>
<tr>
<td width="50%">
  <h3>🔬 Rust-Powered Heuristics</h3>
  <p>Multi-threaded file scanning utilizing <code>rayon</code>. Executes high-speed entropy scoring, PE header anomaly inspection, and pattern-based suspicious string matching at bare-metal speeds.</p>
</td>
<td width="50%">
  <h3>🌐 Global Threat Intel</h3>
  <p>Integrates instantly with VirusTotal v3 API. Performs optional cloud reputation lookups against 70+ top-tier antivirus engines to validate zero-day heuristics.</p>
</td>
</tr>
<tr>
<td width="50%">
  <h3>👁️ Real-Time Monitoring</h3>
  <p>Deploys a <code>notify</code>-based active file system watcher. Continuously monitors highly-sensitive directories, automatically intercepting and scanning new or modified binaries.</p>
</td>
<td width="50%">
  <h3>🔒 Cryptographic Quarantine</h3>
  <p>Infected payloads are instantly isolated, stripped of execution privileges, and obfuscated using XOR cryptography to completely neutralize lateral movement risks.</p>
</td>
</tr>
<tr>
<td width="50%">
  <h3>📡 WebSocket Telemetry</h3>
  <p>Pushes live, sub-millisecond telemetry directly to the dashboard. Operators receive real-time scan progress and threat alerts over an encrypted WebSocket stream.</p>
</td>
<td width="50%">
  <h3>🟩 Cyberpunk Cockpit</h3>
  <p>A sleek, pitch-black Next.js 15 command centre engineered with Tailwind CSS. Features dynamic data visualizations, live charts, and a neon-green threat level taxonomy.</p>
</td>
</tr>
</table>

---

## 📸 INTERFACE SHOWCASE

Explore the pitch-black, cyberpunk-themed Next.js 15 command center designed for maximum threat visibility.

<div align="center">
  <img src="screenshots/dashboard_v2.png" alt="Dashboard" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px; box-shadow: 0 0 10px rgba(0,255,65,0.1);">
  <img src="screenshots/scan.png" alt="Scan Engine" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px; box-shadow: 0 0 10px rgba(0,255,65,0.1);">
  <img src="screenshots/threats.png" alt="Threats & Quarantine" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px; box-shadow: 0 0 10px rgba(0,255,65,0.1);">
  <img src="screenshots/settings.png" alt="System Settings" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px; box-shadow: 0 0 10px rgba(0,255,65,0.1);">
</div>

---

## 🔌 API ROUTING MATRIX

The FastAPI hub exposes a robust suite of RESTful endpoints designed for enterprise automation and SIEM integration.

| Method | Endpoint | Authorization | Description |
|:---|:---|:---|:---|
| <kbd>POST</kbd> | `/api/scan/upload` | Bearer Token | Ingests a payload for immediate heuristic and signature analysis. Returns a UUID. |
| <kbd>GET</kbd> | `/api/scan/result/{id}` | Bearer Token | Fetches the comprehensive cryptographic report and verdict for a specific scan UUID. |
| <kbd>GET</kbd> | `/api/scan/history` | Bearer Token | Retrieves a paginated, temporal log of all historical scan telemetry. |
| <kbd>GET</kbd> | `/api/stats` | Bearer Token | Exports aggregate threat metrics (total ingested, neutralized, clean vectors). |
| <kbd>GET</kbd> | `/api/scan/quarantine` | Bearer Token | Lists all XOR-obfuscated payloads currently residing in the isolation matrix. |
| <kbd>POST</kbd> | `/api/scan/quarantine` | Bearer Token | Manually intercepts and isolates a specified file path into quarantine. |
| <kbd>DELETE</kbd> | `/api/scan/quarantine` | Bearer Token | Permanently incinerates or restores an isolated payload. |
| <kbd>GET</kbd> | `/health` | Public | Liveness probe. Returns `{"status": "ok"}` for orchestration load balancers. |

> **Interactive Swagger UI:** Available at `http://localhost:8000/docs`

---

## 🚀 DEPLOYMENT

```bash
# 1. Establish secure connection & clone repository
git clone https://github.com/builtbysardor/antivirus-pro.git
cd antivirus-pro

# 2. Provision node and python environments
make install

# 3. Compile the Rust heuristic binary (Release Mode)
make build-rust

# 4. Initialize the Cyberpunk Command Center & API Hub
make dev
```

### Environment Configuration

Clone `.env.example` to `.env` and provision the following variables:

| Variable | Description |
|:---|:---|
| `VIRUSTOTAL_API_KEY` | Your VT v3 API Key for global threat intel (Optional). |
| `DATABASE_URL` | SQLite or PostgreSQL URI for telemetry persistence (Default: `sqlite:///./av.db`). |
| `QUARANTINE_DIR` | Absolute path for the XOR-isolated payload storage (Default: `/tmp/av_quarantine`). |
| `DEV_MODE` | Boolean toggle for verbose logging and active debugging (Default: `false`). |

---

## 🐳 CONTAINERIZATION

Engineered for seamless orchestration via Docker Compose.

```bash
make docker-up    # Provision and spin up all microservices
make docker-down  # Halt operations and teardown network
```

| Service | Protocol | Binding |
|:---|:---|:---|
| **Command Center (UI)** | HTTP | `localhost:3000` |
| **Neural Hub (API)** | HTTP/WS | `localhost:8000` |

---

## 📜 LICENSE

Classified under the [MIT License](LICENSE). 

<div align="right">
  <i>Forged with Rust, Python, and TypeScript by <a href="https://github.com/builtbysardor">builtbysardor</a>.</i>
</div>
