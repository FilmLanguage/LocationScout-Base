# LocationScout-Base

> **Location Scout** Agent — Film Language / Stanislavsky AI Platform

Location research agent. Finds and evaluates filming locations based on scene requirements and production design briefs.

## Role in Pipeline

| | |
|---|---|
| **Input Artifacts** | Scene Breakdown, Production Design |
| **Output Artifacts** | Location Bible, Location Options, Logistics Report |
| **Cloud Run Service** | `fl-location-scout-base` |
| **Protocol** | FLACP/1.0 |

## Architecture

```
API Layer (FastAPI) → Core Logic → Knowledge Base → Data Store
```

| Layer | Responsibility |
|-------|---------------|
| **API Layer** | REST endpoints, OpenAPI docs, health checks |
| **Core Logic** | Location Scout methodology implementation |
| **Knowledge Base** | Domain expertise, references, prompt templates |
| **Data Store** | PostgreSQL state, Cloud Storage artifacts |

## Quick Start

```bash
# Clone
git clone https://github.com/FilmLanguage/LocationScout-Base.git
cd LocationScout-Base

# Install dependencies
pip install -r requirements.txt

# Run locally
uvicorn src.agent:app --reload --port 8080

# Run with Docker
docker build -t fl-location-scout-base .
docker run -p 8080:8080 fl-location-scout-base
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check — status, version, uptime |
| GET | `/info` | Agent metadata — role, capabilities, version |
| POST | `/process` | Main endpoint — submit task for processing |
| GET | `/process/{task_id}/status` | Check task execution status |
| GET | `/process/{task_id}/result` | Get processing result |
| POST | `/feedback` | Receive feedback from other agents |
| GET | `/schema` | JSON schema of input/output data |
| GET | `/docs` | Swagger UI (auto-generated) |

## MCP Tools

| Tool | Description |
|------|-------------|
| `search_locations` | TODO |
| `evaluate_location` | TODO |
| `create_bible` | TODO |
| `assess_logistics` | TODO |

## Project Structure

```
LocationScout-Base/
├── README.md
├── LICENSE
├── CHANGELOG.md
├── Dockerfile
├── requirements.txt
├── cloudbuild.yaml
├── openapi.yaml
├── mcp-manifest.json
├── src/
│   ├── agent.py              # FastAPI entry point
│   ├── config.py             # Environment configuration
│   ├── api/                  # Route handlers
│   ├── core/                 # Business logic
│   ├── models/               # Pydantic / DB models
│   └── tools/                # External integrations
├── knowledge/
│   ├── methodology/          # Domain theory & principles
│   ├── references/           # Reference materials
│   ├── examples/             # Example inputs/outputs
│   └── prompts/              # LLM prompt templates
├── db/
│   ├── schema.sql            # Database DDL
│   └── migrations/
├── tests/
│   ├── unit/
│   └── integration/
├── docs/
│   ├── data-model.md
│   ├── api-examples.md
│   └── process.bpmn
└── .github/workflows/
    └── deploy.yaml
```

## Pre-Release Checklist

- [ ] Repository follows `{Role}-{Variant}` naming convention
- [ ] Branches: `main`, `release`, `development` exist
- [ ] README.md: description, quick start, artifacts list
- [ ] `openapi.yaml`: complete API specification, Swagger UI at `/docs`
- [ ] `mcp-manifest.json`: all tools and resources described
- [ ] Mandatory endpoints: `/health`, `/info`, `/process`, `/schema`
- [ ] Database schema in `db/schema.sql`, migrations configured
- [ ] Knowledge base populated in `knowledge/`
- [ ] BPMN process diagram in `docs/process.bpmn` + SVG export
- [ ] Dockerfile builds, cold start < 10 sec
- [ ] Unit tests cover core logic, integration tests cover API
- [ ] CI/CD pipeline (`cloudbuild.yaml` / GitHub Actions) configured
- [ ] FLACP envelope correctly formed and parsed
- [ ] Environment variables documented

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (set by Cloud Run) | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `GCS_BUCKET` | Cloud Storage bucket for artifacts | Yes |
| `ANTHROPIC_API_KEY` | Claude API key (via Secret Manager) | Per agent |
| `OPENAI_API_KEY` | OpenAI API key (via Secret Manager) | Per agent |
| `ORCHESTRATOR_URL` | Orchestrator callback URL | Yes |
| `AGENT_ENV` | Environment: dev / staging / prod | Yes |

## License

MIT — see [LICENSE](LICENSE)
