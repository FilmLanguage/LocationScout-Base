#!/usr/bin/env bash
# Canary: verify v2.tasks dual-write is live after deploy.
#
# Usage (run from repo root after deploying LocationScout):
#   MCP_URL=https://location-scout-xxx-ew.a.run.app \
#   PSQL_DSN="host=... dbname=... user=... password=... sslmode=require" \
#   bash scripts/canary-task-persist.sh
#
# Expects: a row in v2.tasks for the task_id returned by create_mood_states.

set -euo pipefail

MCP_URL="${MCP_URL:?MCP_URL must be set}"
PSQL_DSN="${PSQL_DSN:?PSQL_DSN must be set}"
BIBLE_ID="${BIBLE_ID:-canary_bible_001}"

echo "[canary-task-persist] calling create_mood_states on $MCP_URL …"

RESPONSE=$(curl -sf -X POST "$MCP_URL/mcp" \
  -H "Content-Type: application/json" \
  -d "{
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"create_mood_states\",
      \"arguments\": {
        \"bible_uri\": \"agent://location-scout/bible/${BIBLE_ID}\",
        \"scene_groups\": [{\"scene_group_id\": \"canary_sg_001\", \"scenes\": [\"S1\"]}]
      }
    }
  }")

TASK_ID=$(echo "$RESPONSE" | grep -o '"task_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -z "$TASK_ID" ]]; then
  echo "[canary-task-persist] ERROR: no task_id in response"
  echo "$RESPONSE"
  exit 1
fi

echo "[canary-task-persist] got task_id=$TASK_ID — querying v2.tasks …"

# Give the fire-and-forget write a moment to land.
sleep 2

ROW=$(psql "$PSQL_DSN" -tAc \
  "SELECT task_id, agent, status FROM v2.tasks WHERE task_id = '$TASK_ID'")

if [[ -z "$ROW" ]]; then
  echo "[canary-task-persist] FAIL: no row found in v2.tasks for task_id=$TASK_ID"
  exit 1
fi

echo "[canary-task-persist] PASS: $ROW"
