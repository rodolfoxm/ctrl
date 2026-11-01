// Live Game Mode: watches for known game executables (from the game library) and,
// while one runs, applies a temporary session boost — process priority, the
// performance power plan and a 0.5 ms timer — then restores everything on exit.
// In "ask first" mode the UI is asked before anything changes. No injection,
// no memory access: only process priority and system settings.
const path = require('path');
const { runJson, runPowerShell, q } = require('./ps.cjs');
const store = require('./store.cjs');
const tools = require('./tools/system.cjs');
const { PLAN_MATCH } = require('./catalog/constants.cjs');

let timer = null;
let notify = () => {};
let session = null; // { gameId, name, exe, pid, start, previousPlan, applied: [], pending }
let declined = new Set(); // pids the user said no to

function games() {
  return store.load().games;
}

async function running() {
  const exes = games().map((g) => path.basename(g.exe, '.exe'));
  if (!exes.length) return [];
  const rows = await runJson(`ConvertTo-Json -Compress -InputObject @(Get-Process -Name @(${exes.map(q).join(',')}) -ErrorAction SilentlyContinue | Select-Object @{n='name';e={$_.ProcessName}}, @{n='pid';e={$_.Id}})`);
  return rows || [];
}

async function begin(game, pid) {
  const s = store.load().settings;
  const applied = [];
  let previousPlan = null;
  const r1 = await runPowerShell(`$p = Get-Process -Id ${pid} -ErrorAction Stop; $p.PriorityClass = 'High'; 'ok'`);
  if (r1.ok) applied.push('Prioridade Alta para o processo do jogo');
  if (s.liveGamePlan) {
    const cur = await runPowerShell(`if ((powercfg /getactivescheme) -match '([0-9a-fA-F-]{36})') { $Matches[1] }`);
    previousPlan = cur.ok ? cur.stdout.trim() : null;
    const r2 = await runPowerShell(String.raw`
$g = (powercfg /list | Select-String '${PLAN_MATCH}' | ForEach-Object { if ($_ -match '([0-9a-fA-F-]{36})') { $Matches[1] } } | Select-Object -First 1)
if (-not $g) { $g = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c' }
powercfg -setactive $g; 'ok'`);
    if (r2.ok) applied.push('Plano de energia de alto desempenho');
  }
  if (s.liveGameTimer) {
    tools.timerSet(0.5);
    applied.push('Resolução de timer em 0,5 ms');
  }
  session = { gameId: game.id, name: game.name, exe: game.exe, pid, start: new Date().toISOString(), previousPlan, applied };
  store.log({ action: 'apply', id: 'live-game', name: `Live Game Mode: ${game.name}`, ok: true, detail: applied.join('; ') });
  notify({ type: 'started', session });
}

async function end() {
  if (!session) return;
  const s = session;
  session = null;
  if (s.previousPlan) await runPowerShell(`powercfg -setactive ${q(s.previousPlan)}`);
  if (s.applied.some((a) => a.includes('timer'))) tools.timerReset();
  const record = { game: s.name, exe: s.exe, start: s.start, end: new Date().toISOString(), actions: s.applied };
  store.update((st) => {
    st.sessions.unshift(record);
    st.sessions = st.sessions.slice(0, 50);
  });
  store.log({ action: 'revert', id: 'live-game', name: `Live Game Mode encerrado: ${s.name}`, ok: true });
  notify({ type: 'ended', record });
}

async function tick() {
  try {
    const procs = await running();
    if (session) {
      if (!procs.some((p) => p.pid === session.pid)) await end();
      return;
    }
    const hit = procs.find((p) => !declined.has(p.pid));
    if (!hit) return;
    const game = games().find((g) => path.basename(g.exe, '.exe').toLowerCase() === hit.name.toLowerCase());
    if (!game) return;
    if (store.load().settings.liveGameModeAsk) {
      declined.add(hit.pid); // ask once per process
      notify({ type: 'detected', game: { id: game.id, name: game.name }, pid: hit.pid });
      return;
    }
    await begin(game, hit.pid);
  } catch {}
}

function start(onEvent) {
  notify = onEvent;
  if (timer) return;
  timer = setInterval(tick, 5000);
  tick();
}

async function stop() {
  clearInterval(timer);
  timer = null;
  await end();
}

/** User answered the "game detected" prompt. */
async function confirm(gameId, pid, yes) {
  if (!yes || session) return { ok: true };
  const game = games().find((g) => g.id === gameId);
  if (!game) return { ok: false, error: 'Jogo não encontrado.' };
  await begin(game, pid);
  return { ok: true };
}

function status() {
  return { enabled: !!timer, session, sessions: store.load().sessions.slice(0, 20) };
}

module.exports = { start, stop, confirm, status, endSession: end };
