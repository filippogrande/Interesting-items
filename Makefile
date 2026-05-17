.PHONY: dev-backend dev-frontend start-worker start-bot

dev-backend:
	python -m venv .venv && . .venv/bin/activate && pip install -r backend/requirements.txt
	uvicorn backend.app.main:app --reload

dev-frontend:
	cd frontend && npm install && npm run dev

start-worker:
	rq worker --with-scheduler default

start-bot:
	python -m backend.app.bot
