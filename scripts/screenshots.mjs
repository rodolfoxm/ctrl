// Captures the README screenshots from the browser mode (npm run web must be running).
// Usage: node scripts/screenshots.mjs [baseUrl]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] || 'http://127.0.0.1:5174';
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const PAGES = {
  overview: '/',
  tweaks: '/performance/cpu',
  profiles: '/profiles',
  verify: '/guardian',
  games: '/gaming/live',
  about: '/about',
};
const out = path.join(root, 'docs', 'screenshots');
fs.mkdirSync(out, { recursive: true });
for (const [name, route] of Object.entries(PAGES)) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrl-shot-'));
  execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1440,900', '--virtual-time-budget=6000',
    `--user-data-dir=${profile}`, `--screenshot=${path.join(out, `${name}.png`)}`, `${base}/?demo#${route}`], { stdio: 'ignore' });
  fs.rmSync(profile, { recursive: true, force: true });
  console.log(`docs/screenshots/${name}.png`);
}
