#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_DIR="$PROJECT_DIR/.run"
LOG_DIR="$PROJECT_DIR/.run/logs"

mkdir -p "$RUN_DIR" "$LOG_DIR"

# Load env vars from ~/.agentara/.env if present (supports background launch)
AGENTARA_ENV="$HOME/.agentara/.env"
if [ -f "$AGENTARA_ENV" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$AGENTARA_ENV"
  set +a
fi

# Check if either process is already running
server_running=false
web_running=false

if [ -f "$RUN_DIR/server.pid" ] && kill -0 "$(cat "$RUN_DIR/server.pid")" 2>/dev/null; then
  server_running=true
fi
if [ -f "$RUN_DIR/web.pid" ] && kill -0 "$(cat "$RUN_DIR/web.pid")" 2>/dev/null; then
  web_running=true
fi

if [ "$server_running" = true ] || [ "$web_running" = true ]; then
  echo "Agentara is already running:"
  [ "$server_running" = true ] && echo "  server PID: $(cat "$RUN_DIR/server.pid")"
  [ "$web_running" = true ]    && echo "  web    PID: $(cat "$RUN_DIR/web.pid")"
  echo "Run 'make down' to stop first."
  exit 1
fi

# Clean up any stale PID files from previous runs
rm -f "$RUN_DIR/server.pid" "$RUN_DIR/web.pid"

# Check if port 1984 is already in use by another process
if lsof -iTCP:1984 -sTCP:LISTEN -t &>/dev/null; then
  echo "Port 1984 is already in use by another process:"
  lsof -iTCP:1984 -sTCP:LISTEN | tail -n +2 | awk '{printf "  PID %s: %s\n", $2, $1}'
  echo "Stop the conflicting process first, then retry."
  exit 1
fi

echo "Starting Agentara in the background..."

TS="$(date +%Y%m%d-%H%M%S)"
SERVER_LOG="$LOG_DIR/server-$TS.log"
WEB_LOG="$LOG_DIR/web-$TS.log"

# Start backend server
cd "$PROJECT_DIR"
nohup bun run dev:server > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!
sleep 1
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "  Server failed to start."
  echo "  Log: $SERVER_LOG"
  echo "  Last lines:"
  tail -5 "$SERVER_LOG" 2>/dev/null | sed 's/^/    /'
  exit 1
fi
echo "$SERVER_PID" > "$RUN_DIR/server.pid"
echo "$SERVER_LOG" > "$RUN_DIR/server.log.path"
echo "  Server started (PID: $SERVER_PID)"
echo "  Log: $SERVER_LOG"

# Start web dev server
nohup bun run dev:web > "$WEB_LOG" 2>&1 &
WEB_PID=$!
sleep 1
if ! kill -0 "$WEB_PID" 2>/dev/null; then
  echo "  Web failed to start."
  echo "  Log: $WEB_LOG"
  echo "  Last lines:"
  tail -5 "$WEB_LOG" 2>/dev/null | sed 's/^/    /'
  echo "  Cleaning up server process..."
  bash "$PROJECT_DIR/scripts/down.sh"
  exit 1
fi
echo "$WEB_PID" > "$RUN_DIR/web.pid"
echo "$WEB_LOG" > "$RUN_DIR/web.log.path"
echo "  Web started    (PID: $WEB_PID)"
echo "  Log: $WEB_LOG"

echo ""
echo "Agentara is running. Use 'tara stop' to stop."
