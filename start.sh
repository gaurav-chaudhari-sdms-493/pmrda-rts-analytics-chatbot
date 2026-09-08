#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Trap signals to cleanly terminate both processes on exit / Ctrl+C
cleanup() {
    echo ""
    echo "Stopping all Vanna services..."
    kill $(jobs -p) 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# 1. Determine Python binary
if [ -f "$SCRIPT_DIR/venv/bin/python" ]; then
    PYTHON_BIN="$SCRIPT_DIR/venv/bin/python"
else
    PYTHON_BIN="python3"
fi

echo "=================================================="
echo "⚡ Starting Vanna Agent Stack (Backend & Frontend)"
echo "=================================================="

# 2. Start FastAPI Backend (Port 8000)
echo "[1/2] Starting FastAPI Backend on http://127.0.0.1:8000..."
"$PYTHON_BIN" main.py &
BACKEND_PID=$!

# Wait briefly for backend initialization
sleep 2

# 3. Start Web Components Frontend (Port 5173)
if [ -d "$SCRIPT_DIR/frontends/webcomponent" ]; then
    echo "[2/2] Starting Vite Frontend on http://localhost:5173..."
    cd "$SCRIPT_DIR/frontends/webcomponent"
    npm run dev -- --host &
    FRONTEND_PID=$!
fi

echo "=================================================="
echo "✅ Services Started!"
echo "👉 FastAPI Backend:  http://127.0.0.1:8000"
echo "👉 Web Component UI: http://localhost:5173/"
echo "Press Ctrl+C to stop all services."
echo "=================================================="

# Wait for background jobs
wait
