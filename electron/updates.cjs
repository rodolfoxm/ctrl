// Update check: asks GitHub for the latest release of this repository and compares
// versions. The installer is downloaded only when the user asks (Instalar agora), and checked first.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app, net, shell } = require('electron');
const store = require('./store.cjs');

const REPO = 'rodolfoxm/ctrl';
const RELEASES = `https://github.com/${REPO}/releases`;
const CACHE_MS = 36e5;

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

const INSTALLER = /^ctrl-Setup-[\d.]+\.exe$/;

async function check(force) {
  const current = app.getVersion();
  if (!store.load().settings.checkUpdates && !force) return { enabled: false, current, available: false };
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.result;
  const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases?per_page=8`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `ctrl/${current}` },
  });
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}.`);
  // The newest published release plus the two before it; older notes stay on GitHub.
  const releases = (await res.json()).filter((r) => !r.draft && !r.prerelease).slice(0, 3);
  const rel = releases[0];
  if (!rel) return { enabled: true, current, available: false, checkedAt: new Date().toISOString() };
  const version = String(rel.tag_name || '').replace(/^v/i, '');
  const exe = (rel.assets || []).find((a) => INSTALLER.test(a.name));
  const result = {
    enabled: true,
    current,
    version,
    available: !!version && newer(version, current),
    url: rel.html_url || `${RELEASES}/latest`,
    publishedAt: rel.published_at,
    releases: releases.map((r) => ({ version: String(r.tag_name || '').replace(/^v/i, ''), date: r.published_at, url: r.html_url, notes: (r.body || '').slice(0, 8000) })),
    asset: exe ? { name: exe.name, url: exe.browser_download_url, size: exe.size, digest: exe.digest || null } : null,
    checkedAt: new Date().toISOString(),
  };
  cached = { at: Date.now(), result };
  return result;
}

/**
 * Downloads the newest installer from this repository's release, checks its size and the SHA-256 GitHub
 * publishes for it, and returns the local path. Only an asset found by `check` can be downloaded.
 */
async function download(onProgress = () => {}) {
  const asset = cached?.result?.available ? cached.result.asset : null;
  if (!asset) throw new Error('Não há atualização para baixar.');
  if (!asset.url.startsWith(`${RELEASES}/download/`) || !INSTALLER.test(asset.name)) throw new Error('Endereço de download inesperado.');
  const file = path.join(app.getPath('temp'), asset.name);
  const res = await net.fetch(asset.url);
  if (!res.ok) throw new Error(`Download falhou (${res.status}).`);
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(file);
  const reader = res.body.getReader();
  let got = 0;
  let lastTick = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
      got += value.length;
      if (!out.write(value)) await new Promise((r) => out.once('drain', r));
      if (Date.now() - lastTick > 200) {
        lastTick = Date.now();
        onProgress({ got, size: asset.size });
      }
    }
  } finally {
    await new Promise((r) => out.end(r));
  }
  const sha = hash.digest('hex');
  if ((asset.size && got !== asset.size) || (asset.digest?.startsWith('sha256:') && asset.digest.slice(7) !== sha)) {
    fs.rmSync(file, { force: true });
    throw new Error('O arquivo baixado não confere com o publicado no GitHub. Tente de novo.');
  }
  onProgress({ got, size: asset.size, done: true });
  return file;
}

/** Opens the release page; only this repository's pages are allowed. */
function openRelease() {
  const url = cached?.result?.url;
  shell.openExternal(url && url.startsWith(`${RELEASES}/`) ? url : `${RELEASES}/latest`);
  return { ok: true };
}

// Voluntary support page on the author's site. Fixed address: nothing from the renderer is opened here.
const SUPPORT_URL = 'https://www.mojinho.com.br/apoiar';

function openSupport() {
  shell.openExternal(SUPPORT_URL);
  return { ok: true };
}

function openRepo() {
  shell.openExternal(`https://github.com/${REPO}`);
  return { ok: true };
}

module.exports = { check, download, openRelease, openRepo, openSupport, newer, REPO, SUPPORT_URL };
