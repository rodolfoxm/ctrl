// Tweak engine: snapshots the current state before applying, so every revert
// restores exactly what the machine had (not a guessed default). Also verifies
// applied tweaks against the live system ("drift") and repairs them.
const { runPowerShell, runJson, q } = require('./ps.cjs');
const store = require('./store.cjs');

const HELPERS = String.raw`
function Set-Val($p, $n, $v, $t, $mustExist) {
  if (-not (Test-Path -LiteralPath $p)) {
    if ($mustExist) { return }
    New-Item -Path $p -Force | Out-Null
  }
  if ($t -eq 'Binary') { $v = [byte[]]$v }
  if ($t -eq 'MultiString') { $v = [string[]]$v }
  New-ItemProperty -LiteralPath $p -Name $n -Value $v -PropertyType $t -Force | Out-Null
}
function Del-Val($p, $n) {
  if (Test-Path -LiteralPath $p) { Remove-ItemProperty -LiteralPath $p -Name $n -ErrorAction SilentlyContinue }
}
function Test-Val($p, $n, $v, $mustExist) {
  if (-not (Test-Path -LiteralPath $p)) { return [bool]$mustExist }
  $c = (Get-Item -LiteralPath $p).GetValue($n, $null)
  if ($null -eq $c) { return $false }
  if ($c -is [byte[]]) { return (($c | ForEach-Object { [int]$_ }) -join ',') -eq (@($v) -join ',') }
  if ($c -is [int] -and $v -is [int64]) { return ([int64]$c -band 4294967295) -eq $v }
  return ([string]$c -eq [string]$v)
}
function Get-Snap($p, $n) {
  $o = [ordered]@{ path = $p; name = $n; exists = $false; kind = $null; value = $null }
  if (Test-Path -LiteralPath $p) {
    $k = Get-Item -LiteralPath $p
    if ($k.GetValueNames() -contains $n) {
      $o.exists = $true
      $o.kind = $k.GetValueKind($n).ToString()
      $v = $k.GetValue($n, $null, 'DoNotExpandEnvironmentNames')
      if ($v -is [byte[]]) { $v = @($v | ForEach-Object { [int]$_ }) }
      $o.value = $v
    }
  }
  [pscustomobject]$o
}
`;

function literal(value, type) {
  if (Array.isArray(value)) return `@(${value.map((v) => literal(v)).join(',')})`;
  if (typeof value === 'number') {
    if (type === 'DWord' && value > 0x7fffffff) return String(value - 0x100000000);
    return String(value);
  }
  return q(value);
}

/** Literal used when comparing: DWORDs above 0x7FFFFFFF compare as unsigned. */
function testLiteral(value, type) {
  if (typeof value === 'number' && type === 'DWord' && value > 0x7fffffff) return `([int64]${value})`;
  return literal(value, type);
}

function setLine(path, name, value, type, mustExist) {
  return `Set-Val ${q(path)} ${q(name)} ${literal(value, type)} ${q(type)} $${mustExist ? 'true' : 'false'}`;
}

function applyScript(t) {
  const lines = [HELPERS];
  for (const e of t.registry || []) lines.push(setLine(e.path, e.name, e.value, e.type || 'DWord', e.ifKeyExists));
  if (t.script) lines.push(t.script.apply);
  if (t.afterApply) lines.push(t.afterApply);
  return lines.join('\n');
}

function restoreScript(t, snapshot) {
  const lines = [HELPERS];
  if (t.registry) {
    for (const e of t.registry) {
      const snap = Array.isArray(snapshot) ? snapshot.find((s) => s.path === e.path && s.name === e.name) : null;
      if (snap) {
        lines.push(snap.exists ? setLine(e.path, e.name, snap.value, snap.kind, e.ifKeyExists) : `Del-Val ${q(e.path)} ${q(e.name)}`);
      } else if (e.revertTo !== undefined) {
        lines.push(setLine(e.path, e.name, e.revertTo, e.type || 'DWord', e.ifKeyExists));
      } else {
        lines.push(`Del-Val ${q(e.path)} ${q(e.name)}`);
      }
    }
  }
  if (t.script) {
    lines.push(`$Snapshot = ${snapshot == null || typeof snapshot === 'object' ? '$null' : q(snapshot)}`);
    lines.push(t.script.revert);
  }
  if (t.afterRevert) lines.push(t.afterRevert);
  return lines.join('\n');
}

/** PowerShell expression returning $true/$false, or null when the tweak can't be read back. */
function checkExpression(t) {
  if (t.script) return t.script.check || null;
  const parts = (t.registry || []).map(
    (e) => `(Test-Val ${q(e.path)} ${q(e.name)} ${testLiteral(e.value, e.type || 'DWord')} $${e.ifKeyExists ? 'true' : 'false'})`,
  );
  return parts.length ? parts.join(' -and ') : null;
}

function snapshotScript(t) {
  if (t.registry) {
    const body = t.registry.map((e) => `$s += Get-Snap ${q(e.path)} ${q(e.name)}`).join('\n');
    return `${HELPERS}\n$s = @()\n${body}\nConvertTo-Json -InputObject @($s) -Depth 4 -Compress`;
  }
  return t.script?.snapshot || null;
}

async function takeSnapshot(t) {
  const script = snapshotScript(t);
  if (!script) return null;
  if (t.registry) return runJson(script);
  const res = await runPowerShell(script);
  return res.ok ? res.stdout.split(/\r?\n/).pop().trim() : null;
}

let adminCache = null;
async function isAdmin() {
  if (adminCache !== null) return adminCache;
  const res = await runPowerShell(
    '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
  );
  adminCache = res.ok && /true/i.test(res.stdout);
  return adminCache;
}

async function requireAdmin(t) {
  if (t.admin && !(await isAdmin())) {
    throw new Error('Esta alteração precisa de privilégios de administrador. Reinicie o app como administrador.');
  }
}

/** Applies one tweak. `findTweak` resolves conflicting ids so they're reverted first. */
async function apply(t, { findTweak, source = 'manual' } = {}) {
  try {
    await requireAdmin(t);
    for (const cid of t.conflicts || []) {
      const other = findTweak?.(cid);
      if (other && store.load().applied[cid]) {
        const r = await revert(other, { source: `conflito com ${t.name}` });
        if (!r.ok) throw new Error(`Não foi possível desfazer "${other.name}", que conflita com este tweak: ${r.error}`);
      }
    }
    const already = store.load().applied[t.id];
    const snapshot = already ? already.snapshot : await takeSnapshot(t);
    const res = await runPowerShell(applyScript(t), { timeout: t.timeout || 120000 });
    if (!res.ok) throw new Error(res.stderr || 'Falha ao aplicar.');
    store.update((s) => {
      s.applied[t.id] = { name: t.name, module: t.module, at: already?.at || new Date().toISOString(), snapshot, source };
    });
    store.log({ action: already ? 'repair' : 'apply', id: t.id, name: t.name, module: t.module, ok: true, source });
    return { ok: true, restart: t.restart || 'none' };
  } catch (err) {
    store.log({ action: 'apply', id: t.id, name: t.name, module: t.module, ok: false, error: err.message, source });
    return { ok: false, error: err.message };
  }
}

async function revert(t, { source = 'manual' } = {}) {
  try {
    await requireAdmin(t);
    const entry = store.load().applied[t.id];
    const res = await runPowerShell(restoreScript(t, entry ? entry.snapshot : null), { timeout: t.timeout || 120000 });
    if (!res.ok) throw new Error(res.stderr || 'Falha ao reverter.');
    store.update((s) => {
      delete s.applied[t.id];
    });
    store.log({ action: 'revert', id: t.id, name: t.name, module: t.module, ok: true, source });
    return { ok: true, restart: t.restart || 'none' };
  } catch (err) {
    store.log({ action: 'revert', id: t.id, name: t.name, module: t.module, ok: false, error: err.message, source });
    return { ok: false, error: err.message };
  }
}

const RESTART_RANK = { none: 0, explorer: 1, logoff: 2, reboot: 3 };

/** Runs apply/revert over many tweaks sequentially, reporting progress. */
async function runMany(tweaks, op, opts = {}, onProgress) {
  const results = [];
  let restart = 'none';
  for (let i = 0; i < tweaks.length; i++) {
    const t = tweaks[i];
    onProgress?.({ index: i, total: tweaks.length, id: t.id, name: t.name });
    const r = op === 'apply' ? await apply(t, opts) : await revert(t, opts);
    results.push({ id: t.id, name: t.name, ...r });
    if (r.ok && RESTART_RANK[r.restart] > RESTART_RANK[restart]) restart = r.restart;
  }
  onProgress?.({ index: tweaks.length, total: tweaks.length, done: true });
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, results, failed, restart };
}

/** Returns { [id]: true | false | null } describing whether each tweak is currently active. */
async function checkMany(tweaks) {
  const out = {};
  const readable = [];
  for (const t of tweaks) {
    if (checkExpression(t)) readable.push(t);
    else out[t.id] = null;
  }
  // Chunk so one slow check (e.g. Get-NetAdapter) can't time out the whole batch.
  for (let i = 0; i < readable.length; i += 40) {
    const chunk = readable.slice(i, i + 40);
    const body = chunk
      .map((t) => `try { $r[${q(t.id)}] = [bool](& { ${checkExpression(t)} }) } catch { $r[${q(t.id)}] = $null }`)
      .join('\n');
    try {
      Object.assign(out, await runJson(`${HELPERS}\n$r = [ordered]@{}\n${body}\n$r | ConvertTo-Json -Compress`, { timeout: 90000 }));
    } catch {
      for (const t of chunk) out[t.id] = null;
    }
  }
  return out;
}

/**
 * Re-reads every applied tweak from the live system. A tweak the app applied that now
 * reads as inactive has "drifted" (Windows Update, another tool or the user reverted it).
 */
async function verify(findTweak) {
  const applied = store.load().applied;
  const tweaks = Object.keys(applied).map(findTweak).filter(Boolean);
  const live = await checkMany(tweaks);
  const items = tweaks.map((t) => ({
    id: t.id,
    name: t.name,
    module: t.module,
    state: live[t.id] === true ? 'verified' : live[t.id] === false ? 'drifted' : 'unverifiable',
  }));
  const sweep = {
    at: new Date().toISOString(),
    verified: items.filter((i) => i.state === 'verified').length,
    drifted: items.filter((i) => i.state === 'drifted').map((i) => i.id),
    unverifiable: items.filter((i) => i.state === 'unverifiable').length,
  };
  store.update((s) => {
    s.sweeps.unshift(sweep);
    s.sweeps = s.sweeps.slice(0, 120);
  });
  return { at: sweep.at, items };
}

async function runAction(a) {
  try {
    if (a.admin && !(await isAdmin())) throw new Error('Esta ação precisa de privilégios de administrador.');
    const res = await runPowerShell(a.run, { timeout: a.timeout || 120000 });
    if (!res.ok) throw new Error(res.stderr || 'Falha ao executar.');
    store.log({ action: 'run', id: a.id, name: a.name, ok: true });
    return { ok: true, output: res.stdout.split(/\r?\n/).pop(), restart: a.restart || 'none' };
  } catch (err) {
    store.log({ action: 'run', id: a.id, name: a.name, ok: false, error: err.message });
    return { ok: false, error: err.message };
  }
}

module.exports = {
  apply, revert, runMany, checkMany, verify, runAction, isAdmin,
  // Exposed for scripts/check-catalog.cjs (syntax validation without executing anything).
  _scripts: { applyScript, restoreScript, checkExpression, snapshotScript, HELPERS },
};
