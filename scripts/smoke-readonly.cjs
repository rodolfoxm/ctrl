// Read-only smoke test against the real machine: runs every status check and the
// diagnostic tools that only read state. Nothing is applied, cleaned or changed.
// usage: node scripts/smoke-readonly.cjs
const Module = require('module');
const os = require('os');
const path = require('path');

// Minimal electron stub so store.cjs can resolve a (temporary) data folder.
const tmp = path.join(os.tmpdir(), 'ctrl-smoke');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req === 'electron') return 'electron-stub';
  return origResolve.call(this, req, ...rest);
};
require.cache['electron-stub'] = { id: 'electron-stub', filename: 'electron-stub', loaded: true, exports: { app: { getPath: () => tmp, isPackaged: false, getAppPath: () => process.cwd() } } };

const catalog = require('../electron/catalog/index.cjs');
const engine = require('../electron/engine.cjs');
const machine = require('../electron/machine.cjs');
const health = require('../electron/tools/health.cjs');
const net = require('../electron/tools/network.cjs');
const cleaner = require('../electron/tools/cleaner.cjs');
const sys = require('../electron/tools/system.cjs');
const scheduler = require('../electron/tools/scheduler.cjs');
const hardware = require('../electron/hardware.cjs');
const backups = require('../electron/backups.cjs');

const results = [];
async function step(name, fn, summarize = (r) => JSON.stringify(r).slice(0, 160)) {
  const t0 = Date.now();
  try {
    const r = await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`OK   ${name} (${Date.now() - t0} ms) ${summarize(r)}`);
    return r;
  } catch (err) {
    results.push({ name, ok: false });
    console.log(`FAIL ${name}: ${err.message}`);
    return null;
  }
}

(async () => {
  const m = await step('machine.get', () => machine.get(), (r) => `win11=${r.win11} gpu=${r.gpuVendors} laptop=${r.laptop} ram=${r.ramGb}GB wifi=${r.wifi} ssd=${r.ssd}`);
  const status = await step('engine.checkMany (todos)', () => engine.checkMany(catalog.TWEAKS), (r) => {
    const v = Object.values(r);
    return `ativos=${v.filter((x) => x === true).length} inativos=${v.filter((x) => x === false).length} ilegíveis=${v.filter((x) => x == null).length}`;
  });
  if (status) {
    const unreadable = catalog.TWEAKS.filter((t) => status[t.id] == null && engine._scripts.checkExpression(t));
    if (unreadable.length) console.log(`     verificações que falharam ao ler: ${unreadable.map((t) => t.id).join(', ')}`);
  }
  if (m) {
    const hidden = catalog.TWEAKS.filter((t) => catalog.gate(t, m));
    console.log(`     ocultos nesta máquina: ${hidden.length} (${hidden.map((t) => t.id).join(', ')})`);
  }
  await step('hardware.getStatic', () => hardware.getStatic(), (r) => `${r.cpu?.name} | ${r.gpus?.map((g) => g.name).join(', ')}`);
  await step('backups.status', () => backups.status(), (r) => `enabled=${r.enabled} points=${r.points.length}`);
  await step('health.disks', () => health.disks(), (r) => r.map((d) => `${d.name} ${d.health} temp=${d.temperature}`).join(' | '));
  await step('health.battery', () => health.battery(), (r) => `present=${r.present}`);
  await step('health.bootTimes', () => health.bootTimes(), (r) => `events=${r.events?.length} error=${r.error ? 'sim' : 'não'}`);
  await step('net.state', () => net.state(), (r) => r.interfaces.map((i) => `${i.alias}: ${i.servers.join(',')}`).join(' | '));
  await step('net.latency', () => net.latency(['1.1.1.1'], 5), (r) => r.results.map((x) => `${x.host} avg=${x.avg} jitter=${x.jitter} lost=${x.lost}`).join(' | '));
  await step('cleaner.scan', () => cleaner.scan(), (r) => `${(r.items.reduce((a, i) => a + i.bytes, 0) / 1048576).toFixed(0)} MB em ${r.items.length} categorias`);
  await step('wu.status', () => sys.wuStatus(), (r) => `service=${r.service} paused=${r.pausedUntil || 'não'} reboot=${r.rebootPending}`);
  await step('startup.list', () => sys.startupList(), (r) => `${r.length} itens`);
  await step('timer.status', () => sys.timerStatus(), (r) => `atual=${r.current}ms fino=${r.finest}ms`);
  await step('msi.list', () => sys.msiList(), (r) => `${r.length} dispositivos PCI`);
  await step('dpc.sample(3s)', () => sys.dpcSample(3), (r) => `dpc=${r.series.map((s) => s.dpc).join(',')}`);
  await step('scheduler.list', () => scheduler.list(), (r) => `${r.filter((x) => x.installed).length}/${r.length} instaladas`);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} etapas OK`);
  process.exit(failed.length ? 1 : 0);
})();
