#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  echo "Usage: tara <command>"
  echo ""
  echo "Commands:"
  echo "  start    Start Agentara in the background"
  echo "  stop     Stop Agentara"
  echo "  restart  Restart Agentara"
  echo "  status   Show running status"
  echo "  logs     Tail logs (server|web, default: server)"
}

cmd="${1:-}"

case "$cmd" in
  start)
    bash "$SCRIPT_DIR/up.sh"
    ;;
  stop)
    bash "$SCRIPT_DIR/down.sh"
    ;;
  restart)
    bash "$SCRIPT_DIR/down.sh" || true
    bash "$SCRIPT_DIR/up.sh"
    ;;
  status)
    RUN_DIR="$PROJECT_DIR/.run"
    any_running=false

    for name in server web; do
      pid_file="$RUN_DIR/$name.pid"
      if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        echo "  $name: running (PID: $(cat "$pid_file"))"
        any_running=true
      else
        echo "  $name: stopped"
      fi
    done

    if [ "$any_running" = false ]; then
      exit 1
    fi
    ;;
  logs)
    target="${2:-server}"
    log_file="$PROJECT_DIR/.run/logs/$target.log"
    if [ ! -f "$log_file" ]; then
      echo "Log file not found: $log_file"
      exit 1
    fi
    tail -f "$log_file"
    ;;
  ""|help|--help|-h)
    usage
    ;;
  *)
    echo "Unknown command: $cmd"
    echo ""
    usage
    exit 1
    ;;
esac
