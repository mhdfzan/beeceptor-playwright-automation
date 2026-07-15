#!/usr/bin/env node
// @ts-check

/**
 * scripts/record-demo.js
 *
 * One-command demo recorder.
 *
 *   1. Runs the Playwright suite in headed + slow-mo mode.
 *   2. Walks the resulting test-results/ tree and copies each step's
 *      video into a top-level `demo/` folder with human-readable names
 *      (e.g. `demo/01-authenticate.webm`).
 *   3. Prints a summary + links.
 *
 * Invoke with:
 *    npm run demo
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(ROOT, 'test-results');
const DEMO_DIR = path.join(ROOT, 'demo');

function log(line) {
  console.log(`\x1b[36m[record-demo]\x1b[0m ${line}`);
}

function runSuite() {
  return new Promise((resolve) => {
    log('Launching Playwright in headed + slow-mo mode…');
    const child = spawn('npx', ['playwright', 'test', '--headed'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, SLOW_MO: process.env.SLOW_MO || '500' },
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => resolve(code ?? 0));
  });
}

/**
 * Recursively walk `dir` and return the absolute paths of every `.webm` file.
 * @param {string} dir
 * @returns {string[]}
 */
function findVideos(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findVideos(full));
    else if (entry.isFile() && entry.name.endsWith('.webm')) out.push(full);
  }
  return out;
}

/**
 * Turn a Playwright test-results folder name like
 *   "http-callout-Beeceptor-HTT-6df1e-outbound-HTTP-Callout-actually-fired-chromium"
 * into a short, human-readable slug like "6-outbound-http-callout-actually-fired".
 * @param {string} raw
 */
function humanize(raw) {
  const withoutHash = raw.replace(/[a-f0-9]{5,}-?/g, '');
  const cleaned = withoutHash
    .replace(/^http-callout-Beeceptor-HTTP-Callout-Rule-E2E-/i, '')
    .replace(/-chromium$/, '')
    .replace(/-{2,}/g, '-')
    .toLowerCase();
  return cleaned || raw;
}

function copyVideos() {
  const videos = findVideos(RESULTS_DIR);
  if (videos.length === 0) {
    log('No videos found under test-results/ — did the suite actually run?');
    return [];
  }

  if (!fs.existsSync(DEMO_DIR)) fs.mkdirSync(DEMO_DIR, { recursive: true });
  else {
    // Clean the demo dir so re-runs don't accumulate stale files.
    for (const f of fs.readdirSync(DEMO_DIR)) fs.unlinkSync(path.join(DEMO_DIR, f));
  }

  // Playwright creates one folder per test whose name starts with the file
  // name — sort them lexicographically to preserve step order (01…08).
  const sorted = videos.sort((a, b) => a.localeCompare(b));
  const copied = [];
  sorted.forEach((src, idx) => {
    const parent = path.basename(path.dirname(src));
    const slug = humanize(parent);
    const stepNum = String(idx + 1).padStart(2, '0');
    const destName = `${stepNum}-${slug}.webm`;
    const dest = path.join(DEMO_DIR, destName);
    fs.copyFileSync(src, dest);
    copied.push(dest);
  });
  return copied;
}

(async () => {
  const code = await runSuite();
  const copied = copyVideos();

  console.log('');
  log(`Suite exit code: ${code}`);
  if (copied.length) {
    log(`Copied ${copied.length} video(s) into ./demo/`);
    for (const c of copied) {
      log(`  • ${path.relative(ROOT, c)}`);
    }
    log('');
    log('Next: record a short screen+webcam voiceover on top of one of these');
    log('videos (Loom / OBS / QuickTime) and attach it to the assignment form.');
  }
  process.exit(code);
})();
