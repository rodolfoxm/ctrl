// Network tools: DNS benchmark, DNS provider switch (with exact revert) and a
// latency/jitter/packet-loss probe.
const { runJson, runPowerShell, q } = require('../ps.cjs');
const store = require('../store.cjs');

const PROVIDERS = [
  { id: 'cloudflare', name: 'Cloudflare', servers: ['1.1.1.1', '1.0.0.1'], note: 'Rápido e focado em privacidade.' },
  { id: 'google', name: 'Google', servers: ['8.8.8.8', '8.8.4.4'], note: 'Muito estável no mundo todo.' },
  { id: 'quad9', name: 'Quad9', servers: ['9.9.9.9', '149.112.112.112'], note: 'Bloqueia domínios maliciosos conhecidos.' },
  { id: 'opendns', name: 'OpenDNS', servers: ['208.67.222.222', '208.67.220.220'], note: 'Cisco, com filtros opcionais.' },
  { id: 'adguard', name: 'AdGuard', servers: ['94.140.14.14', '94.140.15.15'], note: 'Bloqueia anúncios e rastreadores.' },
  { id: 'cloudflare-family', name: 'Cloudflare Família', servers: ['1.1.1.3', '1.0.0.3'], note: 'Bloqueia malware e conteúdo adulto.' },
];

const BENCH_DOMAINS = ['google.com', 'youtube.com', 'microsoft.com', 'steampowered.com', 'discord.com', 'riotgames.com', 'epicgames.com', 'wikipedia.org'];

/** Resolves each domain against each server with Resolve-DnsName and times it. */
async function benchmark() {
  const targets = [...PROVIDERS.map((p) => ({ id: p.id, server: p.servers[0] }))];
  const script = String.raw`
$current = @(Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.ServerAddresses } | Select-Object -First 1 -ExpandProperty ServerAddresses)
$targets = @(${targets.map((t) => `@{ id = ${q(t.id)}; server = ${q(t.server)} }`).join(',')})
if ($current) { $targets += @{ id = 'current'; server = $current[0] } }
$domains = @(${BENCH_DOMAINS.map(q).join(',')})
$out = @()
foreach ($t in $targets) {
  $times = @(); $fails = 0
  foreach ($d in $domains) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    try { Resolve-DnsName -Name $d -Server $t.server -Type A -DnsOnly -NoHostsFile -QuickTimeout -ErrorAction Stop | Out-Null; $sw.Stop(); $times += $sw.Elapsed.TotalMilliseconds }
    catch { $fails++ }
  }
  $sorted = @($times | Sort-Object)
  $out += [pscustomobject]@{
    id = $t.id; server = $t.server; ok = $times.Count; fails = $fails
    avg = if ($times.Count) { [math]::Round(($times | Measure-Object -Average).Average, 1) } else { $null }
    median = if ($sorted.Count) { [math]::Round($sorted[[int][math]::Floor($sorted.Count / 2)], 1) } else { $null }
  }
}
ConvertTo-Json -InputObject @($out) -Compress`;
  const rows = await runJson(script, { timeout: 180000 });
  const results = rows.map((r) => {
    const p = PROVIDERS.find((x) => x.id === r.id);
    return { ...r, name: p ? p.name : 'DNS atual', current: r.id === 'current' };
  });
  results.sort((a, b) => (a.median ?? 1e9) - (b.median ?? 1e9));
  return { at: new Date().toISOString(), domains: BENCH_DOMAINS.length, results };
}

/** Current DNS per active interface plus what the app changed. */
async function state() {
  const rows = await runJson(String.raw`
ConvertTo-Json -Compress -InputObject @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object Status -eq 'Up' | ForEach-Object {
  $s = @(Get-DnsClientServerAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).ServerAddresses
  [pscustomobject]@{ alias = $_.Name; index = $_.ifIndex; servers = @($s) }
})`);
  return { interfaces: rows || [], changed: store.load().dns, providers: PROVIDERS };
}

async function setProvider(id) {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error('Provedor desconhecido.');
  const before = store.load().dns?.previous;
  const snapshot = before || (await runJson(String.raw`
ConvertTo-Json -Compress -InputObject @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object Status -eq 'Up' | ForEach-Object {
  $d = Get-ItemProperty ("HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\" + $_.InterfaceGuid) -ErrorAction SilentlyContinue
  [pscustomobject]@{ alias = $_.Name; static = [string]$d.NameServer }
})`));
  const res = await runPowerShell(String.raw`
Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ServerAddresses @(${p.servers.map(q).join(',')}) }
Clear-DnsClientCache`);
  if (!res.ok) throw new Error(res.stderr || 'Falha ao trocar o DNS.');
  store.update((s) => {
    s.dns = { provider: p.id, name: p.name, at: new Date().toISOString(), previous: snapshot };
  });
  store.log({ action: 'apply', id: `dns:${p.id}`, name: `DNS ${p.name}`, ok: true });
  return { ok: true };
}

/** Restores each interface's previous static servers, or DHCP when it had none. */
async function revertDns() {
  const prev = store.load().dns?.previous || [];
  const lines = prev.map((e) =>
    e.static
      ? `Set-DnsClientServerAddress -InterfaceAlias ${q(e.alias)} -ServerAddresses @(${e.static.split(/[,\s]+/).filter(Boolean).map(q).join(',')}) -ErrorAction SilentlyContinue`
      : `Set-DnsClientServerAddress -InterfaceAlias ${q(e.alias)} -ResetServerAddresses -ErrorAction SilentlyContinue`,
  );
  if (!lines.length) lines.push("Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ResetServerAddresses }");
  const res = await runPowerShell(`${lines.join('\n')}\nClear-DnsClientCache`);
  if (!res.ok) throw new Error(res.stderr || 'Falha ao restaurar o DNS.');
  store.update((s) => {
    s.dns = null;
  });
  store.log({ action: 'revert', id: 'dns', name: 'DNS restaurado', ok: true });
  return { ok: true };
}

/** Ping-based probe: average, p95, jitter (mean abs diff) and loss, per host. */
async function latency(hosts = ['1.1.1.1', '8.8.8.8'], count = 20) {
  const script = String.raw`
$out = @()
foreach ($h in @(${hosts.map(q).join(',')})) {
  $p = New-Object Net.NetworkInformation.Ping
  $rtts = @(); $lost = 0
  for ($i = 0; $i -lt ${count}; $i++) {
    try { $r = $p.Send($h, 1000); if ($r.Status -eq 'Success') { $rtts += [int]$r.RoundtripTime } else { $lost++ } } catch { $lost++ }
    Start-Sleep -Milliseconds 100
  }
  $jit = 0; for ($i = 1; $i -lt $rtts.Count; $i++) { $jit += [math]::Abs($rtts[$i] - $rtts[$i-1]) }
  $sorted = @($rtts | Sort-Object)
  $out += [pscustomobject]@{
    host = $h; sent = ${count}; lost = $lost; samples = $rtts
    avg = if ($rtts.Count) { [math]::Round(($rtts | Measure-Object -Average).Average, 1) } else { $null }
    min = if ($rtts.Count) { $sorted[0] } else { $null }
    p95 = if ($sorted.Count) { $sorted[[int][math]::Min($sorted.Count - 1, [math]::Ceiling($sorted.Count * 0.95) - 1)] } else { $null }
    jitter = if ($rtts.Count -gt 1) { [math]::Round($jit / ($rtts.Count - 1), 1) } else { $null }
  }
}
ConvertTo-Json -InputObject @($out) -Depth 3 -Compress`;
  return { at: new Date().toISOString(), results: await runJson(script, { timeout: 120000 }) };
}

module.exports = { PROVIDERS, benchmark, state, setProvider, revertDns, latency };
