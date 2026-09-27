# Base image pinnata (prima era playwright/python:latest: ogni rebuild poteva
# cambiare browser e sistema sotto il BE). Il BE non usa playwright, ma l'immagine
# resta quella per non cambiare sistema operativo e versione di Python
# (in produzione gira python3.10 = Ubuntu jammy).
FROM mcr.microsoft.com/playwright/python:v1.63.0-jammy

WORKDIR /app

# Aumenta timeout pip per evitare ReadTimeout su reti lente
ENV PIP_DEFAULT_TIMEOUT=120
ENV PIP_NO_INPUT=1

# Install Python deps
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --timeout 120 --retries 5 -r /app/requirements.txt || \
	(sleep 5 && pip install --no-cache-dir --timeout 120 --retries 5 -r /app/requirements.txt)

# Copy application
COPY . /app

ENV PYTHONPATH=/app

RUN python -m pip install --upgrade pip

EXPOSE 8004

COPY ./start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
