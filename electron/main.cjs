const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const store = require('./store.cjs');
const engine = require('./engine.cjs');
const catalog = require('./catalog/index.cjs');
const machine = require('./machine.cjs');
const debloat = require('./debloat.cjs');
const games = require('./games.cjs');
const hardware = require('./hardware.cjs');
const backups = require('./backups.cjs');
const livegame = require('./livegame.cjs');
const net = require('./tools/network.cjs');
const cleaner = require('./tools/cleaner.cjs');
const sys = require('./tools/system.cjs');
const health = require('./tools/health.cjs');
const scheduler = require('./tools/scheduler.cjs');
const updates = require('./updates.cjs');
const bufferbloat = require('./tools/bufferbloat.cjs');
const batuta = require('./batuta.cjs');

const devUrlArg = process.argv.find((a) => a.startsWith('--dev-url='));
const DEV_URL = process.env.VITE_DEV_SERVER_URL || (devUrlArg ? devUrlArg.slice('--dev-url='.length) : null);
const TASK = process.argv.find((a) => a.startsWith('--task='))?.slice('--task='.length);

let win = null;
let tray = null;
let quitting = false;
const send = (channel, data) => win && !win.isDestroyed() && win.webContents.send(channel, data);
const ICON = path.join(__dirname, '..', 'build', 'icon.ico');
const toTray = () => store.load().settings.closeToTray;

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// With "closeToTray" on, closing the window only hides it: the Sentinel and Live mode keep
// running and the tray icon brings it back. "Sair" in the tray menu is the real exit.
function syncTray() {
  if (!toTray()) {
    tray?.destroy();
    tray = null;
    return;
  }
  if (tray) return;
  tray = new Tray(ICON);
  tray.setToolTip('ctrl');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir ctrl', click: showWindow },
      { type: 'separator' },
      { label: 'Sair', click: quitApp },
    ]),
  );
  tray.on('click', showWindow);
}

function hideToTray() {
  win.hide();
  if (store.load().trayHinted) return;
  store.update((s) => {
    s.trayHinted = true;
  });
  tray?.displayBalloon({
    iconType: 'custom',
    icon: ICON,
    title: 'O ctrl continua aberto',
    content: 'Ele segue rodando na bandeja. Para sair de vez, clique com o botão direito no ícone e escolha Sair.',
  });
}

// Operations that change the system and shouldn't be cut in half by closing the app.
const GUARDED = {
  'tweaks:apply': 'Um ajuste está sendo aplicado',
  'tweaks:revert': 'Um ajuste está sendo desfeito',
  'tweaks:applyMany': 'Os ajustes estão sendo aplicados',
  'tweaks:revertMany': 'Os ajustes estão sendo desfeitos',
  'actions:run': 'Uma correção está rodando',
  'profiles:apply': 'Um perfil está sendo aplicado',
  'profiles:revert': 'Um perfil está sendo desfeito',
  'games:set': 'Um ajuste de jogo está sendo aplicado',
  'cleaner:clean': 'A limpeza está rodando',
  'debloat:remove': 'Um app está sendo removido',
  'debloat:reinstall': 'Um app está sendo reinstalado',
  'backups:create': 'O ponto de restauração está sendo criado',
  'net:setDns': 'O DNS está sendo trocado',
  'net:revertDns': 'O DNS está sendo restaurado',
};
const running = new Map();
let opSeq = 0;
let quitConfirmed = false;

async function confirmQuit() {
  if (quitConfirmed || !running.size || !win) return true;
  showWindow();
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    title: 'ctrl',
    message: 'O ctrl ainda está trabalhando',
    detail: `${[...running.values()][0]}. Fechar agora pode interromper no meio e deixar a alteração pela metade.`,
    buttons: ['Continuar aberto', 'Sair mesmo assim'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  quitConfirmed = response === 1;
  return quitConfirmed;
}

async function quitApp() {
  if (!(await confirmQuit())) return;
  quitting = true;
  await batuta.stop();
  hardware.stopLive(true);
  sys.timerReset();
  await livegame.stop();
  app.quit();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1040,
    minHeight: 660,
    frame: false,
    backgroundColor: '#0a0a0a',
    icon: ICON,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => {
    if (!process.argv.includes('--minimized')) win.show();
    else if (!toTray()) win.minimize();
  });
  win.on('close', (e) => {
    if (quitting) return;
    if (toTray()) {
      e.preventDefault();
      hideToTray();
    } else if (running.size && !quitConfirmed) {
      e.preventDefault();
      confirmQuit().then((ok) => ok && win.close());
    }
  });
  // Windows is shutting down or logging off: let the window close instead of hiding.
  win.on('query-session-end', () => {
    quitting = true;
  });
  win.on('hide', () => hardware.pauseLive(true));
  win.on('show', () => hardware.pauseLive(false));
  win.on('maximize', () => send('win:state', { maximized: true }));
  win.on('unmaximize', () => send('win:state', { maximized: false }));
  // Never navigate the app window away; external links open in the browser.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!DEV_URL || !url.startsWith(DEV_URL)) e.preventDefault();
  });
  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (_e, ...args) => {
    const op = GUARDED[channel] && ++opSeq;
    if (op) running.set(op, GUARDED[channel]);
    try {
      return await fn(...args);
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    } finally {
      if (op) running.delete(op);
    }
  });
}

const tweaksFor = (ids) => ids.map(catalog.findTweak).filter(Boolean);
const engineOpts = (source) => ({ findTweak: catalog.findTweak, source });

// ---------- App / janela ----------
handle('app:info', async () => ({
  version: app.getVersion(),
  isAdmin: await engine.isAdmin(),
  dataPath: app.getPath('userData'),
  dev: !!DEV_URL,
  electron: process.versions.electron,
}));
handle('app:relaunchAdmin', () => {
  const args = app.isPackaged ? [] : [app.getAppPath()];
  if (DEV_URL) args.push(`--dev-url=${DEV_URL}`);
  const argList = args.map((a) => `'${a.replace(/'/g, "''")}'`).join(',');
  const ps = `Start-Process -FilePath '${process.execPath.replace(/'/g, "''")}' ${argList ? `-ArgumentList ${argList}` : ''} -Verb RunAs`;
  const child = spawn('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true });
  child.on('close', (code) => code === 0 && app.quit());
  return { ok: true };
});
handle('app:checkUpdate', (force) => updates.check(force));
handle('app:openRelease', () => updates.openRelease());
handle('app:openRepo', () => updates.openRepo());
handle('app:openSupport', () => updates.openSupport());
handle('win:minimize', () => win?.minimize());
handle('win:toggleMaximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()));
handle('win:close', () => win?.close());
handle('system:restart', () => {
  spawn('shutdown.exe', ['/r', '/t', '5', '/c', 'Reiniciando para concluir as otimizações do ctrl'], { windowsHide: true });
  return { ok: true };
});
handle('system:logoff', () => {
  spawn('shutdown.exe', ['/l'], { windowsHide: true });
  return { ok: true };
});
handle('shell:open', (url) => {
  if (/^(https:|ms-settings:|ms-windows-store:)/.test(url)) shell.openExternal(url);
  return { ok: true };
});

// ---------- Máquina / catálogo ----------
handle('machine:get', (force) => machine.get(force));
handle('catalog:get', async () => {
  const m = await machine.get().catch(() => null);
  return {
    modules: catalog.MODULES,
    tweaks: catalog.TWEAKS.map((t) => catalog.publicTweak(t, m)),
    actions: catalog.ACTIONS.map(({ run, ...meta }) => meta),
    profiles: catalog.PROFILES,
    quickWins: catalog.QUICK_WINS,
  };
});

// ---------- Tweaks ----------
handle('tweaks:status', (ids) => engine.checkMany(ids ? tweaksFor(ids) : catalog.TWEAKS));
handle('tweaks:apply', (id) => {
  const t = catalog.findTweak(id);
  return t ? engine.apply(t, engineOpts('manual')) : { ok: false, error: 'Tweak desconhecido.' };
});
handle('tweaks:revert', (id) => {
  const t = catalog.findTweak(id);
  if (t) return engine.revert(t);
  const [, gid, key] = id.split(':');
  const game = games.findGame(gid);
  const gt = game && games.gameTweak(game, key);
  return gt ? engine.revert(gt) : { ok: false, error: 'Tweak desconhecido.' };
});
handle('tweaks:applyMany', (ids, source = 'lote') =>
  engine.runMany(tweaksFor(ids), 'apply', engineOpts(source), (p) => send('tweaks:progress', p)),
);
handle('tweaks:revertMany', (ids, source = 'lote') =>
  engine.runMany(tweaksFor(ids), 'revert', engineOpts(source), (p) => send('tweaks:progress', p)),
);
handle('actions:run', (id) => {
  const a = catalog.findAction(id);
  return a ? engine.runAction(a) : { ok: false, error: 'Ação desconhecida.' };
});

// ---------- Guardian (verificação, desfazer, atividade) ----------
handle('guardian:verify', () => engine.verify(catalog.findTweak));
handle('guardian:repair', (ids) => engine.runMany(tweaksFor(ids), 'apply', engineOpts('reparo'), (p) => send('tweaks:progress', p)));
handle('guardian:undoSince', (iso) => {
  const since = new Date(iso).getTime();
  const ids = Object.entries(store.load().applied)
    .filter(([, v]) => new Date(v.at).getTime() >= since)
    .map(([id]) => id);
  return engine.runMany(tweaksFor(ids).reverse(), 'revert', engineOpts('desfazer em lote'), (p) => send('tweaks:progress', p));
});
handle('guardian:undoAll', () => {
  const ids = Object.keys(store.load().applied);
  return engine.runMany(tweaksFor(ids).reverse(), 'revert', engineOpts('desfazer tudo'), (p) => send('tweaks:progress', p));
});
handle('guardian:clearHistory', () => {
  store.update((s) => {
    s.history = [];
  });
  return { ok: true };
});

let sentinelTimer = null;
function startSentinel() {
  clearInterval(sentinelTimer);
  if (!store.load().settings.sentinel) return;
  sentinelTimer = setInterval(async () => {
    const res = await engine.verify(catalog.findTweak).catch(() => null);
    if (!res) return;
    const drifted = res.items.filter((i) => i.state === 'drifted').map((i) => i.id);
    if (drifted.length && store.load().settings.sentinelRepair) {
      await engine.runMany(tweaksFor(drifted), 'apply', engineOpts('sentinela'));
    }
    send('guardian:sweep', { ...res, repaired: store.load().settings.sentinelRepair ? drifted : [] });
  }, 30 * 60 * 1000);
}

// ---------- Painel ----------
handle('dashboard:summary', async () => {
  const s = store.load();
  const applied = Object.keys(s.applied);
  const m = await machine.get().catch(() => null);
  const eligibleQuick = catalog.QUICK_WINS.filter((id) => !catalog.gate(catalog.findTweak(id), m));
  const live = await engine.checkMany(tweaksFor(eligibleQuick));
  const quickActive = eligibleQuick.filter((id) => live[id] === true);
  const bk = await backups.status().catch(() => ({ enabled: false, points: [] }));
  const lastPoint = bk.points[0]?.created ? new Date(bk.points[0].created) : null;
  const pointFresh = lastPoint && Date.now() - lastPoint.getTime() < 30 * 864e5;
  const lastSweep = s.sweeps[0] || null;
  const hw = await staticInfo().catch(() => null);
  const sysVol = hw?.volumes?.find((v) => v.letter === 'C:') || hw?.volumes?.[0];
  const freePct = sysVol ? Math.round((sysVol.free / sysVol.size) * 100) : null;
  // Maintenance recency: the last cleanup and the last integrity check (SFC, DISM or ChkDsk) that worked.
  const lastOk = (pred) => s.history.find((h) => h.ok && pred(h))?.at;
  const days = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 864e5 : Infinity);
  const lastClean = lastOk((h) => h.action === 'clean');
  const lastCheck = lastOk((h) => h.action === 'run' && ['sfc', 'dism', 'chkdsk-scan'].includes(h.id));
  const fresh = (iso) => (days(iso) <= 30 ? 1 : days(iso) <= 90 ? 0.5 : 0);
  const maintValue = [lastClean ? `limpeza ${new Date(lastClean).toLocaleDateString('pt-BR')}` : 'nunca limpou', lastCheck ? `verificação ${new Date(lastCheck).toLocaleDateString('pt-BR')}` : 'nunca verificou'].join(' · ');

  const factors = [
    { id: 'quick', label: 'Otimizações essenciais ativas', value: `${quickActive.length}/${eligibleQuick.length}`, weight: 45, score: eligibleQuick.length ? quickActive.length / eligibleQuick.length : 1 },
    { id: 'restore', label: 'Ponto de restauração recente', value: lastPoint ? lastPoint.toLocaleDateString('pt-BR') : 'nenhum', weight: 15, score: pointFresh ? 1 : bk.enabled ? 0.4 : 0 },
    { id: 'drift', label: 'Tweaks sem drift', value: lastSweep ? `${lastSweep.drifted.length} desfeitos` : 'não verificado', weight: 15, score: lastSweep ? (lastSweep.drifted.length ? 0.3 : 1) : 0.6 },
    { id: 'disk', label: 'Espaço livre no disco do sistema', value: freePct != null ? `${freePct}%` : '—', weight: 15, score: freePct == null ? 0.5 : Math.min(1, freePct / 20) },
    { id: 'maintenance', label: 'Manutenção nos últimos 30 dias', value: maintValue, weight: 10, score: (fresh(lastClean) + fresh(lastCheck)) / 2 },
  ];
  const score = Math.round(factors.reduce((a, f) => a + f.weight * f.score, 0));
  return {
    score,
    factors,
    appliedCount: applied.length,
    quickWinsMissing: eligibleQuick.filter((id) => live[id] !== true),
    restorePoint: bk.points[0] || null,
    restoreEnabled: bk.enabled,
    lastSweep,
    recent: s.history.slice(0, 8),
    uptime: os.uptime(),
  };
});

// ---------- Perfis ----------
function allProfiles() {
  return [...catalog.PROFILES.map((p) => ({ ...p, builtin: true })), ...store.load().customProfiles.map((p) => ({ ...p, builtin: false }))];
}
handle('profiles:list', async () => {
  const m = await machine.get().catch(() => null);
  const applied = store.load().applied;
  return {
    active: store.load().activeProfile,
    profiles: allProfiles().map((p) => {
      const eligible = p.tweaks.filter((id) => catalog.findTweak(id) && !catalog.gate(catalog.findTweak(id), m));
      return { ...p, eligible, appliedCount: eligible.filter((id) => applied[id]).length };
    }),
  };
});
handle('profiles:apply', async (id) => {
  const p = allProfiles().find((x) => x.id === id);
  if (!p) return { ok: false, error: 'Perfil não encontrado.' };
  const m = await machine.get().catch(() => null);
  const ids = p.tweaks.filter((tid) => catalog.findTweak(tid) && !catalog.gate(catalog.findTweak(tid), m));
  const res = await engine.runMany(tweaksFor(ids), 'apply', engineOpts(`perfil ${p.name}`), (pr) => send('tweaks:progress', pr));
  store.update((s) => {
    s.activeProfile = p.id;
  });
  return res;
});
handle('profiles:revert', async (id) => {
  const p = allProfiles().find((x) => x.id === id);
  if (!p) return { ok: false, error: 'Perfil não encontrado.' };
  const applied = store.load().applied;
  const ids = p.tweaks.filter((tid) => applied[tid]);
  const res = await engine.runMany(tweaksFor(ids).reverse(), 'revert', engineOpts(`perfil ${p.name}`), (pr) => send('tweaks:progress', pr));
  store.update((s) => {
    if (s.activeProfile === id) s.activeProfile = null;
  });
  return res;
});
handle('profiles:save', (profile) => {
  const clean = {
    id: profile.id || `custom-${Date.now().toString(36)}`,
    name: String(profile.name || 'Meu perfil').slice(0, 60),
    description: String(profile.description || '').slice(0, 300),
    icon: 'user',
    accent: 'accent',
    tweaks: (profile.tweaks || []).filter((id) => catalog.findTweak(id)),
  };
  store.update((s) => {
    s.customProfiles = [...s.customProfiles.filter((p) => p.id !== clean.id), clean];
  });
  return { ok: true, profile: clean };
});
handle('profiles:delete', (id) => {
  store.update((s) => {
    s.customProfiles = s.customProfiles.filter((p) => p.id !== id);
  });
  return { ok: true };
});
handle('profiles:export', async (id) => {
  const p = allProfiles().find((x) => x.id === id);
  if (!p) return { ok: false, error: 'Perfil não encontrado.' };
  const res = await dialog.showSaveDialog(win, { defaultPath: `${p.name}.ctrl-profile.json`, filters: [{ name: 'Perfil ctrl', extensions: ['json'] }] });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(res.filePath, JSON.stringify({ format: 'ctrl-profile/1', name: p.name, description: p.description, tweaks: p.tweaks }, null, 2), 'utf8');
  return { ok: true, path: res.filePath };
});
handle('profiles:import', async () => {
  const res = await dialog.showOpenDialog(win, { filters: [{ name: 'Perfil ctrl', extensions: ['json'] }], properties: ['openFile'] });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  const data = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf8'));
  if (!['ctrl-profile/1', 'mojo-profile/1'].includes(data.format) || !Array.isArray(data.tweaks)) throw new Error('Arquivo de perfil inválido.');
  const id = `custom-${Date.now().toString(36)}`;
  const profile = { id, name: data.name, description: data.description, icon: 'user', accent: 'accent', tweaks: data.tweaks.filter((t) => catalog.findTweak(t)) };
  store.update((s) => s.customProfiles.push(profile));
  return { ok: true, profile, skipped: data.tweaks.length - profile.tweaks.length };
});

// ---------- Jogos ----------
handle('games:list', () => ({ games: store.load().games, options: games.OPTIONS }));
handle('games:scan', () => games.scan());
handle('games:add', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Selecione o executável do jogo',
    filters: [{ name: 'Executáveis', extensions: ['exe'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths[0]) return store.load().games;
  return games.addManual(res.filePaths[0]);
});
handle('games:remove', (id) => games.removeGame(id));
handle('games:status', async (id) => {
  const game = games.findGame(id);
  if (!game) return {};
  const tweaks = games.OPTIONS.map((o) => games.gameTweak(game, o.key));
  const raw = await engine.checkMany(tweaks);
  return Object.fromEntries(games.OPTIONS.map((o) => [o.key, raw[`game:${id}:${o.key}`] ?? null]));
});
handle('games:set', async (id, key, enabled) => {
  const game = games.findGame(id);
  const t = game && games.gameTweak(game, key);
  if (!t) return { ok: false, error: 'Jogo não encontrado.' };
  return enabled ? engine.apply(t, engineOpts('perfil de jogo')) : engine.revert(t);
});
handle('games:launch', (id) => {
  const game = games.findGame(id);
  if (!game || !fs.existsSync(game.exe)) return { ok: false, error: 'Executável não encontrado.' };
  shell.openPath(game.exe);
  return { ok: true };
});

// ---------- Live Game Mode ----------
handle('livegame:status', () => livegame.status());
handle('livegame:setEnabled', async (enabled) => {
  store.update((s) => {
    s.settings.liveGameMode = !!enabled;
  });
  if (enabled) livegame.start((e) => send('livegame:event', e));
  else await livegame.stop();
  return livegame.status();
});
handle('livegame:confirm', (gameId, pid, yes) => livegame.confirm(gameId, pid, yes));
handle('livegame:end', async () => {
  await livegame.endSession();
  return livegame.status();
});

// ---------- Hardware / saúde ----------
let staticCache = null;
function staticInfo(force = false) {
  if (!staticCache || force) staticCache = hardware.getStatic().catch((err) => ((staticCache = null), Promise.reject(err)));
  return staticCache;
}
handle('hw:static', (force) => staticInfo(force));
handle('hw:subscribe', () => {
  hardware.startLive((data) => send('hw:update', data));
  return { ok: true };
});
handle('hw:unsubscribe', () => hardware.stopLive());
handle('hw:processes', () => hardware.topProcesses());
handle('health:disks', () => health.disks());
handle('health:battery', () => health.battery());
handle('health:boot', () => health.bootTimes());

// ---------- Rede ----------
handle('net:state', () => net.state());
handle('net:benchmark', () => net.benchmark());
handle('net:setDns', (id) => net.setProvider(id));
handle('net:revertDns', () => net.revertDns());
handle('net:latency', (hosts) => net.latency(hosts));

// ---------- Core (interno: batuta) — regras de processo, contenção, memória e núcleos ----------
const hostInfo = async () => {
  const m = await machine.get().catch(() => null);
  return { hybrid: !!m?.hybrid, laptop: !!m?.laptop };
};
handle('batuta:state', async () => ({ ...batuta.state(), ...(await hostInfo()), rivals: await batuta.rivals() }));
handle('batuta:save', (patch) => batuta.save(patch));
handle('batuta:processes', () => batuta.processes());
handle('batuta:purge', () => batuta.purgeNow());
handle('batuta:suggest', async (gameIds, opts = {}) => batuta.suggest(gameIds, { ...(await hostInfo()), ...opts }));
handle('batuta:plans', () => batuta.listPlans());
handle('batuta:parking', () => batuta.parking());
handle('batuta:setParking', (v) => batuta.setParking(v));
handle('batuta:restoreParking', () => batuta.restoreParking());
let bloatRun = null;
handle('net:bufferbloat', () => {
  bloatRun ??= bufferbloat.run((p) => send('net:bloat', p)).finally(() => {
    bloatRun = null;
  });
  return bloatRun;
});

// ---------- Sistema ----------
handle('cleaner:scan', () => cleaner.scan());
handle('cleaner:clean', (ids) => cleaner.clean(ids));
handle('wu:status', () => sys.wuStatus());
handle('wu:pause', (days) => sys.wuPause(days));
handle('wu:resume', () => sys.wuResume());
handle('startup:list', () => sys.startupList());
handle('startup:set', (key, name, enabled) => sys.startupSet(key, name, enabled));
handle('timer:status', () => sys.timerStatus());
handle('timer:set', (ms) => sys.timerSet(ms));
handle('timer:reset', () => sys.timerReset());
handle('msi:list', () => sys.msiList());
handle('msi:set', (id, enabled) => sys.msiSet(id, enabled));
handle('dpc:sample', (seconds) => sys.dpcSample(seconds));
handle('debloat:scan', () => debloat.scan());
handle('debloat:remove', (name) => debloat.remove(name));
handle('debloat:reinstall', (name) => debloat.reinstall(name));

// ---------- Agendador / backups ----------
handle('sched:list', () => scheduler.list());
handle('sched:create', (id) => scheduler.create(id));
handle('sched:remove', (id) => scheduler.remove(id));
handle('sched:run', (id) => scheduler.runNow(id));
handle('backups:status', () => backups.status());
handle('backups:create', (desc) => backups.create(desc));
handle('backups:enable', () => backups.enable());
handle('backups:openRestore', () => {
  spawn('rstrui.exe', [], { detached: true, windowsHide: false }).unref();
  return { ok: true };
});

// ---------- Estado / configurações ----------
handle('state:get', () => {
  const s = store.load();
  return {
    applied: Object.fromEntries(Object.entries(s.applied).map(([id, v]) => [id, { name: v.name, module: v.module, at: v.at, source: v.source }])),
    history: s.history,
    sweeps: s.sweeps,
    settings: s.settings,
    onboarded: s.onboarded,
    dns: s.dns,
  };
});
handle('settings:set', async (patch) => {
  const before = store.load().settings;
  const next = store.update((s) => Object.assign(s.settings, patch)).settings;
  if ('sentinel' in patch) startSentinel();
  if ('closeToTray' in patch) syncTray();
  if ('startWithWindows' in patch && patch.startWithWindows !== before.startWithWindows) {
    try {
      await (patch.startWithWindows ? scheduler.create('app-logon') : scheduler.remove('app-logon'));
    } catch (err) {
      store.update((s) => {
        s.settings.startWithWindows = before.startWithWindows;
      });
      throw err;
    }
  }
  return next;
});
handle('onboarding:done', () => {
  store.update((s) => {
    s.onboarded = true;
  });
  return { ok: true };
});
handle('state:export', async () => {
  const res = await dialog.showSaveDialog(win, {
    title: 'Exportar estado e backups dos tweaks',
    defaultPath: `ctrl-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(res.filePath, JSON.stringify(store.load(), null, 2), 'utf8');
  return { ok: true, path: res.filePath };
});
handle('state:import', async () => {
  const res = await dialog.showOpenDialog(win, { filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  const data = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf8'));
  if (typeof data !== 'object' || !data.applied) throw new Error('Arquivo inválido.');
  store.replace(data);
  return { ok: true };
});
handle('state:reset', () => {
  store.reset({ keepApplied: true });
  return { ok: true };
});
handle('state:openFolder', () => shell.openPath(app.getPath('userData')));

// ---------- Modo headless (tarefas agendadas) ----------
async function runTask(task) {
  if (task === 'clean') {
    const safe = cleaner.CATEGORIES.filter((c) => c.safe && !c.browser).map((c) => c.id);
    await cleaner.clean(safe);
  } else if (task === 'repair') {
    const res = await engine.verify(catalog.findTweak);
    const drifted = res.items.filter((i) => i.state === 'drifted').map((i) => i.id);
    if (drifted.length) await engine.runMany(tweaksFor(drifted), 'apply', engineOpts('tarefa agendada'));
  }
}

if (TASK) {
  app.whenReady().then(async () => {
    try {
      await runTask(TASK);
    } finally {
      app.quit();
    }
  });
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('before-quit', () => {
    quitting = true;
  });
  app.whenReady().then(() => {
    createWindow();
    syncTray();
    startSentinel();
    batuta.start((e) => {
      send('batuta:event', e);
      // The Vigia's "Só avisar" action: a Windows notification, since the window may be hidden in the tray.
      if (e.type === 'watchdog' && e.action === 'notify' && Notification.isSupported()) {
        new Notification({ title: 'Vigia do ctrl', body: `${e.name} passou do limite (${e.value}${e.metric === 'ram' ? ' MB de memória' : '% da CPU'}).`, icon: ICON }).show();
      }
    });
    if (store.load().settings.liveGameMode) livegame.start((e) => send('livegame:event', e));
  });
  app.on('window-all-closed', quitApp);
}
