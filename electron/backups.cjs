// System Restore points. Restoring is delegated to Windows' own wizard (rstrui).
const { runPowerShell, runJson, q } = require('./ps.cjs');
const store = require('./store.cjs');

const SR_KEY = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\SystemRestore';

async function status() {
  const res = await runJson(String.raw`
$rp = @(Get-ComputerRestorePoint -ErrorAction SilentlyContinue | ForEach-Object {
  [pscustomobject]@{ seq = $_.SequenceNumber; description = $_.Description; type = $_.RestorePointType; created = ([Management.ManagementDateTimeConverter]::ToDateTime($_.CreationTime)).ToString('o') }
})
$enabled = $null -ne (Get-ItemProperty '${SR_KEY}' -Name RPSessionInterval -ErrorAction SilentlyContinue) -and (Get-ItemProperty '${SR_KEY}').RPSessionInterval -ge 1
[pscustomobject]@{ enabled = $enabled; points = $rp } | ConvertTo-Json -Depth 4 -Compress`);
  const points = (res?.points || []).sort((a, b) => b.seq - a.seq);
  return { enabled: !!res?.enabled, points };
}

async function create(description) {
  // Windows silently skips a new point if one was made in the last 24h unless this is 0.
  const res = await runPowerShell(
    `New-ItemProperty -Path '${SR_KEY}' -Name SystemRestorePointCreationFrequency -Value 0 -PropertyType DWord -Force | Out-Null
Checkpoint-Computer -Description ${q(description || 'ctrl')} -RestorePointType MODIFY_SETTINGS`,
    { timeout: 300000 },
  );
  store.log({ action: 'restore-point', id: 'restore-point', name: description, ok: res.ok, error: res.ok ? undefined : res.stderr });
  return res.ok ? { ok: true } : { ok: false, error: res.stderr || 'Falha ao criar o ponto de restauração.' };
}

async function enable() {
  const res = await runPowerShell(`Enable-ComputerRestore -Drive "$env:SystemDrive\\"`);
  return res.ok ? { ok: true } : { ok: false, error: res.stderr };
}

module.exports = { status, create, enable };
