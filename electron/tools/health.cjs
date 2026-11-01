// Hardware health: disk reliability counters, battery wear and boot time history.
const { runJson } = require('../ps.cjs');

async function disks() {
  return runJson(String.raw`
$out = @()
foreach ($d in @(Get-PhysicalDisk -ErrorAction SilentlyContinue)) {
  $rc = $null; try { $rc = $d | Get-StorageReliabilityCounter -ErrorAction Stop } catch {}
  $out += [pscustomobject]@{
    name = $d.FriendlyName; serial = ([string]$d.SerialNumber).Trim(); media = [string]$d.MediaType; bus = [string]$d.BusType
    size = [int64]$d.Size; health = [string]$d.HealthStatus; status = [string]($d.OperationalStatus -join ', ')
    firmware = $d.FirmwareVersion
    temperature = if ($rc -and $rc.Temperature) { [int]$rc.Temperature } else { $null }
    temperatureMax = if ($rc -and $rc.TemperatureMax) { [int]$rc.TemperatureMax } else { $null }
    wear = if ($rc -and $null -ne $rc.Wear) { [int]$rc.Wear } else { $null }
    powerOnHours = if ($rc -and $rc.PowerOnHours) { [int64]$rc.PowerOnHours } else { $null }
    readErrors = if ($rc) { [int64]$rc.ReadErrorsTotal } else { $null }
    writeErrors = if ($rc) { [int64]$rc.WriteErrorsTotal } else { $null }
    startStop = if ($rc -and $rc.StartStopCycleCount) { [int64]$rc.StartStopCycleCount } else { $null }
    countersAvailable = [bool]$rc
  }
}
ConvertTo-Json -InputObject @($out) -Compress`, { timeout: 60000 });
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
