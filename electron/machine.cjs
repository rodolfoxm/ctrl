// Machine profile used to gate the catalog ("Your Machine"): GPU/CPU vendor,
// chassis, Windows version, RAM, Wi-Fi and storage. Cached for the session.
const { runJson } = require('./ps.cjs');

const SCRIPT = String.raw`
$cs = Get-CimInstance Win32_ComputerSystem
$os = Get-CimInstance Win32_OperatingSystem
$cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1)
$gpus = @(Get-CimInstance Win32_VideoController | ForEach-Object { [pscustomobject]@{ name = $_.Name; refresh = $_.CurrentRefreshRate } })
$chassis = @((Get-CimInstance Win32_SystemEnclosure).ChassisTypes)
$battery = @(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue).Count -gt 0
$adapters = @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ name = $_.Name; desc = $_.InterfaceDescription; media = [string]$_.NdisPhysicalMedium; up = $_.Status -eq 'Up'; speed = $_.LinkSpeed } })
$disks = @(Get-PhysicalDisk -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ name = $_.FriendlyName; media = [string]$_.MediaType; bus = [string]$_.BusType } })
$defender = $false
if ((Get-Service WinDefend -ErrorAction SilentlyContinue).Status -eq 'Running') {
  $defender = $true
  try { $mode = (Get-MpComputerStatus -ErrorAction Stop).AMRunningMode; if ($mode -and $mode -ne 'Normal') { $defender = $false } } catch {}
}
[pscustomobject]@{
  build = [int]$os.BuildNumber; osName = $os.Caption
  cpuName = $cpu.Name.Trim(); cpuMaker = $cpu.Manufacturer; cores = $cpu.NumberOfCores; threads = $cpu.NumberOfLogicalProcessors
  gpus = $gpus; chassis = $chassis; battery = $battery
  ramBytes = [int64]$cs.TotalPhysicalMemory; manufacturer = $cs.Manufacturer; model = $cs.Model
  adapters = $adapters; disks = $disks; defender = $defender
} | ConvertTo-Json -Depth 4 -Compress
`;

const LAPTOP_CHASSIS = new Set([8, 9, 10, 11, 12, 14, 18, 21, 30, 31, 32]);

let cached = null;

function vendorOf(name = '') {
  const n = name.toLowerCase();
  if (/nvidia|geforce|quadro|rtx|gtx/.test(n)) return 'nvidia';
  if (/amd|radeon|ati /.test(n)) return 'amd';
  if (/intel|arc|iris|uhd/.test(n)) return 'intel';
  return 'other';
}

async function get(force = false) {
  if (cached && !force) return cached;
  const raw = await runJson(SCRIPT, { timeout: 60000 });
  const gpus = (raw.gpus || []).filter((g) => !/basic display|remote|virtual|parsec|meta/i.test(g.name));
  const adapters = raw.adapters || [];
  const laptop = raw.battery || (raw.chassis || []).some((c) => LAPTOP_CHASSIS.has(c));
  cached = {
    osName: raw.osName,
    build: raw.build,
    win11: raw.build >= 22000,
    cpuName: raw.cpuName,
    cpuVendor: /amd/i.test(raw.cpuMaker) ? 'amd' : /intel/i.test(raw.cpuMaker) ? 'intel' : 'other',
    cores: raw.cores,
    threads: raw.threads,
    // Intel 12th gen+ / Core Ultra mix P- and E-cores (threads < 2 x cores is the tell).
    hybrid: /intel/i.test(raw.cpuMaker) && raw.threads < raw.cores * 2,
    defender: !!raw.defender,
    gpus: gpus.map((g) => ({ name: g.name, vendor: vendorOf(g.name), refresh: g.refresh })),
    gpuVendors: [...new Set(gpus.map((g) => vendorOf(g.name)))],
    refresh: Math.max(0, ...gpus.map((g) => g.refresh || 0)),
    laptop,
    battery: !!raw.battery,
    ramGb: Math.round(raw.ramBytes / 1024 ** 3),
    manufacturer: raw.manufacturer,
    model: raw.model,
    wifi: adapters.some((a) => /802\.11|native 802|wireless|wi-?fi/i.test(`${a.media} ${a.desc}`)),
    ethernet: adapters.some((a) => /802\.3/.test(a.media) || /ethernet|gbe|realtek pcie/i.test(a.desc)),
    activeLink: adapters.find((a) => a.up) || null,
    ssd: (raw.disks || []).some((d) => /ssd|nvme/i.test(`${d.media} ${d.bus}`)),
    disks: raw.disks || [],
  };
  return cached;
}

function peek() {
  return cached;
}

module.exports = { get, peek };
