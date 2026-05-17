FROM mcr.microsoft.com/playwright/python:latest

WORKDIR /app

# Aumenta timeout pip per evitare ReadTimeout su reti lente
ENV PIP_DEFAULT_TIMEOUT=120
ENV PIP_NO_INPUT=1

# Install Python deps
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --timeout 120 --retries 5 -r /app/requirements.txt || \
	(sleep 5 && pip install --no-cache-dir --timeout 120 --retries 5 -r /app/requirements.txt)
RUN pip install --no-cache-dir psycopg2-binary || true

# Copy application
COPY . /app

ENV PYTHONPATH=/app

RUN python -m pip install --upgrade pip
RUN playwright install --with-deps chromium || true

EXPOSE 8004

COPY ./start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
