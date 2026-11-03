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
  core: '/core',
  about: '/about',
};
const out = path.join(root, 'docs', 'screenshots');
fs.mkdirSync(out, { recursive: true });
for (const [name, route] of Object.entries(PAGES)) {
  const file = path.join(out, `${name}.png`);
  const before = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrl-shot-'));
  execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1440,900', '--virtual-time-budget=6000',
    `--user-data-dir=${profile}`, `--screenshot=${file}`, `${base}/?demo#${route}`], { stdio: 'ignore' });
  fs.rmSync(profile, { recursive: true, force: true });
  // Edge exits quietly when the page doesn't load (dev server down): don't report a stale file as new.
  if (!fs.existsSync(file) || fs.statSync(file).mtimeMs === before) throw new Error(`Nada foi salvo em ${name}.png. O npm run web está rodando em ${base}?`);
  console.log(`docs/screenshots/${name}.png`);
}
