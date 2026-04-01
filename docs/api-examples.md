# LocationScout-Base — API Examples

## Health Check

```bash
curl http://localhost:8080/health
```

Response:
```json
{"status": "ok", "version": "0.1.0", "uptime": 42.5}
```

## Submit Task

```bash
curl -X POST http://localhost:8080/process \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "flacp/1.0",
    "from": "1ad-base",
    "to": "location-scout",
    "task_id": "550e8400-e29b-41d4-a716-446655440000",
    "action": "process",
    "payload": {},
    "metadata": {
      "project_id": "project-uuid",
      "timestamp": "2026-04-01T12:00:00Z",
      "priority": "normal"
    }
  }'
```

## Check Status

```bash
curl http://localhost:8080/process/550e8400-e29b-41d4-a716-446655440000/status
```

## Get Result

```bash
curl http://localhost:8080/process/550e8400-e29b-41d4-a716-446655440000/result
```
