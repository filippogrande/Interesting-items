FROM mcr.microsoft.com/playwright/python:latest

WORKDIR /app

ENV PIP_DEFAULT_TIMEOUT=120
ENV PIP_NO_INPUT=1

COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --timeout 120 --retries 5 -r /app/requirements.txt || \
	(sleep 5 && pip install --no-cache-dir --timeout 120 --retries 5 -r /app/requirements.txt)

COPY . /app

ENV PYTHONPATH=/app

RUN python -m pip install --upgrade pip
RUN playwright install --with-deps chromium || true

COPY ./start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
