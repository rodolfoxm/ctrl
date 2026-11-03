// Core (internally "batuta"): per-process rules (priority, P/E cores, I/O, GPU, efficiency mode), background containment
// (lowers busy background processes while the CPU is loaded, like ProBalance), a standby-list cleaner
// (like ISLC) and core control (core parking + power plan by activity, like ParkControl).
// One long-lived PowerShell worker does the per-process work every 2 s; Node keeps the config,
// the plan switching and the event log. Only scheduler and power APIs: no game memory is ever read.
const { runJson, runPowerShell, streamPowerShell, q } = require('./ps.cjs');
const store = require('./store.cjs');
const NATIVE = require('./batuta-native.cjs');
const { workerScript, NOT_GAME } = require('./batuta-worker.cjs');
const { PLAN_MATCH } = require('./catalog/constants.cjs');
const { GAMES, BACKGROUND, suggest, ramGb, PLAN_BALANCED } = require('./batuta-presets.cjs');

const PLAN_HIGH = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
const SUB_PROCESSOR = '54533251-82be-4824-96c1-47b60b740d00';
const CPMINCORES = '0cc5b647-c1df-4637-891a-dec35c318583';
const PARKING_TWEAK = 'cpu-core-parking-off';

const DEFAULTS = {
  enabled: false,
  rules: [], // { exe, name, priority, cores, io, gpu, efficiency, game }
  containment: { enabled: true, total: 70, proc: 10, overMs: 2700, restore: 2, minMs: 2100, exclusions: [] },
  memory: { enabled: false, listMB: 1024, freeMB: 4096, onlyGaming: true, exclusions: [] },
  boost: { enabled: false, activePlan: null, idlePlan: PLAN_BALANCED, idleMin: 5 },
  profile: { games: [] },
  // Games found by folder (Steam, Epic, Xbox…), by the ctrl library or by the assistant's list get this rule.
  autoDetect: { enabled: true, priority: 'high', gpu: 'high', efficiency: 'never' },
  // { exe, metric: 'cpu' | 'ram', threshold (% of total CPU or MB), seconds, action: 'below' | 'idle' | 'ecores' | 'notify' }
  watchdog: [],
};

const config = () => {
  const b = store.load().batuta || {};
  return {
    ...structuredClone(DEFAULTS), ...b,
    autoDetect: { ...DEFAULTS.autoDetect, ...(b.autoDetect || {}) },
    watchdog: b.watchdog || [],
    containment: { ...DEFAULTS.containment, ...(b.containment || {}) },
    memory: { ...DEFAULTS.memory, ...(b.memory || {}) },
    boost: { ...DEFAULTS.boost, ...(b.boost || {}) },
    profile: { ...DEFAULTS.profile, ...(b.profile || {}) },
  };
};

let worker = null;
let notify = () => {};
let last = { status: null, ready: null, events: [], purges: 0, freedMB: 0, startedAt: null };
let boostPlan = null; // plan Batuta switched to; null when it has not touched the plan
let boostPrevious = null;

function pushEvent(e) {
  last.events.unshift({ ...e, at: new Date().toISOString() });
  last.events = last.events.slice(0, 60);
}

function onLine(line) {
  let e;
  try {
    e = JSON.parse(line);
  } catch {
    return;
  }
  if (e.type === 'status') {
    last.status = e;
    boostTick(e).catch(() => {});
  } else if (e.type === 'ready') {
    last.ready = e;
  } else if (e.type !== 'stopped') {
    if (e.type === 'purge') {
      last.purges++;
      last.freedMB += Math.max(0, e.before - e.after);
    }
    pushEvent(e);
  }
  notify(e);
}

async function spawnWorker() {
  const cfg = config();
  last = { ...last, status: null, startedAt: new Date().toISOString() };
  const gameDirs = cfg.autoDetect.enabled ? await require('./games.cjs').gameFolders().catch(() => []) : [];
  const libraryExes = (store.load().games || []).map((g) => g.exe).filter(Boolean);
  if (worker) return; // another start won the race while the folders were being read
  const w = streamPowerShell(workerScript(cfg, { gameDirs, libraryExes }), onLine);
  w.onExit(() => {
    if (worker === w) worker = null;
  });
  worker = w;
}

async function stopWorker() {
  const w = worker;
  if (!w) return;
  worker = null;
  await new Promise((resolve) => {
    const t = setTimeout(() => {
      w();
      resolve();
    }, 4000);
    w.onExit(() => {
      clearTimeout(t);
      resolve();
    });
    w.send('stop');
  });
}

// ---------------- plan by activity (ParkControl's Dynamic Boost) ----------------
async function activePlan() {
  const r = await runPowerShell("if ((powercfg /getactivescheme) -match '([0-9a-fA-F-]{36})') { $Matches[1] }");
  return r.ok ? r.stdout.trim().toLowerCase() : null;
}

async function setPlan(guid) {
  await runPowerShell(`powercfg -setactive ${q(guid)}`);
}

let boostBusy = false;
async function boostTick(status) {
  const b = config().boost;
  if (!b.enabled || boostBusy) return;
  // The live game mode owns the plan during a session; Batuta steps aside.
  if (require('./livegame.cjs').status().session) return;
  const want = (status.idleMs >= b.idleMin * 60000 ? b.idlePlan : b.activePlan || (await performancePlan()))?.toLowerCase();
  if (!want || want === boostPlan) return;
  boostBusy = true;
  try {
    if (!boostPrevious) {
      // A backup left by a session that ended abruptly is the real original; the active plan is ours.
      boostPrevious = store.load().batutaPlanBackup || (await activePlan());
      store.update((s) => {
        s.batutaPlanBackup = boostPrevious;
      });
    }
    await setPlan(want);
    boostPlan = want;
    pushEvent({ type: 'plan', idle: status.idleMs >= b.idleMin * 60000, plan: want });
  } finally {
    boostBusy = false;
  }
}

async function restorePlan() {
  const prev = boostPrevious || store.load().batutaPlanBackup;
  boostPlan = null;
  boostPrevious = null;
  if (prev) await setPlan(prev);
  store.update((s) => {
    delete s.batutaPlanBackup;
  });
}

async function performancePlan() {
  const plans = await listPlans().catch(() => []);
  return (plans.find((p) => new RegExp(PLAN_MATCH, 'i').test(p.name)) || plans.find((p) => /bitsum|ultimate|desempenho m[aá]ximo/i.test(p.name)) || { guid: PLAN_HIGH }).guid;
}

async function listPlans() {
  const r = await runPowerShell('powercfg /list');
  if (!r.ok) return [];
  return r.stdout.split(/\r?\n/).map((l) => l.match(/([0-9a-fA-F-]{36})\s+\((.+)\)(\s*\*)?\s*$/)).filter(Boolean)
    .map((m) => ({ guid: m[1].toLowerCase(), name: m[2], active: !!m[3] }));
}

// ---------------- core parking (ParkControl) ----------------
async function parking() {
  const read = await runPowerShell(`$v = [regex]::Matches((powercfg /qh SCHEME_CURRENT ${SUB_PROCESSOR} ${CPMINCORES} | Out-String), '0x[0-9a-fA-F]{8}'); "$([Convert]::ToInt32($v[$v.Count-2].Value,16)),$([Convert]::ToInt32($v[$v.Count-1].Value,16))"`);
  const [ac, dc] = read.ok ? read.stdout.trim().split(',').map(Number) : [null, null];
  const s = store.load();
  return { ac, dc, lockedBy: s.applied[PARKING_TWEAK] ? PARKING_TWEAK : null, backup: s.batutaParkingBackup || null };
}

async function setParking({ ac, dc }) {
  const cur = await parking();
  if (cur.lockedBy) return { ok: false, error: 'O ajuste "Desativar estacionamento de núcleos" está aplicado e controla isso. Desfaça-o para ajustar aqui.' };
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v))));
  if (!cur.backup) store.update((s) => { s.batutaParkingBackup = { ac: cur.ac, dc: cur.dc }; });
  const cmds = [];
  if (ac != null) cmds.push(`powercfg /setacvalueindex SCHEME_CURRENT ${SUB_PROCESSOR} ${CPMINCORES} ${clamp(ac)}`);
  if (dc != null) cmds.push(`powercfg /setdcvalueindex SCHEME_CURRENT ${SUB_PROCESSOR} ${CPMINCORES} ${clamp(dc)}`);
  cmds.push('powercfg /setactive SCHEME_CURRENT');
  const r = await runPowerShell(cmds.join('\n'));
  if (r.ok) store.log({ action: 'apply', id: 'batuta-parking', name: `Core: núcleos ativos ${ac ?? cur.ac}% na tomada, ${dc ?? cur.dc}% na bateria`, ok: true });
  return r.ok ? { ok: true, ...(await parking()) } : { ok: false, error: r.stderr };
}

async function restoreParking() {
  const b = store.load().batutaParkingBackup;
  if (!b) return { ok: true };
  store.update((s) => { delete s.batutaParkingBackup; });
  const r = await runPowerShell([
    b.ac != null ? `powercfg /setacvalueindex SCHEME_CURRENT ${SUB_PROCESSOR} ${CPMINCORES} ${b.ac}` : '',
    b.dc != null ? `powercfg /setdcvalueindex SCHEME_CURRENT ${SUB_PROCESSOR} ${CPMINCORES} ${b.dc}` : '',
    'powercfg /setactive SCHEME_CURRENT',
  ].filter(Boolean).join('\n'));
  if (r.ok) store.log({ action: 'revert', id: 'batuta-parking', name: 'Core: núcleos ativos restaurados', ok: true });
  return r.ok ? { ok: true, ...(await parking()) } : { ok: false, error: r.stderr };
}

// ---------------- public API ----------------
async function start(onEvent) {
  notify = onEvent || notify;
  if (config().enabled && !worker) await spawnWorker();
}

async function stop({ keepPlan = false } = {}) {
  await stopWorker();
  if (!keepPlan && (boostPlan || store.load().batutaPlanBackup)) await restorePlan();
}

// Everything the renderer sends is reduced to known values before it is stored or reaches the worker.
const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const num = (v, min, max, fallback) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback);
const EXE = /^[\w .()+&'-]{1,96}\.exe$/i;
const names = (list) => (Array.isArray(list) ? list.map((n) => String(n).trim()).filter((n) => /^[\w .()+&'-]{1,96}$/i.test(n)).slice(0, 100) : []);
const GUID = /^[0-9a-f-]{36}$/i;

function sanitize(c) {
  const exe = (e) => {
    const s = String(e || '').trim();
    const withExt = /\.exe$/i.test(s) ? s : `${s}.exe`;
    return EXE.test(withExt) ? withExt : null;
  };
  return {
    enabled: !!c.enabled,
    rules: (c.rules || []).map((r) => ({
      exe: exe(r.exe),
      name: String(r.name || '').slice(0, 80),
      priority: pick(r.priority, ['default', 'high', 'above', 'normal', 'below', 'idle'], 'default'),
      cores: pick(r.cores, ['all', 'p', 'e'], 'all'),
      io: pick(r.io, ['default', 'normal', 'low'], 'default'),
      gpu: pick(r.gpu, ['default', 'high', 'above', 'normal', 'low'], 'default'),
      efficiency: pick(r.efficiency, ['default', 'never', 'always'], 'default'),
      game: !!r.game,
    })).filter((r) => r.exe).slice(0, 200),
    containment: {
      enabled: !!c.containment.enabled,
      total: num(c.containment.total, 0, 100, 70),
      proc: num(c.containment.proc, 1, 100, 10),
      overMs: num(c.containment.overMs, 500, 60000, 2700),
      restore: num(c.containment.restore, 0, 100, 2),
      minMs: num(c.containment.minMs, 500, 600000, 2100),
      exclusions: names(c.containment.exclusions),
    },
    memory: {
      enabled: !!c.memory.enabled,
      listMB: num(c.memory.listMB, 256, 1048576, 1024),
      freeMB: num(c.memory.freeMB, 256, 1048576, 4096),
      onlyGaming: !!c.memory.onlyGaming,
      exclusions: names(c.memory.exclusions),
    },
    boost: {
      enabled: !!c.boost.enabled,
      activePlan: GUID.test(c.boost.activePlan || '') ? c.boost.activePlan : null,
      idlePlan: GUID.test(c.boost.idlePlan || '') ? c.boost.idlePlan : PLAN_BALANCED,
      idleMin: num(c.boost.idleMin, 1, 240, 5),
    },
    profile: { games: (c.profile.games || []).filter((g) => GAMES.some((x) => x.id === g)) },
    autoDetect: {
      enabled: !!c.autoDetect.enabled,
      priority: pick(c.autoDetect.priority, ['default', 'high', 'above', 'normal'], 'high'),
      gpu: pick(c.autoDetect.gpu, ['default', 'high', 'above', 'normal'], 'high'),
      efficiency: pick(c.autoDetect.efficiency, ['default', 'never'], 'never'),
    },
    watchdog: (c.watchdog || []).map((w) => ({
      exe: exe(w.exe),
      metric: pick(w.metric, ['cpu', 'ram'], 'cpu'),
      threshold: num(w.threshold, 1, 1048576, 25),
      seconds: num(w.seconds, 1, 3600, 10),
      action: pick(w.action, ['below', 'idle', 'ecores', 'notify'], 'below'),
    })).filter((w) => w.exe).slice(0, 50),
  };
}

async function save(patch) {
  const cur = config();
  const merged = { ...cur, ...patch };
  for (const k of ['containment', 'memory', 'boost', 'profile', 'autoDetect']) if (patch[k]) merged[k] = { ...cur[k], ...patch[k] };
  const next = sanitize(merged);
  const boostWasOn = config().boost.enabled;
  store.update((s) => {
    s.batuta = next;
  });
  await stopWorker();
  if (boostWasOn && !next.boost.enabled) await restorePlan();
  if (next.enabled) await spawnWorker();
  else if (boostPlan) await restorePlan();
  return state();
}

function state() {
  return { config: config(), games: GAMES, background: BACKGROUND, ramGb: ramGb(), running: !!worker, ...last };
}

// Other tools that manage the same things; running both makes them undo each other.
const RIVALS = { processgovernor: 'Process Lasso', processlasso: 'Process Lasso', parkcontrol: 'ParkControl', islc: 'Intelligent Standby List Cleaner' };
async function rivals() {
  const names = await runJson(`ConvertTo-Json -Compress -InputObject @(Get-Process -Name ${Object.keys(RIVALS).map(q).join(',')} -ErrorAction SilentlyContinue | ForEach-Object { $_.ProcessName.ToLower() } | Sort-Object -Unique)`).catch(() => []);
  return [...new Set((names || []).map((n) => RIVALS[n]).filter(Boolean))];
}

async function processes() {
  return runJson(`ConvertTo-Json -Compress -InputObject @(Get-Process | Where-Object { $_.SessionId -ne 0 -and $_.MainWindowHandle -ne 0 -or $_.ProcessName -match '^(Discord|Spotify|steam|SignalRgb|iCUE)' } | Sort-Object ProcessName -Unique | Select-Object @{n='exe';e={$_.ProcessName + '.exe'}}, @{n='title';e={$_.MainWindowTitle}})`);
}

async function purgeNow() {
  const res = await runJson(String.raw`
Add-Type -TypeDefinition @'
${NATIVE}
'@
$b = [BatutaNative]::MemoryList(); $ok = [BatutaNative]::PurgeStandby(); $a = [BatutaNative]::MemoryList()
[pscustomobject]@{ ok = $ok; before = [math]::Round($b[0] * 4096 / 1MB); after = [math]::Round($a[0] * 4096 / 1MB) } | ConvertTo-Json -Compress`);
  if (res?.ok) {
    last.purges++;
    last.freedMB += Math.max(0, res.before - res.after);
    pushEvent({ type: 'purge', before: res.before, after: res.after, manual: true });
  }
  return res?.ok ? res : { ok: false, error: 'O Windows recusou a limpeza (precisa de administrador).' };
}

module.exports = { start, stop, save, state, rivals, processes, NOT_GAME, _sanitize: sanitize, purgeNow, suggest, parking, setParking, restoreParking, listPlans, restorePlan, GAMES, BACKGROUND, DEFAULTS, _workerScript: workerScript };
