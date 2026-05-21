<div align="center">
  <h1>🛡️ ANTIVIRUS PRO</h1>
  <p><strong>Next-Generation Heuristic Threat Protection Platform</strong></p>
  
  <img src="screenshots/demo_video.svg" alt="Real-time Demo" width="100%" style="border-radius: 12px; box-shadow: 0 0 20px rgba(0,255,65,0.2);">
</div>

---

## ⚡ BENTO ARCHITECTURE

Antivirus Pro runs on a cutting-edge triple-layered architecture, offering zero latency and maximum threat containment:

1. **Rust Core:** Bare-metal heuristic analysis and entropy scanning via `rayon`.
2. **FastAPI Hub:** Neural proxy that synchronizes telemetry and manages SQLite persistence.
3. **Cyberpunk Command Center:** Next.js 15 realtime cockpit delivering deep network visibility.

---

## 📸 INTERFACE STAGES

Explore the pitch-black, cyberpunk-themed command center designed for maximum threat visibility.

<div align="center">
  <img src="screenshots/stage1.png" alt="Dashboard" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px;">
  <img src="screenshots/stage2.png" alt="Scan Engine" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px;">
  <img src="screenshots/stage3.png" alt="Threats & Quarantine" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px;">
  <img src="screenshots/stage4.png" alt="System Settings" width="48%" style="border-radius: 8px; border: 1px solid #00ff41; margin: 4px;">
</div>

---

## 🚀 ENTERPRISE DEPLOYMENT

```bash
# 1. Clone the repository
git clone https://github.com/builtbysardor/antivirus-pro.git

# 2. Install core dependencies
make install

# 3. Compile the Rust Engine
make build-rust

# 4. Boot the Network
make dev
```

*Engineered with Rust, Python, and Next.js 15.*
