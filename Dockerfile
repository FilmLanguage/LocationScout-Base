FROM python:3.12-slim AS base

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY knowledge/ ./knowledge/
COPY openapi.yaml .
COPY mcp-manifest.json .

ENV PORT=8080
EXPOSE ${PORT}

CMD ["uvicorn", "src.agent:app", "--host", "0.0.0.0", "--port", "8080"]
