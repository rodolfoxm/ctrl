// Hardware info (one-shot CIM query) and a live sampler: CPU/RAM come from
// Node every second; GPU, temperature, disk and network come from a single
// long-running PowerShell loop over WMI performance classes (not localized).
const os = require('os');
const { runJson, streamPowerShell } = require('./ps.cjs');

const STATIC_SCRIPT = String.raw`
$os  = Get-CimInstance Win32_OperatingSystem
$cs  = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$bb  = Get-CimInstance Win32_BaseBoard
$bios = Get-CimInstance Win32_BIOS
$ram = @(Get-CimInstance Win32_PhysicalMemory)
$cv  = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$vram = @{}
Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}' -ErrorAction SilentlyContinue | ForEach-Object {
  $d = $_.GetValue('DriverDesc'); $m = $_.GetValue('HardwareInformation.qwMemorySize')
  if ($d -and $m) { $vram[$d] = [int64]$m }
}
$gpus = @(Get-CimInstance Win32_VideoController | ForEach-Object {
  $mem = if ($vram.ContainsKey($_.Name)) { $vram[$_.Name] } else { [int64]$_.AdapterRAM }
  [pscustomobject]@{ name = $_.Name; driver = $_.DriverVersion; vram = $mem; resolution = "$($_.CurrentHorizontalResolution)x$($_.CurrentVerticalResolution)"; refresh = $_.CurrentRefreshRate }
})
$disks = @(Get-PhysicalDisk -ErrorAction SilentlyContinue | ForEach-Object {
  [pscustomobject]@{ name = $_.FriendlyName; media = [string]$_.MediaType; bus = [string]$_.BusType; size = [int64]$_.Size }
})
$volumes = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
  [pscustomobject]@{ letter = $_.DeviceID; size = [int64]$_.Size; free = [int64]$_.FreeSpace }
})
$net = @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object Status -eq 'Up' | ForEach-Object {
  [pscustomobject]@{ name = $_.Name; description = $_.InterfaceDescription; speed = $_.LinkSpeed }
})
[pscustomobject]@{
  os = [pscustomobject]@{ name = $os.Caption; version = $cv.DisplayVersion; build = "$($os.BuildNumber).$($cv.UBR)"; installed = $os.InstallDate.ToString('yyyy-MM-dd'); bootTime = $os.LastBootUpTime.ToString('o') }
  computer = [pscustomobject]@{ manufacturer = $cs.Manufacturer; model = $cs.Model; chassis = (Get-CimInstance Win32_SystemEnclosure).ChassisTypes[0] }
  cpu = [pscustomobject]@{ name = $cpu.Name.Trim(); cores = $cpu.NumberOfCores; threads = $cpu.NumberOfLogicalProcessors; maxMhz = $cpu.MaxClockSpeed; socket = $cpu.SocketDesignation }
  board = [pscustomobject]@{ manufacturer = $bb.Manufacturer; product = $bb.Product; bios = "$($bios.Manufacturer) $($bios.SMBIOSBIOSVersion)"; biosDate = if ($bios.ReleaseDate) { $bios.ReleaseDate.ToString('yyyy-MM-dd') } else { $null } }
  memory = [pscustomobject]@{ total = [int64]$cs.TotalPhysicalMemory; modules = @($ram | ForEach-Object { [pscustomobject]@{ size = [int64]$_.Capacity; speed = $_.ConfiguredClockSpeed; maker = $_.Manufacturer; part = ([string]$_.PartNumber).Trim() } }) }
  gpus = $gpus
  disks = $disks
  volumes = $volumes
  network = $net
} | ConvertTo-Json -Depth 5 -Compress
`;

// PDH with English counter paths works on any Windows display language
// (Get-Counter and the WMI perf classes depend on localized/registered providers).
const LIVE_SCRIPT = String.raw`
$ErrorActionPreference = 'Continue'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CtrlPdhLive {
  [DllImport("pdh.dll", CharSet = CharSet.Unicode)] static extern uint PdhOpenQuery(string src, IntPtr user, out IntPtr q);
  [DllImport("pdh.dll", CharSet = CharSet.Unicode)] static extern uint PdhAddEnglishCounter(IntPtr q, string path, IntPtr user, out IntPtr c);
  [DllImport("pdh.dll")] static extern uint PdhCollectQueryData(IntPtr q);
  [DllImport("pdh.dll", CharSet = CharSet.Unicode)] static extern uint PdhGetFormattedCounterArray(IntPtr c, uint fmt, ref uint size, out uint count, IntPtr buf);
  [StructLayout(LayoutKind.Explicit)] struct Item { [FieldOffset(0)] public IntPtr name; [FieldOffset(8)] public uint status; [FieldOffset(16)] public double value; }
  static IntPtr q;
  public static void Open() { PdhOpenQuery(null, IntPtr.Zero, out q); }
  public static IntPtr Add(string path) { IntPtr c; return PdhAddEnglishCounter(q, path, IntPtr.Zero, out c) == 0 ? c : IntPtr.Zero; }
  public static void Collect() { PdhCollectQueryData(q); }
  // Sum over instances whose name contains filter (null = all); -1 when unavailable.
  public static double Sum(IntPtr c, string filter) {
    if (c == IntPtr.Zero) return -1;
    uint size = 0, count = 0;
    PdhGetFormattedCounterArray(c, 0x200, ref size, out count, IntPtr.Zero);
    if (size == 0) return -1;
    IntPtr buf = Marshal.AllocHGlobal((int)size);
    try {
      if (PdhGetFormattedCounterArray(c, 0x200, ref size, out count, buf) != 0) return -1;
      double s = 0; int stride = Marshal.SizeOf(typeof(Item));
      for (int i = 0; i < count; i++) {
        Item it = (Item)Marshal.PtrToStructure(buf + i * stride, typeof(Item));
        if (filter == null || Marshal.PtrToStringUni(it.name).Contains(filter)) s += it.value;
      }
      return s;
    } finally { Marshal.FreeHGlobal(buf); }
  }
}
'@
[CtrlPdhLive]::Open()
$cGpu = [CtrlPdhLive]::Add('\GPU Engine(*)\Utilization Percentage')
$cMem = [CtrlPdhLive]::Add('\GPU Adapter Memory(*)\Dedicated Usage')
$cDisk = [CtrlPdhLive]::Add('\PhysicalDisk(*)\% Disk Time')
[CtrlPdhLive]::Collect()
function Get-NetTotals {
  $rx = 0; $tx = 0
  foreach ($n in [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
    if ($n.OperationalStatus -ne 'Up' -or $n.NetworkInterfaceType -eq 'Loopback') { continue }
    $s = $n.GetIPStatistics(); $rx += $s.BytesReceived; $tx += $s.BytesSent
  }
  @($rx, $tx)
}
$prevNet = Get-NetTotals; $prevAt = [DateTime]::UtcNow
$tempTick = 0; $temp = $null
while ($true) {
  Start-Sleep -Seconds 2
  [CtrlPdhLive]::Collect()
  $o = [ordered]@{ gpu = $null; gpuMem = $null; temp = $null; disk = $null; netDown = $null; netUp = $null }
  $g = [CtrlPdhLive]::Sum($cGpu, 'engtype_3D'); if ($g -ge 0) { $o.gpu = [math]::Min(100, [int]$g) }
  $m = [CtrlPdhLive]::Sum($cMem, $null); if ($m -ge 0) { $o.gpuMem = [int64]$m }
  $d = [CtrlPdhLive]::Sum($cDisk, '_Total'); if ($d -ge 0) { $o.disk = [math]::Min(100, [int]$d) }
  $net = Get-NetTotals; $now = [DateTime]::UtcNow; $dt = ($now - $prevAt).TotalSeconds
  if ($dt -gt 0) { $o.netDown = [int64](($net[0] - $prevNet[0]) / $dt); $o.netUp = [int64](($net[1] - $prevNet[1]) / $dt) }
  $prevNet = $net; $prevAt = $now
  if ($tempTick % 5 -eq 0) {
    try {
      $t = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | Select-Object -First 1
      $temp = if ($t) { [math]::Round($t.CurrentTemperature / 10 - 273.15, 1) } else { $null }
    } catch { $temp = $null }
  }
  $tempTick++
  $o.temp = $temp
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress))
}
`;

function getStatic() {
  return runJson(STATIC_SCRIPT, { timeout: 60000 });
}

function cpuTimes() {
  return os.cpus().map((c) => {
    const total = Object.values(c.times).reduce((a, b) => a + b, 0);
    return { idle: c.times.idle, total };
  });
}

let subscribers = 0;
let stopPs = null;
let timer = null;
let lastPs = {};
let prev = cpuTimes();

let liveSend = null;

function run() {
  prev = cpuTimes();
  stopPs = streamPowerShell(LIVE_SCRIPT, (line) => {
    try {
      lastPs = JSON.parse(line);
    } catch {}
  });
  timer = setInterval(() => {
    const now = cpuTimes();
    const perCore = now.map((c, i) => {
      const dt = c.total - prev[i].total;
      return dt > 0 ? Math.round(100 * (1 - (c.idle - prev[i].idle) / dt)) : 0;
    });
    prev = now;
    const cpu = Math.round(perCore.reduce((a, b) => a + b, 0) / perCore.length);
    const total = os.totalmem();
    liveSend({
      at: Date.now(),
      cpu,
      perCore,
      memUsed: total - os.freemem(),
      memTotal: total,
      uptime: os.uptime(),
      ...lastPs,
    });
  }, 1000);
}

function halt() {
  clearInterval(timer);
  timer = null;
  if (stopPs) stopPs();
  stopPs = null;
}

function startLive(send) {
  subscribers++;
  liveSend = send;
  if (!timer) run();
}

function stopLive(force = false) {
  subscribers = force ? 0 : Math.max(0, subscribers - 1);
  if (subscribers === 0) halt();
}

// While the window sits hidden in the tray nobody sees the numbers, so the stream stops
// and comes back for the screens that are still subscribed.
function pauseLive(paused) {
  if (paused) halt();
  else if (subscribers > 0 && !timer) run();
}

function topProcesses() {
  return runJson(
    "ConvertTo-Json -Compress -InputObject @(Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 12 @{n='name';e={$_.ProcessName}}, @{n='id';e={$_.Id}}, @{n='mem';e={$_.WorkingSet64}}, @{n='cpu';e={[math]::Round($_.CPU,1)}})",
  );
}

module.exports = { getStatic, startLive, stopLive, pauseLive, topProcesses };
