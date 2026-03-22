#!/usr/bin/env bash
set -euo pipefail

SELF="${BASH_SOURCE[0]}"
if [[ -L "$SELF" ]]; then
  SELF="$(readlink "$SELF")"
  [[ "$SELF" = /* ]] || SELF="$(dirname "${BASH_SOURCE[0]}")/$SELF"
fi
SCRIPT_DIR="$(cd "$(dirname "$SELF")" && pwd)"
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
    path_file="$PROJECT_DIR/.run/$target.log.path"
    if [ -f "$path_file" ]; then
      log_file="$(cat "$path_file")"
    else
      # fallback: find latest timestamped log
      log_file="$(ls -t "$PROJECT_DIR/.run/logs/$target-"*.log 2>/dev/null | head -1 || true)"
    fi
    if [ -z "$log_file" ] || [ ! -f "$log_file" ]; then
      echo "No log file found for: $target"
      exit 1
    fi
    echo "Tailing: $log_file"
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
