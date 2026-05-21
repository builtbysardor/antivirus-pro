# =============================================================================
# Antivirus Pro — Makefile
# =============================================================================
# Usage: make <target>
# Run `make help` to see all available targets.
# =============================================================================

# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------
PYTHON         := .venv/bin/python
UVICORN        := .venv/bin/uvicorn
UVICORN_HOST   := 0.0.0.0
UVICORN_PORT   := 8000

# ANSI colour codes (work on most POSIX terminals)
BOLD   := \033[1m
RESET  := \033[0m
CYAN   := \033[36m
GREEN  := \033[32m
YELLOW := \033[33m
RED    := \033[31m

# ---------------------------------------------------------------------------
# .PHONY
# ---------------------------------------------------------------------------
.PHONY: help install build-rust build-frontend build \
        dev-backend dev-frontend dev \
        test-rust lint \
        docker-up docker-down \
        clean hash-update

# ---------------------------------------------------------------------------
# Default target
# ---------------------------------------------------------------------------
help: ## Show this help message
	@printf "\n$(BOLD)$(CYAN)  Antivirus Pro — Available Make Targets$(RESET)\n"
	@printf "$(CYAN)  ==========================================$(RESET)\n\n"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { \
		printf "  $(GREEN)%-18s$(RESET) %s\n", $$1, $$2 \
	}' $(MAKEFILE_LIST)
	@printf "\n$(YELLOW)  Variables:$(RESET)\n"
	@printf "    PYTHON         = $(PYTHON)\n"
	@printf "    UVICORN_HOST   = $(UVICORN_HOST)\n"
	@printf "    UVICORN_PORT   = $(UVICORN_PORT)\n\n"

# ---------------------------------------------------------------------------
# Installation
# ---------------------------------------------------------------------------
install: ## Install all Python and Node.js dependencies
	@printf "$(BOLD)$(CYAN)>>> Installing Python dependencies...$(RESET)\n"
	$(PYTHON) -m pip install -r backend/requirements.txt
	@printf "$(BOLD)$(CYAN)>>> Installing Node.js dependencies...$(RESET)\n"
	cd frontend && npm install --legacy-peer-deps
	@printf "$(GREEN)>>> Dependencies installed successfully.$(RESET)\n"

# ---------------------------------------------------------------------------
# Build targets
# ---------------------------------------------------------------------------
build-rust: ## Build the Rust av-core engine (release profile)
	@printf "$(BOLD)$(CYAN)>>> Building Rust engine...$(RESET)\n"
	cd core && cargo build --release
	@printf "$(GREEN)>>> Rust build complete: core/target/release/av-core$(RESET)\n"

build-frontend: ## Build the Next.js production bundle
	@printf "$(BOLD)$(CYAN)>>> Building Next.js frontend...$(RESET)\n"
	cd frontend && npm run build
	@printf "$(GREEN)>>> Frontend build complete.$(RESET)\n"

build: build-rust build-frontend ## Build both Rust engine and Next.js frontend

# ---------------------------------------------------------------------------
# Development servers
# ---------------------------------------------------------------------------
dev-backend: ## Start the FastAPI backend with hot-reload
	@printf "$(BOLD)$(CYAN)>>> Starting FastAPI backend on $(UVICORN_HOST):$(UVICORN_PORT)...$(RESET)\n"
	$(UVICORN) backend.main:app --reload --host $(UVICORN_HOST) --port $(UVICORN_PORT)

dev-frontend: ## Start the Next.js development server
	@printf "$(BOLD)$(CYAN)>>> Starting Next.js dev server...$(RESET)\n"
	cd frontend && npm run dev

dev: ## Start backend (background) + frontend dev servers together
	@printf "$(BOLD)$(CYAN)>>> Starting Antivirus Pro in development mode...$(RESET)\n"
	@printf "$(YELLOW)  Backend  →  http://$(UVICORN_HOST):$(UVICORN_PORT)$(RESET)\n"
	@printf "$(YELLOW)  Frontend →  http://localhost:3000$(RESET)\n"
	@printf "$(YELLOW)  Press Ctrl+C to stop the frontend (backend PID stored in /tmp/av-backend.pid)$(RESET)\n\n"
	@$(UVICORN) backend.main:app --reload --host $(UVICORN_HOST) --port $(UVICORN_PORT) & \
		echo $$! > /tmp/av-backend.pid
	@cd frontend && npm run dev ; \
		if [ -f /tmp/av-backend.pid ]; then \
			kill $$(cat /tmp/av-backend.pid) 2>/dev/null || true; \
			rm -f /tmp/av-backend.pid; \
		fi

# ---------------------------------------------------------------------------
# Testing & Linting
# ---------------------------------------------------------------------------
test-rust: ## Run the Rust test suite
	@printf "$(BOLD)$(CYAN)>>> Running Rust tests...$(RESET)\n"
	cd core && cargo test
	@printf "$(GREEN)>>> Rust tests passed.$(RESET)\n"

lint: ## Lint the Next.js frontend with ESLint
	@printf "$(BOLD)$(CYAN)>>> Running ESLint on frontend...$(RESET)\n"
	cd frontend && npm run lint

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------
docker-up: ## Build images and start all services via Docker Compose
	@printf "$(BOLD)$(CYAN)>>> Starting Docker Compose stack...$(RESET)\n"
	docker compose up -d --build
	@printf "$(GREEN)>>> Stack is up. Run 'make docker-down' to stop.$(RESET)\n"

docker-down: ## Stop and remove all Docker Compose containers
	@printf "$(BOLD)$(CYAN)>>> Stopping Docker Compose stack...$(RESET)\n"
	docker compose down
	@printf "$(GREEN)>>> Stack stopped.$(RESET)\n"

# ---------------------------------------------------------------------------
# Maintenance
# ---------------------------------------------------------------------------
clean: ## Remove build artefacts (Rust target/, frontend/.next, __pycache__)
	@printf "$(BOLD)$(RED)>>> Cleaning build artefacts...$(RESET)\n"
	cd core && cargo clean
	rm -rf frontend/.next
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@printf "$(GREEN)>>> Clean complete.$(RESET)\n"

hash-update: ## Regenerate malware hash signatures (requires scripts/update_hashes.py)
	@printf "$(BOLD)$(CYAN)>>> Updating malware hash signatures...$(RESET)\n"
	$(PYTHON) scripts/update_hashes.py
	@printf "$(GREEN)>>> Hash signatures updated.$(RESET)\n"
