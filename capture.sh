#!/usr/bin/env bash
# Capture desktop and mobile screenshots of a running preview.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT_DIR="$SCRIPT_DIR"
CAPTURE_URL="${CAPTURE_URL:-}"
CAPTURE_DIR="${CAPTURE_DIR:-}"
PLAYWRIGHT_RUNTIME="${PLAYWRIGHT_RUNTIME:-${OMGITHUB_PLAYWRIGHT_DIR:-$HOME/.local/share/omgithub-playwright}}"

if [[ -z "$CAPTURE_URL" || -z "$CAPTURE_DIR" ]]; then
  echo "Set CAPTURE_URL and CAPTURE_DIR." >&2
  exit 1
fi

CAPTURE_DIR="$(realpath -m -- "$CAPTURE_DIR")"
PROJECT_REAL="$(realpath -m -- "$PROJECT_DIR")"
case "$CAPTURE_DIR/" in
  "$PROJECT_REAL"/*)
    echo "CAPTURE_DIR must be outside the project source: $CAPTURE_DIR" >&2
    exit 1
    ;;
esac

run_timed() {
  local label="$1"
  shift
  echo "[timing] begin: $label"
  local started
  started="$(date +%s%3N)"
  "$@"
  local finished
  finished="$(date +%s%3N)"
  echo "[timing] end: $label ($((finished - started)) ms)"
}

run_timed "create capture directory" mkdir -p "$CAPTURE_DIR"

export CAPTURE_URL CAPTURE_DIR PROJECT_DIR PLAYWRIGHT_RUNTIME

set +e
/usr/bin/time -p node --input-type=module - <<'NODE'
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const env = process.env;
const runtime = env.PLAYWRIGHT_RUNTIME;
const url = env.CAPTURE_URL;
const output = resolve(env.CAPTURE_DIR);
const project = resolve(env.PROJECT_DIR);

if (!existsSync(join(runtime, 'node_modules', 'playwright'))) {
  console.error(`[capture] Playwright runtime not found at ${runtime}`);
  process.exit(1);
}
mkdirSync(output, { recursive: true });

const require = createRequire(join(runtime, 'package.json'));
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  console.error(`[capture] Could not load Playwright: ${error.message}`);
  process.exit(1);
}

let config = { browser: { launchOptions: {} } };
const configFile = join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json');
if (existsSync(configFile)) config = JSON.parse(readFileSync(configFile, 'utf8'));
if (process.platform === 'linux' && existsSync(join(runtime, 'display'))) {
  env.DISPLAY ||= ':' + readFileSync(join(runtime, 'display'), 'utf8').trim();
}

class CaptureError extends Error {
  constructor(message, exitCode) {
    super(message);
    this.exitCode = exitCode;
  }
}
const transient = (message, error) => new CaptureError(
  `${message}${error ? `: ${error.message}` : ''}`,
  75
);
const defect = (message, error) => new CaptureError(
  `${message}${error ? `: ${error.message}` : ''}`,
  1
);

const startedAt = Date.now();
const elapsed = () => `${Date.now() - startedAt} ms`;

async function waitForReady(page, label) {
  const started = Date.now();
  await page.waitForFunction(() => Boolean(window.__EGS) && window.__EGS.phase === 'menu', null, { timeout: 30000 })
    .catch(error => { throw defect(`[${label}] game did not reach the menu`, error); });
  console.log(`[timing] ${label} boot/menu: ${Date.now() - started} ms`);

  const canvasReady = await page.evaluate(() => {
    const canvas = document.querySelector('#stage');
    return Boolean(canvas && canvas.width > 0 && canvas.height > 0 && canvas.clientWidth > 0 && canvas.clientHeight > 0);
  });
  if (!canvasReady) throw defect(`[${label}] game canvas did not render`);
}

async function startRun(page, label) {
  const started = Date.now();
  const response = await page.locator('#playBtn').click({ timeout: 10000 })
    .then(() => true)
    .catch(async () => {
      await page.evaluate(() => document.getElementById('playBtn')?.click());
      return false;
    });
  await page.waitForFunction(() => window.__EGS?.phase === 'playing', null, { timeout: 15000 })
    .catch(error => { throw defect(`[${label}] gameplay did not start`, error); });
  console.log(`[timing] ${label} play click (${response ? 'locator' : 'dom'}): ${Date.now() - started} ms`);
  await page.waitForTimeout(1400);
}

async function captureView(browser, name, width, height) {
  const started = Date.now();
  const context = await browser.newContext({ viewport: { width, height } })
    .catch(error => { throw transient(`[${name}] could not create browser context`, error); });
  const page = await context.newPage()
    .catch(error => { throw transient(`[${name}] could not open page`, error); });
  page.setDefaultTimeout(30000);

  const pageErrors = [];
  page.on('pageerror', error => {
    console.error(`[capture] ${name} page error: ${error.message}`);
    pageErrors.push(error.message);
  });
  const origin = new URL(url).origin;
  page.on('response', response => {
    if (response.status() >= 400 && new URL(response.url()).origin === origin) {
      console.error(`[capture] ${name} HTTP ${response.status()}: ${response.url()}`);
    }
  });

  try {
    const navigationStarted = Date.now();
    const response = await page.goto(url, { waitUntil: 'load', timeout: 45000 })
      .catch(error => { throw transient(`[${name}] navigation failed`, error); });
    if (!response) throw transient(`[${name}] navigation returned no response`);
    if (!response.ok()) {
      const code = !response.status() || [408, 429, 500, 502, 503, 504].includes(response.status()) ? 75 : 1;
      throw new CaptureError(`[${name}] HTTP ${response.status()} loading preview`, code);
    }
    console.log(`[timing] ${name} navigation (${response.status()}): ${Date.now() - navigationStarted} ms`);

    await page.locator('#app').waitFor({ state: 'visible', timeout: 30000 })
      .catch(error => { throw defect(`[${name}] app root did not render`, error); });
    await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 30000 })
      .catch(error => { throw defect(`[${name}] fonts did not load`, error); });

    await waitForReady(page, name);
    await startRun(page, name);

    if (pageErrors.length) throw defect(`[${name}] page errors during render: ${pageErrors.join('; ')}`);

    const screenshotStarted = Date.now();
    const file = join(output, `final-${name}.png`);
    await page.screenshot({ path: file, timeout: 30000 })
      .catch(error => {
        if (error.name === 'TimeoutError' || !browser.isConnected()) {
          throw transient(`[${name}] screenshot failed`, error);
        }
        throw defect(`[${name}] screenshot failed`, error);
      });
    const size = statSync(file).size;
    if (size < 1000) throw defect(`[${name}] screenshot is unexpectedly small (${size} bytes)`);
    console.log(`[timing] ${name} screenshot: ${Date.now() - screenshotStarted} ms -> ${file}`);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
  console.log(`[timing] ${name} total: ${Date.now() - started} ms`);
}

let browser;
let exitCode = 0;
try {
  const launchStarted = Date.now();
  browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 })
    .catch(error => { throw transient('browser launch failed', error); });
  console.log(`[timing] browser launch: ${Date.now() - launchStarted} ms`);

  await captureView(browser, 'desktop', 1440, 900);
  await captureView(browser, 'mobile', 390, 844);
  console.log(`[timing] capture complete: ${elapsed()}`);
} catch (error) {
  console.error(error?.stack || error);
  exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
} finally {
  if (browser) {
    const closeStarted = Date.now();
    await browser.close().catch(error => {
      console.error(`[capture] browser close failed: ${error.message}`);
      if (!exitCode) exitCode = 75;
    });
    console.log(`[timing] browser close: ${Date.now() - closeStarted} ms`);
  }
}

process.exitCode = exitCode;
NODE
status=$?
set -e

echo "[timing] capture.sh finished with exit code $status"
exit "$status"
