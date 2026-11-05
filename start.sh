#!/usr/bin/env bash
# Build (when needed) and serve the static game in the foreground.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT_DIR="$SCRIPT_DIR"
BUILD_DIR="$PROJECT_DIR/dist"
PORT="${PORT:-3000}"
WEB_DIR="${OPENCODE_WEB_DIR:-${RUNNER_TEMP:-/tmp}/omgithub-web}"
mkdir -p "$WEB_DIR"

run_timed() {
  local label="$1"
  shift
  echo "[timing] begin: $label"
  local started
  started="$(date +%s%3N)"
  /usr/bin/time -p "$@"
  local finished
  finished="$(date +%s%3N)"
  echo "[timing] end: $label ($((finished - started)) ms)"
}

write_metadata() {
  run_timed "write deployment metadata" node -e '
    const fs = require("node:fs");
    const path = require("node:path");
    const [output, project, directory] = process.argv.slice(1);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ project, directory }));
  ' "$WEB_DIR/deployment-output.json" "$PROJECT_DIR" "$BUILD_DIR"
}

dependency_hash() {
  node -e '
    const fs = require("node:fs");
    const crypto = require("node:crypto");
    const hash = crypto.createHash("sha256");
    for (const file of process.argv.slice(1)) if (fs.existsSync(file)) hash.update(fs.readFileSync(file));
    process.stdout.write(hash.digest("hex"));
  ' "$PROJECT_DIR/package.json" "$PROJECT_DIR/package-lock.json"
}

install_dependencies() {
  local stamp="$WEB_DIR/default-dependencies"
  local current=""
  [[ ! -f "$stamp" ]] || current="$(cat "$stamp")"
  local wanted
  wanted="$(dependency_hash)"
  if [[ ! -d "$PROJECT_DIR/node_modules/vite" || "$current" != "$wanted" ]]; then
    if [[ -f "$PROJECT_DIR/package-lock.json" ]]; then
      run_timed "install dependencies (npm ci)" npm ci --no-audit --no-fund
    else
      run_timed "install dependencies (npm install)" npm install --no-audit --no-fund
    fi
    printf '%s' "$(dependency_hash)" > "$stamp"
  else
    echo "[timing] skipped: dependencies already installed"
  fi
}

build_if_needed() {
  local needs_build=false
  if [[ ! -f "$BUILD_DIR/index.html" ]]; then
    needs_build=true
  else
    local changed
    changed="$(find "$PROJECT_DIR/src" "$PROJECT_DIR/public" -type f -newer "$BUILD_DIR/index.html" -print -quit 2>/dev/null || true)"
    [[ -z "$changed" ]] || needs_build=true
    local file
    for file in index.html package.json package-lock.json vite.config.js vite.config.mjs vite.config.ts; do
      if [[ -e "$PROJECT_DIR/$file" && "$PROJECT_DIR/$file" -nt "$BUILD_DIR/index.html" ]]; then
        needs_build=true
      fi
    done
  fi

  if [[ "$needs_build" == true ]]; then
    run_timed "build static output (npm run build)" npm run build
  else
    echo "[timing] skipped: static output is up to date"
  fi

  [[ -f "$BUILD_DIR/index.html" ]] || {
    echo "Build did not produce $BUILD_DIR/index.html" >&2
    exit 1
  }
}

write_metadata
install_dependencies
build_if_needed

export SERVE_ROOT="$BUILD_DIR"
export SERVE_PORT="$PORT"
run_timed "serve $BUILD_DIR on port $PORT (foreground)" node --input-type=module - <<'NODE'
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = resolve(process.env.SERVE_ROOT);
const port = Number(process.env.SERVE_PORT || process.env.PORT || 3000);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const clients = new Set();
const server = createServer((request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    if (url.pathname === '/__omgithub/live') {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive'
      });
      response.write(': connected\n\n');
      clients.add(response);
      request.on('close', () => clients.delete(response));
      return;
    }

    let file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + '/')) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file) && !extname(file)) file = join(root, 'index.html');

    const body = readFileSync(file);
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

const keepAlive = setInterval(() => {
  for (const client of clients) client.write(': keepalive\n\n');
}, 20000);

function shutdown() {
  clearInterval(keepAlive);
  for (const client of clients) client.end();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.on('error', error => {
  console.error(error);
  process.exit(1);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Serving ${root} at http://0.0.0.0:${port}/`);
});
NODE
