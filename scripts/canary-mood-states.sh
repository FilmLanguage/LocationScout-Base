#!/usr/bin/env bash
# Post-deploy canary for create_mood_states.
#
# Purpose: confirm the real LLM-driven mood-state generation works end-to-end
# against a live LocationScout deployment. Calls the MCP tool against an
# already-approved bible (defaults to the white-room scenario) and asserts
# the task completes with a non-empty mood_state_ids list.
#
# Usage:
#   AGENT_URL=https://fl-location-scout-base-...run.app \
#   INTER_AGENT_TOKEN=... \
#   PROJECT_ID=white-room-001 \
#   BIBLE_URI="agent://location-scout/bible/white-room-loc-001" \
#   ./scripts/canary-mood-states.sh
#
# Exit codes: 0 ok, 1 invocation/parse error, 2 task failed, 3 no mood_state_ids.

set -euo pipefail

AGENT_URL="${AGENT_URL:?AGENT_URL must be set (e.g. https://fl-location-scout-base-...run.app)}"
TOKEN="${INTER_AGENT_TOKEN:?INTER_AGENT_TOKEN must be set}"
BIBLE_URI="${BIBLE_URI:-agent://location-scout/bible/white-room-loc-001}"

req() {
  curl -sS --fail-with-body \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    "$@"
}

echo "[canary] calling create_mood_states on ${AGENT_URL} for ${BIBLE_URI}"

CALL_BODY=$(cat <<JSON
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_mood_states",
    "arguments": {
      "bible_uri": "${BIBLE_URI}",
      "scene_groups": [
        { "scene_ids": ["S1"], "act": 1, "time_of_day": "DAY", "context": "Entry — wide, high contrast" },
        { "scene_ids": ["S2"], "act": 1, "time_of_day": "DAY", "context": "Center — flat, shadowless" },
        { "scene_ids": ["S3"], "act": 1, "time_of_day": "DAY", "context": "Overhead — laboratory stillness" }
      ]
    }
  }
}
JSON
)

CALL_RES=$(req -X POST "${AGENT_URL}/mcp" -d "${CALL_BODY}")
TASK_ID=$(echo "${CALL_RES}" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(json.loads(d["result"]["content"][0]["text"])["task_id"])') \
  || { echo "[canary] could not parse task_id from response: ${CALL_RES}"; exit 1; }

echo "[canary] task_id=${TASK_ID} — polling get_task_status"

for i in $(seq 1 60); do
  STATUS_BODY=$(cat <<JSON
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_task_status","arguments":{"task_id":"${TASK_ID}"}}}
JSON
)
  STATUS_RES=$(req -X POST "${AGENT_URL}/mcp" -d "${STATUS_BODY}")
  STATUS=$(echo "${STATUS_RES}" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(json.loads(d["result"]["content"][0]["text"]).get("status",""))')
  echo "[canary] poll ${i}: status=${STATUS}"
  if [ "${STATUS}" = "completed" ] || [ "${STATUS}" = "failed" ]; then
    break
  fi
  sleep 2
done

if [ "${STATUS}" != "completed" ]; then
  echo "[canary] FAIL — task did not complete (final status: ${STATUS})"
  echo "${STATUS_RES}"
  exit 2
fi

ARTIFACT_COUNT=$(echo "${STATUS_RES}" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(len(json.loads(d["result"]["content"][0]["text"]).get("artifacts",[])))')
if [ "${ARTIFACT_COUNT}" -lt 1 ]; then
  echo "[canary] FAIL — task completed but produced 0 mood-state artifacts"
  echo "${STATUS_RES}"
  exit 3
fi

echo "[canary] OK — ${ARTIFACT_COUNT} mood-state artifacts saved"
echo "${STATUS_RES}" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(json.dumps(json.loads(d["result"]["content"][0]["text"]).get("artifacts",[]),indent=2))'
