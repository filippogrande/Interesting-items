.PHONY: dev-backend dev-frontend start-bot

# BE: FastAPI + modelli DB
dev-backend:
	python -m venv .venv && . .venv/bin/activate && pip install -r backend/requirements.txt
	uvicorn app.server:app --reload --app-dir backend

# FE: React + Vite
dev-frontend:
	cd frontend && npm install && npm run dev

# BOT: Telegram + scraper (parla al BE via HTTP)
start-bot:
	cd bot && python -m app.main
