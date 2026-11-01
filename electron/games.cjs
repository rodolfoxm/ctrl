// Finds installed Steam/Epic games and builds per-game registry tweaks that
// run through the same snapshot/revert engine as the main catalog.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { runPowerShell } = require('./ps.cjs');
const store = require('./store.cjs');

const SKIP_EXE = /(unins|uninst|setup|install|redist|vc_?redist|dxsetup|crash|report|helper|launcher|updater|easyanticheat|battleye|eac|ue4prereq|dotnet|vcredist|cefprocess|webhelper|benchmark)/i;

function gameId(exe) {
  return crypto.createHash('sha1').update(exe.toLowerCase()).digest('hex').slice(0, 10);
}

/** Largest plausible .exe within a few directory levels of the install dir. */
function guessExe(dir, depth = 0, best = { file: null, size: 0 }) {
  if (depth > 3) return best;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return best;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!/^(_commonredist|redist|redistributables|directx|support|tools|docs?)$/i.test(e.name)) guessExe(full, depth + 1, best);
    } else if (e.name.toLowerCase().endsWith('.exe') && !SKIP_EXE.test(e.name)) {
      try {
        const size = fs.statSync(full).size;
        if (size > best.size) Object.assign(best, { file: full, size });
      } catch {}
    }
  }
  return best;
}

async function steamGames() {
  const res = await runPowerShell("(Get-ItemProperty 'HKCU:\\Software\\Valve\\Steam' -ErrorAction SilentlyContinue).SteamPath");
  const steamPath = res.ok && res.stdout ? path.normalize(res.stdout) : null;
  if (!steamPath) return [];
  const libs = new Set([steamPath]);
  try {
    const vdf = fs.readFileSync(path.join(steamPath, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) libs.add(path.normalize(m[1].replace(/\\\\/g, '\\')));
  } catch {}
  const games = [];
  for (const lib of libs) {
    const apps = path.join(lib, 'steamapps');
    let files;
    try {
      files = fs.readdirSync(apps).filter((f) => /^appmanifest_\d+\.acf$/.test(f));
    } catch {
      continue;
    }
    for (const f of files) {
      try {
        const acf = fs.readFileSync(path.join(apps, f), 'utf8');
        const name = acf.match(/"name"\s+"([^"]+)"/)?.[1];
        const dir = acf.match(/"installdir"\s+"([^"]+)"/)?.[1];
        if (!name || !dir || /steamworks|redistributable|proton|runtime/i.test(name)) continue;
        const installDir = path.join(apps, 'common', dir);
        const exe = guessExe(installDir).file;
        if (exe) games.push({ name, exe, source: 'Steam' });
      } catch {}
    }
  }
  return games;
}

function epicGames() {
  const dir = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  const games = [];
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.item'));
  } catch {
    return games;
  }
  for (const f of files) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (!m.DisplayName || !m.InstallLocation || !m.LaunchExecutable) continue;
      const exe = path.join(m.InstallLocation, m.LaunchExecutable);
      if (fs.existsSync(exe)) games.push({ name: m.DisplayName, exe, source: 'Epic' });
    } catch {}
  }
  return games;
}

async function scan() {
  const found = [...(await steamGames()), ...epicGames()];
  return store.update((s) => {
    const known = new Map(s.games.map((g) => [g.exe.toLowerCase(), g]));
    for (const g of found) {
      if (!known.has(g.exe.toLowerCase())) known.set(g.exe.toLowerCase(), { id: gameId(g.exe), ...g });
    }
    s.games = [...known.values()].sort((a, b) => a.name.localeCompare(b.name));
  }).games;
}

function addManual(exe) {
  const name = path.basename(exe, path.extname(exe));
  return store.update((s) => {
    if (!s.games.some((g) => g.exe.toLowerCase() === exe.toLowerCase())) {
      s.games.push({ id: gameId(exe), name, exe, source: 'Manual' });
      s.games.sort((a, b) => a.name.localeCompare(b.name));
    }
  }).games;
}

function removeGame(id) {
  return store.update((s) => {
    s.games = s.games.filter((g) => g.id !== id);
  }).games;
}

const OPTIONS = [
  { key: 'priority', label: 'Prioridade alta de CPU', description: 'O Windows inicia o processo com prioridade Alta.' },
  { key: 'gpu', label: 'GPU de alto desempenho', description: 'Força a GPU dedicada em notebooks com gráficos híbridos.' },
  { key: 'fso', label: 'Sem otimizações de tela cheia', description: 'Usa tela cheia exclusiva real para este executável.' },
];

/** Builds an engine-compatible tweak for one option of one game. */
function gameTweak(game, key) {
  const exeName = path.basename(game.exe);
  const base = { id: `game:${game.id}:${key}`, category: 'game', restart: 'none' };
  if (key === 'priority') {
    return {
      ...base, admin: true, name: `${game.name}: prioridade alta`,
      registry: [{
        path: `HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\${exeName}\\PerfOptions`,
        name: 'CpuPriorityClass', value: 3,
      }],
    };
  }
  if (key === 'gpu') {
    return {
      ...base, admin: false, name: `${game.name}: GPU de alto desempenho`,
      registry: [{ path: 'HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences', name: game.exe, value: 'GpuPreference=2;', type: 'String' }],
    };
  }
  if (key === 'fso') {
    return {
      ...base, admin: false, name: `${game.name}: sem otimizações de tela cheia`,
      registry: [{
        path: 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers',
        name: game.exe, value: '~ DISABLEDXMAXIMIZEDWINDOWEDMODE', type: 'String',
      }],
    };
  }
  return null;
}

function findGame(id) {
  return store.load().games.find((g) => g.id === id);
}

module.exports = { scan, addManual, removeGame, gameTweak, findGame, OPTIONS };
