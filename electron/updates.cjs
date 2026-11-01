// Update check: asks GitHub for the latest release of this repository and compares
// versions. Nothing is downloaded or installed; the user opens the release page.
const { app, net, shell } = require('electron');
const store = require('./store.cjs');

const REPO = 'rodolfoxm/ctrl';
const RELEASES = `https://github.com/${REPO}/releases`;
const CACHE_MS = 6 * 36e5;

let cached = null; // { at, result }

/** Compares dotted versions ("1.2.0" vs "1.10.0"); a leading "v" is ignored. */
function newer(remote, local) {
  const parse = (v) => String(v).replace(/^v/i, '').split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const a = parse(remote);
  const b = parse(local);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

async function check(force) {
  const current = app.getVersion();
  if (!store.load().settings.checkUpdates && !force) return { enabled: false, current, available: false };
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.result;
  const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `ctrl/${current}` },
  });
  if (res.status === 404) return { enabled: true, current, available: false, checkedAt: new Date().toISOString() };
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}.`);
  const rel = await res.json();
  const version = String(rel.tag_name || '').replace(/^v/i, '');
  const result = {
    enabled: true,
    current,
    version,
    available: !!version && newer(version, current),
    url: rel.html_url || `${RELEASES}/latest`,
    notes: (rel.body || '').slice(0, 2000),
    publishedAt: rel.published_at,
    checkedAt: new Date().toISOString(),
  };
  cached = { at: Date.now(), result };
  return result;
}

/** Opens the release page; only this repository's pages are allowed. */
function openRelease() {
  const url = cached?.result?.url;
  shell.openExternal(url && url.startsWith(`${RELEASES}/`) ? url : `${RELEASES}/latest`);
  return { ok: true };
}

function openRepo() {
  shell.openExternal(`https://github.com/${REPO}`);
  return { ok: true };
}

module.exports = { check, openRelease, openRepo, newer, REPO };
