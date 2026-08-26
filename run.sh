#!/usr/bin/env bash
# One command to build, start, and open the dockerized Ferdowsi stack.
#
#   ./run.sh            build + start (or restart) everything
#   ./run.sh stop        stop the containers, keep data volumes
#   ./run.sh down         stop and remove containers (keeps volumes)
#   ./run.sh reset         stop, remove containers AND volumes (fresh retrain)
#   ./run.sh logs           follow logs for both services
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but not found. Install Docker first: https://docs.docker.com/get-docker/" >&2
  exit 1
fi

COMPOSE="docker compose"
if ! $COMPOSE version >/dev/null 2>&1; then
  COMPOSE="docker-compose"
fi

case "${1:-up}" in
  up|start|"")
    echo "==> Building images..."
    $COMPOSE build
    echo "==> Starting containers (backend trains models on first boot, ~30-60s)..."
    $COMPOSE up -d
    echo "==> Waiting for the backend to become healthy..."
    for i in $(seq 1 60); do
      status=$($COMPOSE ps --format '{{.Health}}' backend 2>/dev/null || echo "")
      if [ "$status" = "healthy" ]; then
        break
      fi
      sleep 2
    done
    echo ""
    echo "Ferdowsi is up:"
    echo "  Dashboard:  http://localhost:8090"
    echo "  Backend API: http://localhost:8000/api"
    echo ""
    echo "Follow logs with: ./run.sh logs"
    ;;
  stop)
    $COMPOSE stop
    ;;
  down)
    $COMPOSE down
    ;;
  reset)
    $COMPOSE down -v
    ;;
  logs)
    $COMPOSE logs -f
    ;;
  *)
    echo "Usage: $0 [up|stop|down|reset|logs]" >&2
    exit 1
    ;;
esac
