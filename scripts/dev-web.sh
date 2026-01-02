#!/bin/bash
#
# Development script for kustomark web UI
# Launches both client and server in development mode
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
PORT="${KUSTOMARK_PORT:-3000}"
HOST="${KUSTOMARK_HOST:-localhost}"
BASE_DIR="${KUSTOMARK_BASE_DIR:-.}"

echo -e "${GREEN}Starting kustomark web UI in development mode...${NC}"
echo -e "  Base directory: ${BASE_DIR}"
echo -e "  Server: http://${HOST}:${PORT}"
echo -e "  Client: http://${HOST}:5173"
echo ""

# Check if we're in the project root
if [ ! -f "package.json" ]; then
  echo -e "${RED}Error: Must run from project root${NC}"
  exit 1
fi

# Check if src/web exists
if [ ! -d "src/web" ]; then
  echo -e "${RED}Error: src/web directory not found${NC}"
  exit 1
fi

# Function to cleanup background processes on exit
cleanup() {
  echo -e "\n${YELLOW}Shutting down development servers...${NC}"
  jobs -p | xargs -r kill 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Start the backend server
echo -e "${GREEN}Starting backend server...${NC}"
KUSTOMARK_BASE_DIR="${BASE_DIR}" \
KUSTOMARK_PORT="${PORT}" \
KUSTOMARK_HOST="${HOST}" \
bun run src/web/server/index.ts &

SERVER_PID=$!

# Give server time to start
sleep 2

# Check if server is still running
if ! kill -0 $SERVER_PID 2>/dev/null; then
  echo -e "${RED}Error: Backend server failed to start${NC}"
  exit 1
fi

echo -e "${GREEN}Backend server started (PID: ${SERVER_PID})${NC}"

# Start the frontend dev server
echo -e "${GREEN}Starting frontend dev server...${NC}"
cd src/web/client
VITE_API_URL="http://${HOST}:${PORT}" bun run dev &

CLIENT_PID=$!
cd ../../..

echo -e "${GREEN}Frontend dev server started (PID: ${CLIENT_PID})${NC}"
echo ""
echo -e "${GREEN}Web UI is ready!${NC}"
echo -e "  Backend API: http://${HOST}:${PORT}"
echo -e "  Frontend:    http://${HOST}:5173"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"

# Wait for both processes
wait
