// Hardware health: disk reliability counters, battery wear and boot time history.
const { runJson } = require('../ps.cjs');

// Windows' reliability counters aren't enough: on many NVMe drives they report Wear 0 and no hours, on
// HDDs Wear is meaningless, and TemperatureMax is the drive's limit, not a recorded maximum. So wear,
// hours and media errors come from the drive itself: the NVMe health log or the ATA SMART attributes.
const NVME_LOG = String.raw`
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class CtrlNvme {
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr sa, uint mode, uint flags, IntPtr template);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool DeviceIoControl(SafeFileHandle h, uint code, byte[] inBuf, int inLen, byte[] outBuf, int outLen, out int ret, IntPtr ov);
  public static byte[] HealthLog(int disk) {
    using (var h = CreateFile(@"\\.\PhysicalDrive" + disk, 0xC0000000, 3, IntPtr.Zero, 3, 0, IntPtr.Zero)) {
      if (h.IsInvalid) return null;
      // STORAGE_PROPERTY_QUERY + STORAGE_PROTOCOL_SPECIFIC_DATA + the 512-byte log.
      var b = new byte[8 + 40 + 512];
      BitConverter.GetBytes(50).CopyTo(b, 0);  // StorageDeviceProtocolSpecificProperty
      BitConverter.GetBytes(3).CopyTo(b, 8);   // ProtocolTypeNvme
      BitConverter.GetBytes(2).CopyTo(b, 12);  // NVMeDataTypeLogPage
      BitConverter.GetBytes(2).CopyTo(b, 16);  // log 02h: SMART / health
      BitConverter.GetBytes(40).CopyTo(b, 24); // ProtocolDataOffset
      BitConverter.GetBytes(512).CopyTo(b, 28);
      int ret;
      if (!DeviceIoControl(h, 0x2D1400, b, b.Length, b, b.Length, out ret, IntPtr.Zero)) return null; // IOCTL_STORAGE_QUERY_PROPERTY
      var log = new byte[512];
      Array.Copy(b, 48, log, 0, 512);
      return log;
    }
  }
}`;

// Normalized "life left" attributes, in the order vendors use them: WD/SanDisk, Kingston and others, Intel, Samsung, Crucial.
const LIFE_ATTRS = [169, 231, 233, 177, 202];

const DISKS_SCRIPT = String.raw`
Add-Type -TypeDefinition @'
${NVME_LOG}
'@
# ATA SMART by disk number. WMI only names the device, so Win32_DiskDrive links it to the disk.
$smart = @{}; $predict = @{}
try {
  $index = @{}
  foreach ($w in @(Get-CimInstance Win32_DiskDrive)) { if ($w.PNPDeviceID) { $index[([string]$w.PNPDeviceID).ToUpper() + '_0'] = [string]$w.Index } }
  foreach ($p in @(Get-CimInstance -Namespace root\wmi -ClassName MSStorageDriver_FailurePredictStatus -ErrorAction Stop)) {
    $n = $index[([string]$p.InstanceName).ToUpper()]; if ($n) { $predict[$n] = [bool]$p.PredictFailure }
  }
  foreach ($s in @(Get-CimInstance -Namespace root\wmi -ClassName MSStorageDriver_ATAPISmartData -ErrorAction Stop)) {
    $n = $index[([string]$s.InstanceName).ToUpper()]; if (-not $n) { continue }
    $v = [byte[]]$s.VendorSpecific; $attrs = @{}
    for ($i = 2; $i -lt 362; $i += 12) {
      if ($v[$i] -ne 0) { $attrs[[int]$v[$i]] = @{ cur = [int]$v[$i + 3]; raw = [int][BitConverter]::ToUInt16($v, $i + 5) } }
    }
    $smart[$n] = $attrs
  }
} catch {}

$out = @()
foreach ($d in @(Get-PhysicalDisk -ErrorAction SilentlyContinue)) {
  $rc = $null; try { $rc = $d | Get-StorageReliabilityCounter -ErrorAction Stop } catch {}
  $id = [string]$d.DeviceId; $hdd = [string]$d.MediaType -eq 'HDD'
  $temp = if ($rc -and $rc.Temperature) { [int]$rc.Temperature } else { $null }
  $hours = if ($rc -and $rc.PowerOnHours) { [int64]$rc.PowerOnHours } else { $null }
  $cycles = if ($rc -and $rc.StartStopCycleCount) { [int64]$rc.StartStopCycleCount } else { $null }
  $wear = $null; $mediaErrors = $null; $warn = $false; $log = $null

  if ([string]$d.BusType -eq 'NVMe') {
    try { $log = [CtrlNvme]::HealthLog([int]$id) } catch {}
    if ($log -and [BitConverter]::ToUInt16($log, 1) -gt 0) {
      $temp = [BitConverter]::ToUInt16($log, 1) - 273
      $wear = [int]$log[5]
      $cycles = [int64][BitConverter]::ToUInt64($log, 112)
      $hours = [int64][BitConverter]::ToUInt64($log, 128)
      $mediaErrors = [int64][BitConverter]::ToUInt64($log, 160)
      $warn = $log[0] -ne 0 -or $log[3] -lt $log[4]
    } else { $log = $null }
  }
  $attrs = $smart[$id]
  if ($attrs) {
    $mediaErrors = 0; foreach ($a in 5, 197, 198) { if ($attrs[$a]) { $mediaErrors += $attrs[$a].raw } }
    if (-not $cycles -and $attrs[12]) { $cycles = [int64]$attrs[12].raw }
    if (-not $hdd) { foreach ($a in ${LIFE_ATTRS.join(', ')}) { if ($attrs[$a]) { $wear = 100 - $attrs[$a].cur; break } } }
  }
  # Wear 0 is what Windows answers when it doesn't know, so only a real reading counts.
  if ($null -eq $wear -and -not $hdd -and $rc -and $rc.Wear) { $wear = [int]$rc.Wear }

  $health = [string]$d.HealthStatus
  if ($health -eq 'Healthy') {
    if ($predict[$id]) { $health = 'Unhealthy' }
    elseif ($warn -or $mediaErrors -gt 0 -or $wear -ge 90) { $health = 'Warning' }
  }
  $out += [pscustomobject]@{
    name = $d.FriendlyName; serial = ([string]$d.SerialNumber).Trim(); media = [string]$d.MediaType; bus = [string]$d.BusType
    size = [int64]$d.Size; health = $health; status = [string]($d.OperationalStatus -join ', ')
    firmware = $d.FirmwareVersion; temperature = $temp; wear = $wear; powerOnHours = $hours
    mediaErrors = $mediaErrors; startStop = $cycles
    countersAvailable = [bool]($rc -or $log -or $attrs)
  }
}
ConvertTo-Json -InputObject @($out) -Compress`;

async function disks() {
  return runJson(DISKS_SCRIPT, { timeout: 60000 });
}

async function battery() {
  return runJson(String.raw`
$b = @(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue)
if (-not $b.Count) { '{"present":false}'; return }
$f = Join-Path $env:TEMP ("ctrl-battery-" + [guid]::NewGuid().ToString('N') + '.xml')
powercfg /batteryreport /xml /output $f | Out-Null
$items = @()
if (Test-Path $f) {
  [xml]$x = Get-Content -LiteralPath $f -Raw
  Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue
  foreach ($bat in @($x.BatteryReport.Batteries.Battery)) {
    $items += [pscustomobject]@{ name = $bat.Id; maker = $bat.Manufacturer; chemistry = $bat.Chemistry; design = [int64]$bat.DesignCapacity; full = [int64]$bat.FullChargeCapacity; cycles = if ($bat.CycleCount) { [int]$bat.CycleCount } else { $null } }
  }
}
[pscustomobject]@{
  present = $true
  charge = [int]$b[0].EstimatedChargeRemaining
  status = [int]$b[0].BatteryStatus
  runtimeMin = if ($b[0].EstimatedRunTime -and $b[0].EstimatedRunTime -lt 71582788) { [int]$b[0].EstimatedRunTime } else { $null }
  batteries = $items
} | ConvertTo-Json -Depth 4 -Compress`, { timeout: 60000 });
}

async function bootTimes() {
  return runJson(String.raw`
$os = Get-CimInstance Win32_OperatingSystem
$events = @()
$err = $null
try {
  $events = @(Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-Diagnostics-Performance/Operational'; Id = 100 } -MaxEvents 40 -ErrorAction Stop | ForEach-Object {
    $d = @{}; foreach ($n in ([xml]$_.ToXml()).Event.EventData.Data) { $d[$n.Name] = $n.'#text' }
    [pscustomobject]@{ at = $_.TimeCreated.ToString('o'); total = [int]$d.BootTime; main = [int]$d.MainPathBootTime; post = [int]$d.BootPostBootTime }
  })
} catch { $err = $_.Exception.Message }
[pscustomobject]@{ lastBoot = $os.LastBootUpTime.ToString('o'); events = @($events); error = $err } | ConvertTo-Json -Depth 4 -Compress`, { timeout: 60000 });
}

module.exports = { disks, battery, bootTimes };
