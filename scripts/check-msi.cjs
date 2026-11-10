// Checks the MSI write and its restore on a scratch key under HKCU (never on a real device): an absent
// value comes back absent, an existing one comes back with its number.
const assert = require('assert');
const os = require('os');
const Module = require('module');

const resolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { return req === 'electron' ? 'electron-stub' : resolve.call(this, req, ...rest); };
require.cache['electron-stub'] = { id: 'electron-stub', filename: 'electron-stub', loaded: true, exports: { app: { getPath: () => os.tmpdir(), getVersion: () => '0' } } };

const { runPowerShell } = require('../electron/ps.cjs');
const { _msiScript: msiScript } = require('../electron/tools/system.cjs');
const { NOT_GAME } = require('../electron/batuta-worker.cjs');

const key = `HKCU:\\Software\\ctrl-check-msi-${process.pid}`;
const run = async (value) => {
  const r = await runPowerShell(msiScript(key, value));
  assert.ok(r.ok, r.stderr);
  return r.stdout.trim().split(/\r?\n/).pop();
};
const read = async () => (await runPowerShell(`(Get-Item -LiteralPath '${key}' -ErrorAction SilentlyContinue).GetValue('MSISupported', 'absent')`)).stdout.trim();

(async () => {
  try {
    assert.equal(await run(1), 'absent'); // enable: reports there was nothing
    assert.equal(await read(), '1');
    assert.equal(await run(null), '1'); // restore "absent": the value is removed, not set to 0
    assert.equal(await read(), 'absent');
    assert.equal(await run(0), 'absent');
    assert.equal(await run(1), '0'); // an existing value is reported, so it can be put back
    assert.equal(await run(0), '1');
    assert.equal(await read(), '0');
  } finally {
    await runPowerShell(`Remove-Item -LiteralPath '${key}' -Recurse -Force -ErrorAction SilentlyContinue`);
  }
  const notGame = new RegExp(NOT_GAME);
  assert.ok(notGame.test('eosoverlayrenderer-win64-shipping') && notGame.test('gameoverlayui'));
  assert.ok(!notGame.test('cs2') && !notGame.test('valorant-win64-shipping'));
  console.log('msi and overlay ok');
})().catch((e) => { console.error(e); process.exit(1); });
