#!/usr/bin/env bash
# check-env.sh — validate .env against .env.example
# Runs automatically before `npm run dev` (predev hook).
#
# MISSING key  → exit 1 (hard fail — server won't start without it)
# OBSOLETE key → warning only (harmless extra var, but may indicate a rename)
#
# Usage:
#   bash check-env.sh        # run manually
#   npm run dev              # triggers automatically via predev hook

EXAMPLE=".env.example"
ENV_FILE=".env"
FAIL=0
WARN=0

# ANSI colors — disabled when output is not a terminal (CI, pipes)
if [ -t 1 ]; then
  RED=$'\033[0;31m'; YEL=$'\033[0;33m'; GRN=$'\033[0;32m'; NC=$'\033[0m'
else
  RED=''; YEL=''; GRN=''; NC=''
fi

if [ ! -f "$EXAMPLE" ]; then
  echo "${RED}ERROR${NC}: .env.example not found in $(pwd)"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "${RED}ERROR${NC}: .env not found."
  echo "  Run: cp .env.example .env"
  echo "  Then fill in your API keys."
  exit 1
fi

# Extract key names: lines matching UPPER_CASE_KEY= (ignores comments and blanks)
example_keys=$(grep -E '^[A-Z_][A-Z0-9_]*=' "$EXAMPLE" | cut -d= -f1 | sort)
env_keys=$(grep -E '^[A-Z_][A-Z0-9_]*=' "$ENV_FILE" | cut -d= -f1 | sort)

# MISSING: in .env.example but absent from .env
# Shows the default value from .env.example as a hint
while IFS= read -r key; do
  [ -z "$key" ] && continue
  default=$(grep "^${key}=" "$EXAMPLE" | cut -d= -f2-)
  echo "${RED}MISSING${NC}  ${key}=${default}"
  FAIL=1
done < <(comm -23 <(echo "$example_keys") <(echo "$env_keys"))

# OBSOLETE: in .env but absent from .env.example (renamed or removed)
while IFS= read -r key; do
  [ -z "$key" ] && continue
  echo "${YEL}OBSOLETE${NC} ${key}  ← not in .env.example (renamed or removed?)"
  WARN=1
done < <(comm -23 <(echo "$env_keys") <(echo "$example_keys"))

if [ "$FAIL" -eq 1 ]; then
  echo ""
  echo "${RED}Fix: add missing keys to .env (see .env.example for defaults), then retry.${NC}"
  exit 1
fi

if [ "$WARN" -eq 1 ]; then
  echo ""
  echo "${YEL}Check .env.example — some keys may have been renamed. Update .env if needed.${NC}"
fi

[ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ] && echo "${GRN}✓ .env is up to date${NC}"
exit 0
