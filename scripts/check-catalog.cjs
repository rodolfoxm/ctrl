// Validates the catalog without touching the system:
//  1. structure (unique ids, known modules, profile/conflict references, required fields)
//  2. PowerShell syntax of every generated script, via the PowerShell parser (nothing runs).
// usage: node scripts/check-catalog.cjs
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const catalog = require('../electron/catalog/index.cjs');
const { _scripts: S } = require('../electron/engine.cjs');

const errors = [];
const ids = new Set();
const modules = new Set(catalog.MODULES.map((m) => m.id));
const IMPACT = ['low', 'medium', 'high'];
const RISK = ['safe', 'moderate', 'advanced'];
const RESTART = ['none', 'explorer', 'logoff', 'reboot'];

for (const t of catalog.TWEAKS) {
  if (ids.has(t.id)) errors.push(`id duplicado: ${t.id}`);
  ids.add(t.id);
  if (!modules.has(t.module)) errors.push(`${t.id}: módulo desconhecido ${t.module}`);
  if (!t.name || !t.description) errors.push(`${t.id}: sem nome/descrição`);
  if (!IMPACT.includes(t.impact)) errors.push(`${t.id}: impact inválido`);
  if (!RISK.includes(t.risk)) errors.push(`${t.id}: risk inválido`);
  if (!RESTART.includes(t.restart)) errors.push(`${t.id}: restart inválido`);
  if (typeof t.admin !== 'boolean') errors.push(`${t.id}: admin não definido`);
  if (!t.registry && !t.script) errors.push(`${t.id}: sem registry nem script`);
  if (t.script && (!t.script.apply || !t.script.revert)) errors.push(`${t.id}: script sem apply/revert`);
  for (const e of t.registry || []) {
    if (!/^HK(CU|LM):\\/.test(e.path)) errors.push(`${t.id}: caminho inválido ${e.path}`);
    if (e.path.startsWith('HKLM') && !t.admin) errors.push(`${t.id}: escreve em HKLM mas admin=false`);
  }
}
for (const t of catalog.TWEAKS) {
  for (const c of t.conflicts || []) if (!ids.has(c)) errors.push(`${t.id}: conflito com id inexistente ${c}`);
}
// Two tweaks writing the same value would undo each other's backup on revert, unless they
// are declared as conflicting (then only one can be applied at a time).
const writers = new Map();
for (const t of catalog.TWEAKS) {
  for (const e of t.registry || []) {
    const key = `${e.path}|${e.name}`.toLowerCase();
    const other = writers.get(key);
    const declared = other && ((t.conflicts || []).includes(other.id) || (other.conflicts || []).includes(t.id));
    if (other && other.id !== t.id && !declared) errors.push(`${t.id}: escreve ${e.path}\\${e.name}, que ${other.id} também escreve (declare conflicts)`);
    else if (!other) writers.set(key, t);
  }
}
for (const p of catalog.PROFILES) {
  for (const id of p.tweaks) if (!ids.has(id)) errors.push(`perfil ${p.id}: tweak inexistente ${id}`);
}
const actionIds = new Set();
for (const a of catalog.ACTIONS) {
  if (actionIds.has(a.id)) errors.push(`ação duplicada: ${a.id}`);
  actionIds.add(a.id);
}

// ---- PowerShell syntax ----
const scripts = [];
for (const t of catalog.TWEAKS) {
  scripts.push({ label: `${t.id}/apply`, code: S.applyScript(t) });
  const fakeSnap = t.registry ? t.registry.map((e) => ({ path: e.path, name: e.name, exists: true, kind: e.type || 'DWord', value: e.value })) : 'x';
  scripts.push({ label: `${t.id}/revert`, code: S.restoreScript(t, fakeSnap) });
  scripts.push({ label: `${t.id}/revert-nosnap`, code: S.restoreScript(t, null) });
  const chk = S.checkExpression(t);
  if (chk) scripts.push({ label: `${t.id}/check`, code: `${S.HELPERS}\n[bool](& { ${chk} })` });
  const snap = S.snapshotScript(t);
  if (snap) scripts.push({ label: `${t.id}/snapshot`, code: snap });
}
for (const a of catalog.ACTIONS) scripts.push({ label: `action:${a.id}`, code: a.run });

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrl-check-'));
const manifest = scripts.map((s, i) => {
  const f = path.join(dir, `${i}.ps1`);
  fs.writeFileSync(f, s.code, 'utf8');
  return { label: s.label, file: f };
});
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest), 'utf8');
const parser = `
$m = Get-Content -Raw -LiteralPath '${path.join(dir, 'manifest.json').replace(/'/g, "''")}' | ConvertFrom-Json
foreach ($s in $m) {
  $tokens = $null; $errs = $null
  [void][System.Management.Automation.Language.Parser]::ParseFile($s.file, [ref]$tokens, [ref]$errs)
  foreach ($e in $errs) { "$($s.label): $($e.Message) (linha $($e.Extent.StartLineNumber))" }
}`;
const res = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', parser], { encoding: 'utf8' });
fs.rmSync(dir, { recursive: true, force: true });
if (res.status !== 0) errors.push(`parser falhou: ${res.stderr}`);
for (const line of res.stdout.split(/\r?\n/).filter(Boolean)) errors.push(`sintaxe ${line}`);

const byModule = {};
for (const t of catalog.TWEAKS) byModule[t.module] = (byModule[t.module] || 0) + 1;
console.log(`${catalog.TWEAKS.length} tweaks em ${modules.size} módulos, ${catalog.ACTIONS.length} ações, ${catalog.PROFILES.length} perfis, ${scripts.length} scripts analisados`);
console.log(Object.entries(byModule).map(([k, v]) => `${k}:${v}`).join('  '));
if (errors.length) {
  console.error(`\n${errors.length} problema(s):\n` + errors.map((e) => ` - ${e}`).join('\n'));
  process.exit(1);
}
console.log('OK');
