// System tools: Windows Update pause, startup apps, timer resolution, MSI mode and
// DPC/interrupt sampling.
const { runJson, runPowerShell, streamPowerShell, q } = require('../ps.cjs');
const store = require('../store.cjs');

// ---------------- Windows Update ----------------
const WU_UX = 'HKLM:\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings';
const PAUSE_NAMES = ['PauseUpdatesStartTime', 'PauseUpdatesExpiryTime', 'PauseFeatureUpdatesStartTime', 'PauseFeatureUpdatesEndTime', 'PauseQualityUpdatesStartTime', 'PauseQualityUpdatesEndTime'];

async function wuStatus() {
  return runJson(String.raw`
$ux = Get-ItemProperty '${WU_UX}' -ErrorAction SilentlyContinue
$svc = Get-Service wuauserv -ErrorAction SilentlyContinue
$last = Get-HotFix -ErrorAction SilentlyContinue | Where-Object InstalledOn | Sort-Object InstalledOn -Descending | Select-Object -First 1
$reboot = Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired'
[pscustomobject]@{
  pausedUntil = [string]$ux.PauseUpdatesExpiryTime
  service = if ($svc) { [string]$svc.Status } else { 'Missing' }
  startType = if ($svc) { [string]$svc.StartType } else { $null }
  lastHotfix = if ($last) { [pscustomobject]@{ id = $last.HotFixID; at = $last.InstalledOn.ToString('o'); description = $last.Description } } else { $null }
  rebootPending = $reboot
} | ConvertTo-Json -Compress`);
}

async function wuPause(days) {
  const d = Math.max(1, Math.min(35, Number(days) || 7));
  const res = await runPowerShell(String.raw`
$start = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$end = (Get-Date).AddDays(${d}).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
if (-not (Test-Path '${WU_UX}')) { New-Item -Path '${WU_UX}' -Force | Out-Null }
foreach ($n in 'PauseUpdatesStartTime','PauseFeatureUpdatesStartTime','PauseQualityUpdatesStartTime') { New-ItemProperty '${WU_UX}' -Name $n -Value $start -PropertyType String -Force | Out-Null }
foreach ($n in 'PauseUpdatesExpiryTime','PauseFeatureUpdatesEndTime','PauseQualityUpdatesEndTime') { New-ItemProperty '${WU_UX}' -Name $n -Value $end -PropertyType String -Force | Out-Null }`);
  if (!res.ok) throw new Error(res.stderr || 'Falha ao pausar atualizações.');
  store.log({ action: 'apply', id: 'wu-pause', name: `Windows Update pausado por ${d} dias`, ok: true });
  return { ok: true };
}

async function wuResume() {
  const res = await runPowerShell(`${PAUSE_NAMES.map((n) => `Remove-ItemProperty '${WU_UX}' -Name '${n}' -ErrorAction SilentlyContinue`).join('\n')}`);
  if (!res.ok) throw new Error(res.stderr || 'Falha ao retomar atualizações.');
  store.log({ action: 'revert', id: 'wu-pause', name: 'Windows Update retomado', ok: true });
  return { ok: true };
}

// ---------------- Apps de inicialização ----------------
const APPROVED = {
  HKCU_Run: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run',
  HKLM_Run: 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run',
  HKLM_Run32: 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run32',
  HKCU_Folder: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder',
  HKLM_Folder: 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder',
};

async function startupList() {
  return runJson(String.raw`
function Approved($key, $name) {
  $v = (Get-Item -LiteralPath $key -ErrorAction SilentlyContinue).GetValue($name, $null)
  if ($null -eq $v) { return $true }
  return -not ($v[0] -band 1)
}
$items = @()
$sources = @(
  @{ reg = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'; approved = '${APPROVED.HKCU_Run}'; scope = 'Usuário' },
  @{ reg = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run'; approved = '${APPROVED.HKLM_Run}'; scope = 'Todos os usuários' },
  @{ reg = 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run'; approved = '${APPROVED.HKLM_Run32}'; scope = 'Todos os usuários (32 bits)' }
)
foreach ($s in $sources) {
  $k = Get-Item -LiteralPath $s.reg -ErrorAction SilentlyContinue
  if (-not $k) { continue }
  foreach ($n in $k.GetValueNames()) {
    if (-not $n) { continue }
    $items += [pscustomobject]@{ name = $n; command = [string]$k.GetValue($n); scope = $s.scope; approvedKey = $s.approved; enabled = (Approved $s.approved $n); kind = 'registry' }
  }
}
$folders = @(
  @{ path = [Environment]::GetFolderPath('Startup'); approved = '${APPROVED.HKCU_Folder}'; scope = 'Usuário' },
  @{ path = [Environment]::GetFolderPath('CommonStartup'); approved = '${APPROVED.HKLM_Folder}'; scope = 'Todos os usuários' }
)
foreach ($f in $folders) {
  Get-ChildItem -LiteralPath $f.path -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'desktop.ini' } | ForEach-Object {
    $items += [pscustomobject]@{ name = $_.Name; command = $_.FullName; scope = $f.scope; approvedKey = $f.approved; enabled = (Approved $f.approved $_.Name); kind = 'folder' }
  }
}
ConvertTo-Json -InputObject @($items) -Compress`);
}

/** Same mechanism Task Manager uses: a StartupApproved flag, so nothing is deleted. */
async function startupSet(approvedKey, name, enabled) {
  if (!Object.values(APPROVED).includes(approvedKey)) throw new Error('Origem inválida.');
  const bytes = enabled ? '@(2,0,0,0,0,0,0,0,0,0,0,0)' : '[byte[]](@(3,0,0,0) + [BitConverter]::GetBytes([DateTime]::UtcNow.ToFileTimeUtc()))';
  const res = await runPowerShell(`
if (-not (Test-Path -LiteralPath ${q(approvedKey)})) { New-Item -Path ${q(approvedKey)} -Force | Out-Null }
New-ItemProperty -LiteralPath ${q(approvedKey)} -Name ${q(name)} -Value ([byte[]]${bytes}) -PropertyType Binary -Force | Out-Null`);
  if (!res.ok) throw new Error(/denied|negado/i.test(res.stderr) ? 'Precisa de administrador para alterar itens de todos os usuários.' : res.stderr);
  store.log({ action: enabled ? 'revert' : 'apply', id: `startup:${name}`, name: `${enabled ? 'Ativado' : 'Desativado'} na inicialização: ${name}`, ok: true });
  return { ok: true };
}

// ---------------- Resolução do timer ----------------
const NT_TIMER = String.raw`
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class CtrlTimer {
  [DllImport("ntdll.dll")] public static extern int NtQueryTimerResolution(out uint min, out uint max, out uint cur);
  [DllImport("ntdll.dll")] public static extern int NtSetTimerResolution(uint desired, bool set, out uint cur);
}
'@`;

let timerStop = null;
let timerTarget = null;

async function timerStatus() {
  const r = await runJson(`${NT_TIMER}
$min = 0; $max = 0; $cur = 0; [void][CtrlTimer]::NtQueryTimerResolution([ref]$min, [ref]$max, [ref]$cur)
[pscustomobject]@{ coarsest = $min / 10000.0; finest = $max / 10000.0; current = $cur / 10000.0 } | ConvertTo-Json -Compress`);
  return { ...r, holding: timerTarget };
}

/**
 * Holds the requested resolution (ms) for as long as the app runs, and saves it as the choice applied on the
 * next launch. `quiet` is for that launch: no history entry each time the app opens.
 */
function timerSet(ms, { quiet = false } = {}) {
  const units = Math.round(Math.max(0.5, Math.min(15.625, Number(ms))) * 10000);
  stopHold();
  timerStop = streamPowerShell(`${NT_TIMER}
$cur = 0; [void][CtrlTimer]::NtSetTimerResolution(${units}, $true, [ref]$cur)
[Console]::Out.WriteLine($cur)
while ($true) { Start-Sleep -Seconds 3600 }`, () => {});
  timerTarget = units / 10000;
  store.update((s) => { s.settings.timerMs = timerTarget; });
  if (!quiet) store.log({ action: 'apply', id: 'timer-resolution', name: `Resolução do timer em ${timerTarget} ms`, ok: true });
  return { ok: true, holding: timerTarget };
}

function stopHold() {
  if (timerStop) timerStop();
  timerStop = null;
  const was = timerTarget;
  timerTarget = null;
  return was;
}

/** The user releases it: Windows decides again, also on the next launches. */
function timerReset() {
  if (stopHold()) store.log({ action: 'revert', id: 'timer-resolution', name: 'Resolução do timer liberada', ok: true });
  store.update((s) => { s.settings.timerMs = null; });
  return { ok: true };
}

const timerHolding = () => timerTarget;

// ---------------- Modo MSI ----------------
async function msiList() {
  return runJson(String.raw`
$out = @()
Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Enum\PCI' -ErrorAction SilentlyContinue | ForEach-Object { Get-ChildItem $_.PSPath -ErrorAction SilentlyContinue } | ForEach-Object {
  $im = Join-Path $_.PSPath 'Device Parameters\Interrupt Management'
  if (-not (Test-Path $im)) { return }
  $dev = Get-Item $_.PSPath
  $desc = [string]$dev.GetValue('FriendlyName')
  if (-not $desc) { $desc = ([string]$dev.GetValue('DeviceDesc')) -replace '^.*;', '' }
  $cls = [string]$dev.GetValue('Class')
  $msiKey = Join-Path $im 'MessageSignaledInterruptProperties'
  $msi = if (Test-Path $msiKey) { (Get-Item $msiKey).GetValue('MSISupported', $null) } else { $null }
  $pol = Join-Path $im 'Affinity Policy'
  $prio = if (Test-Path $pol) { (Get-Item $pol).GetValue('DevicePriority', $null) } else { $null }
  $out += [pscustomobject]@{ id = $_.PSPath -replace '^.*::HKEY_LOCAL_MACHINE', 'HKLM:'; name = $desc; class = $cls; msi = $msi; priority = $prio }
}
ConvertTo-Json -InputObject @($out | Sort-Object class, name) -Compress`);
}

/**
 * Writes MSISupported, or removes it when value is null (the driver's own default). Prints what was there
 * before: "absent" or the number. Kept apart from msiSet so it can be exercised on a scratch key.
 */
function msiScript(key, value) {
  return `
$old = if (Test-Path -LiteralPath ${q(key)}) { (Get-Item -LiteralPath ${q(key)}).GetValue('MSISupported', $null) } else { $null }
${value == null
    ? `if ($null -ne $old) { Remove-ItemProperty -LiteralPath ${q(key)} -Name MSISupported -ErrorAction Stop }`
    : `if (-not (Test-Path -LiteralPath ${q(key)})) { New-Item -Path ${q(key)} -Force | Out-Null }
New-ItemProperty -LiteralPath ${q(key)} -Name MSISupported -Value ${Number(value)} -PropertyType DWord -Force | Out-Null`}
if ($null -eq $old) { 'absent' } else { [string]$old }`;
}

async function msiSet(id, enabled) {
  if (!/^HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\PCI\\/.test(id)) throw new Error('Dispositivo inválido.');
  const key = `${id}\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties`;
  // Turning it off after the ctrl turned it on puts back what the device had (often no value at all),
  // instead of forcing 0. The first write keeps the original; turning off without a backup writes 0, as asked.
  const backup = store.load().msiBackup?.[id];
  const value = enabled ? 1 : backup !== undefined ? backup : 0;
  const res = await runPowerShell(msiScript(key, value));
  if (!res.ok) throw new Error(res.stderr);
  const before = res.stdout.trim().split(/\r?\n/).pop();
  store.update((s) => {
    s.msiBackup = s.msiBackup || {};
    if (enabled && s.msiBackup[id] === undefined) s.msiBackup[id] = before === 'absent' ? null : Number(before);
    else if (!enabled) delete s.msiBackup[id];
  });
  store.log({ action: enabled ? 'apply' : 'revert', id: 'msi', name: `Modo MSI ${enabled ? 'ativado' : 'desativado'}: ${id.split('\\').slice(-2).join('\\')}`, ok: true });
  return { ok: true, restart: 'reboot' };
}

// ---------------- DPC / interrupções ----------------
async function dpcSample(seconds = 10) {
  const n = Math.max(3, Math.min(60, seconds));
  return runJson(String.raw`
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class CtrlPdh {
  [DllImport("pdh.dll", CharSet = CharSet.Unicode)] static extern uint PdhOpenQuery(string s, IntPtr u, out IntPtr q);
  [DllImport("pdh.dll", CharSet = CharSet.Unicode)] static extern uint PdhAddEnglishCounter(IntPtr q, string p, IntPtr u, out IntPtr c);
  [DllImport("pdh.dll")] static extern uint PdhCollectQueryData(IntPtr q);
  [DllImport("pdh.dll")] static extern uint PdhGetFormattedCounterValue(IntPtr c, uint f, IntPtr t, out Val v);
  [StructLayout(LayoutKind.Explicit)] public struct Val { [FieldOffset(0)] public uint status; [FieldOffset(8)] public double value; }
  static IntPtr q;
  public static void Open() { PdhOpenQuery(null, IntPtr.Zero, out q); }
  public static IntPtr Add(string p) { IntPtr c; return PdhAddEnglishCounter(q, p, IntPtr.Zero, out c) == 0 ? c : IntPtr.Zero; }
  public static void Collect() { PdhCollectQueryData(q); }
  public static double Get(IntPtr c) { Val v; if (c == IntPtr.Zero || PdhGetFormattedCounterValue(c, 0x200, IntPtr.Zero, out v) != 0) return -1; return v.value; }
}
'@
[CtrlPdh]::Open()
$c = @{
  dpc = [CtrlPdh]::Add('\Processor(_Total)\% DPC Time')
  isr = [CtrlPdh]::Add('\Processor(_Total)\% Interrupt Time')
  dpcRate = [CtrlPdh]::Add('\Processor(_Total)\DPCs Queued/sec')
  isrRate = [CtrlPdh]::Add('\Processor(_Total)\Interrupts/sec')
}
[CtrlPdh]::Collect()
$series = @()
for ($i = 0; $i -lt ${n}; $i++) {
  Start-Sleep -Seconds 1
  [CtrlPdh]::Collect()
  $series += [pscustomobject]@{ dpc = [math]::Round([CtrlPdh]::Get($c.dpc), 3); isr = [math]::Round([CtrlPdh]::Get($c.isr), 3); dpcRate = [int][CtrlPdh]::Get($c.dpcRate); isrRate = [int][CtrlPdh]::Get($c.isrRate) }
}
ConvertTo-Json -InputObject @{ series = $series } -Depth 3 -Compress`, { timeout: (n + 30) * 1000 });
}

module.exports = {
  _msiScript: msiScript,
  wuStatus, wuPause, wuResume,
  startupList, startupSet,
  timerStatus, timerSet, timerReset, timerHolding, timerStop: stopHold,
  msiList, msiSet,
  dpcSample,
};
