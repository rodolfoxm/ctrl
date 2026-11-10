// Checks the Core worker without running it against other programs: the generated PowerShell parses,
// the native helper compiles, and the one-call process snapshot sees this PowerShell with its name and CPU time.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { workerScript } = require('../electron/batuta-worker.cjs');
const NATIVE = require('../electron/batuta-native.cjs');

const cfg = {
  rules: [{ exe: 'game.exe', priority: 'high', cores: 'p', io: 'normal', gpu: 'high', efficiency: 'never', game: true }],
  containment: { enabled: true, total: 70, proc: 10, overMs: 2700, restore: 2, minMs: 2100, exclusions: [] },
  memory: { enabled: true, listMB: 1024, freeMB: 4096, onlyGaming: true, exclusions: [] },
  autoDetect: { enabled: true, priority: 'high', gpu: 'high', efficiency: 'never' },
  watchdog: [{ exe: 'busy.exe', metric: 'cpu', threshold: 20, seconds: 10, action: 'ecores' }],
};
const worker = path.join(os.tmpdir(), `ctrl-check-worker-${process.pid}.ps1`);
const file = path.join(os.tmpdir(), `ctrl-check-core-${process.pid}.ps1`);
fs.writeFileSync(worker, `\uFEFF${workerScript(cfg)}`, 'utf8');
fs.writeFileSync(file, `
$errors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile('${worker}', [ref]$null, [ref]$errors)
if ($errors.Count) { throw "worker: $($errors[0].Message) at line $($errors[0].Extent.StartLineNumber)" }
Add-Type -TypeDefinition @'
${NATIVE}
'@
$snap = [BatutaNative]::Snapshot()
$me = $snap | Where-Object Id -eq $PID
[pscustomobject]@{ count = $snap.Count; key = $me.Key; cpu = $me.Cpu; ws = $me.WorkingSet; path = [BatutaNative]::ImagePath($PID); prio = [BatutaNative]::Priority($PID) } | ConvertTo-Json -Compress`, 'utf8');
try {
  const out = JSON.parse(execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], { encoding: 'utf8' }));
  assert.ok(out.count > 10, 'snapshot lists the processes');
  assert.equal(out.key, 'powershell');
  assert.ok(out.cpu > 0 && out.ws > 0, 'cpu time and working set are read');
  assert.match(out.path, /powershell\.exe$/i);
  assert.ok(out.prio > 0, 'priority class is read');
  console.log(`core worker ok (${out.count} processes)`);
} finally {
  fs.rmSync(file, { force: true });
  fs.rmSync(worker, { force: true });
}
