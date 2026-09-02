#!/usr/bin/env bash
# Invision Local Admin & Audit Dashboard Launcher

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PORT="${1:-8888}"

echo "=================================================="
echo "🎧 Iniciando Panel Administrativo Local de Invision"
echo "🌐 URL: http://localhost:$PORT"
echo "=================================================="

python3 "$DIR/server.py" "$PORT"
