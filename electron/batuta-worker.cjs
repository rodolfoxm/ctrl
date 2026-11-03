// The Core engine's PowerShell worker (see batuta.cjs): rules, game auto-detection, watchdog, background
// containment and the standby-list cleaner, every 2 s, until a line arrives on stdin.
const { q } = require('./ps.cjs');
const NATIVE = require('./batuta-native.cjs');
const { GAMES } = require('./batuta-presets.cjs');

const exeKey = (exe) => String(exe).trim().replace(/.exe$/i, '').toLowerCase();

// Never contained, whatever the CPU load: the shell, audio, input and Windows' own core processes.
const PROTECTED = ['system', 'idle', 'registry', 'smss', 'csrss', 'wininit', 'winlogon', 'services', 'lsass', 'dwm', 'audiodg',
  'fontdrvhost', 'explorer', 'ctrl', 'powershell', 'conhost', 'searchhost', 'startmenuexperiencehost', 'shellexperiencehost', 'textinputhost'];

// Executables that live inside game folders but are not the game.
const NOT_GAME = 'crash|report|launcher|anticheat|easyanticheat|eac|beservice|battleye|vanguard|setup|redist|unins|dxsetup|helper|updater|prereq|ue4prereq|steamerrorreporter';
// Apps Steam distributes next to the games (same steamapps\common folder) that are not games.
const NOT_GAME_DIR = String.raw`\\(driver booster for steam|soundpad|wallpaper_engine|steamvr|steamworks shared|steam controller configs|lossless scaling|obs studio|aseprite|blender|rpg maker[^\\]*|vtube studio|voicemod[^\\]*|fpsmonitor|msi afterburner)\\`;

function workerScript(cfg, { gameDirs = [], libraryExes = [], presets = Object.fromEntries(GAMES.map((g) => [exeKey(g.exe), g.cores])) } = {}) {
  const json = JSON.stringify({
    rules: cfg.rules.map((r) => ({ ...r, key: exeKey(r.exe) })),
    containment: cfg.containment,
    memory: cfg.memory,
    protected: PROTECTED,
    auto: cfg.autoDetect,
    gameDirs,
    libraryExes: libraryExes.map((e) => e.toLowerCase()),
    presets,
    notGame: NOT_GAME,
    notGameDir: NOT_GAME_DIR,
    watchdog: cfg.watchdog.filter((w) => w.exe && w.threshold > 0).map((w) => ({ ...w, key: exeKey(w.exe) })),
  });
  return String.raw`
Add-Type -TypeDefinition @'
${NATIVE}
'@
$cfg = ${q(json)} | ConvertFrom-Json
function Emit($o) { [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress -Depth 4)); [Console]::Out.Flush() }
$PRIO = @{ idle = 'Idle'; below = 'BelowNormal'; normal = 'Normal'; above = 'AboveNormal'; high = 'High' }
$IO = @{ low = 1; normal = 2 }
$GPU = @{ low = 1; normal = 2; above = 3; high = 4 }
$EFF = @{ never = 1; always = 2 }
$masks = [BatutaNative]::CoreMasks(); $pMask = $masks[0]; $eMask = $masks[1]
$ncpu = [Environment]::ProcessorCount
$rules = @{}; foreach ($r in $cfg.rules) { $rules[$r.key] = $r }
$skip = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($n in @($cfg.protected) + @($cfg.containment.exclusions) + @($cfg.rules | ForEach-Object { $_.key })) { if ($n) { [void]$skip.Add((([string]$n).ToLower() -replace '\.exe$', '')) } }
$memSkip = @($cfg.memory.exclusions | ForEach-Object { ([string]$_).ToLower() -replace '\.exe$', '' })
$presets = @{}; foreach ($k in $cfg.presets.PSObject.Properties) { $presets[$k.Name] = $k.Value }
$libExes = New-Object 'System.Collections.Generic.HashSet[string]'; foreach ($e in @($cfg.libraryExes)) { if ($e) { [void]$libExes.Add($e) } }
$gameDirs = @($cfg.gameDirs)
$wd = @{}; foreach ($w in @($cfg.watchdog)) { $wd[$w.key] = $w }
$auto = @{}; $wdState = @{}
# A game is a process from a game folder or the ctrl library, or one the assistant knows by name. The path is
# asked once per process (QueryFullProcessImageName, no memory read) and the verdict is cached by pid.
function AutoRule($p) {
  if ($auto.ContainsKey($p.Id)) { return $auto[$p.Id] }
  $verdict = $false
  $name = $p.ProcessName.ToLower()
  if ($cfg.auto.enabled -and $p.SessionId -ne 0 -and $name -notmatch $cfg.notGame) {
    $path = $null; try { $path = $p.Path } catch {}
    $isGame = $presets.ContainsKey($name)
    if (-not $isGame -and $path) {
      $lp = $path.ToLower()
      $isGame = ($lp -notmatch $cfg.notGameDir) -and ($libExes.Contains($lp) -or @($gameDirs | Where-Object { $lp.StartsWith($_) }).Count -gt 0)
    }
    if ($isGame) {
      $cores = if ($presets.ContainsKey($name)) { $presets[$name] } else { 'all' }
      $verdict = [pscustomobject]@{ priority = $cfg.auto.priority; gpu = $cfg.auto.gpu; efficiency = $cfg.auto.efficiency; io = 'normal'; cores = $cores; game = $true; auto = $true }
      Emit @{ type = 'detected'; pid = $p.Id; name = $p.ProcessName; path = $path }
    }
  }
  $auto[$p.Id] = $verdict
  return $verdict
}
$self = $PID
Emit @{ type = 'ready'; pMask = $pMask; eMask = $eMask; hybrid = ($eMask -ne 0); cpus = $ncpu }
# Any line on stdin (or stdin closing because ctrl died) ends the loop and restores what was contained.
# The raw stream's ReadAsync runs on the thread pool; Console.In.ReadLineAsync would block here.
$stdin = [Console]::OpenStandardInput(); $buf = New-Object byte[] 64; $stop = $stdin.ReadAsync($buf, 0, 64)
$prev = @{}; $prevAt = Get-Date; $once = @{}; $over = @{}; $held = @{}; $lastPurge = [datetime]::MinValue
while (-not $stop.IsCompleted) {
  $now = Get-Date; $dt = [math]::Max(0.5, ($now - $prevAt).TotalSeconds); $prevAt = $now
  $fg = [BatutaNative]::ForegroundPid()
  $procs = @(Get-Process); $byId = @{}; $use = @{}; $next = @{}; $total = 0.0
  foreach ($p in $procs) {
    $byId[$p.Id] = $p
    try { $t = $p.TotalProcessorTime.TotalSeconds } catch { continue }
    if ($prev.ContainsKey($p.Id)) { $u = ($t - $prev[$p.Id]) / ($dt * $ncpu) * 100; $use[$p.Id] = $u; $total += $u }
    $next[$p.Id] = $t
  }
  $prev = $next
  $gaming = $false; $managed = @()
  foreach ($p in $procs) {
    $r = $rules[$p.ProcessName.ToLower()]
    if (-not $r) { $r = AutoRule $p }
    if (-not $r) { continue }
    if ($r.game) { $gaming = $true }
    $acts = @()
    try {
      if ($r.priority -and $PRIO[$r.priority] -and "$($p.PriorityClass)" -ne $PRIO[$r.priority]) { $p.PriorityClass = $PRIO[$r.priority]; $acts += 'prioridade' }
      $mask = if ($r.cores -eq 'p' -and $eMask) { $pMask } elseif ($r.cores -eq 'e' -and $eMask) { $eMask } else { 0 }
      if ($mask -and [int64]$p.ProcessorAffinity -ne $mask) { $p.ProcessorAffinity = [IntPtr]$mask; $acts += 'núcleos' }
    } catch { if (-not $once.ContainsKey("deny$($p.Id)")) { $once["deny$($p.Id)"] = 1; Emit @{ type = 'denied'; pid = $p.Id; name = $p.ProcessName } } }
    if (-not $once.ContainsKey($p.Id)) {
      $once[$p.Id] = 1
      if ($IO[$r.io] -and [BatutaNative]::IoPriority($p.Id, $IO[$r.io])) { $acts += 'E/S' }
      if ($GPU[$r.gpu] -and [BatutaNative]::GpuPriority($p.Id, $GPU[$r.gpu])) { $acts += 'GPU' }
      if ($EFF[$r.efficiency] -and [BatutaNative]::Efficiency($p.Id, $EFF[$r.efficiency])) { $acts += 'eficiência' }
    }
    if ($acts.Count) { Emit @{ type = 'rule'; pid = $p.Id; name = $p.ProcessName; actions = $acts } }
    $managed += @{ pid = $p.Id; name = $p.ProcessName; auto = [bool]$r.auto; game = [bool]$r.game }
  }
  # Watchdog: CPU or RAM above the limit for N seconds -> one reversible action; calm for N seconds -> undone.
  foreach ($p in $procs) {
    $w = $wd[$p.ProcessName.ToLower()]
    if (-not $w) { continue }
    $id = $p.Id
    if (-not $wdState.ContainsKey($id)) { $wdState[$id] = @{ over = $null; calm = $null; acted = $false; prio = $null; aff = $null } }
    $s = $wdState[$id]
    $val = if ($w.metric -eq 'ram') { [math]::Round($p.WorkingSet64 / 1MB) } else { [math]::Round([double]$use[$id], 1) }
    if ($val -ge $w.threshold) {
      $s.calm = $null
      if (-not $s.over) { $s.over = $now }
      elseif (-not $s.acted -and ($now - $s.over).TotalSeconds -ge $w.seconds) {
        try {
          if ($w.action -eq 'below' -or $w.action -eq 'idle') { $s.prio = "$($p.PriorityClass)"; $p.PriorityClass = $(if ($w.action -eq 'idle') { 'Idle' } else { 'BelowNormal' }) }
          elseif ($w.action -eq 'ecores' -and $eMask) { $s.aff = [int64]$p.ProcessorAffinity; $p.ProcessorAffinity = [IntPtr]$eMask }
          $s.acted = $true
          Emit @{ type = 'watchdog'; pid = $id; name = $p.ProcessName; action = $w.action; metric = $w.metric; value = $val }
        } catch {}
      }
    } else {
      $s.over = $null
      if ($s.acted) {
        if (-not $s.calm) { $s.calm = $now }
        elseif (($now - $s.calm).TotalSeconds -ge $w.seconds) {
          try { if ($s.prio) { $p.PriorityClass = $s.prio }; if ($s.aff) { $p.ProcessorAffinity = [IntPtr]$s.aff } } catch {}
          $s.acted = $false; $s.prio = $null; $s.aff = $null
          Emit @{ type = 'watchdog-release'; pid = $id; name = $p.ProcessName }
        }
      }
    }
  }
  foreach ($id in @($wdState.Keys)) { if (-not $byId[$id]) { $wdState.Remove($id) } }
  foreach ($id in @($auto.Keys)) { if (-not $byId[$id]) { $auto.Remove($id) } }
  $c = $cfg.containment
  if ($c.enabled -and $total -ge $c.total) {
    foreach ($p in $procs) {
      $id = $p.Id; $u = $use[$id]
      if ($null -eq $u -or $id -eq $fg -or $id -eq $self -or $p.SessionId -eq 0 -or $held.ContainsKey($id) -or $auto[$id] -or $wd[$p.ProcessName.ToLower()] -or $skip.Contains($p.ProcessName.ToLower())) { $over.Remove($id); continue }
      if ($u -lt $c.proc) { $over.Remove($id); continue }
      if (-not $over.ContainsKey($id)) { $over[$id] = $now; continue }
      if (($now - $over[$id]).TotalMilliseconds -lt $c.overMs) { continue }
      $over.Remove($id)
      try { if ("$($p.PriorityClass)" -eq 'Normal') { $p.PriorityClass = 'BelowNormal'; $held[$id] = @{ since = $now; name = $p.ProcessName }; Emit @{ type = 'contain'; pid = $id; name = $p.ProcessName; cpu = [math]::Round($u, 1) } } } catch {}
    }
  } else { $over.Clear() }
  foreach ($id in @($held.Keys)) {
    $h = $held[$id]; $p = $byId[$id]
    if (-not $p) { $held.Remove($id); continue }
    if ((($use[$id] -lt $c.restore) -or $id -eq $fg -or -not $c.enabled) -and ($now - $h.since).TotalMilliseconds -ge $c.minMs) {
      try { $p.PriorityClass = 'Normal' } catch {}
      $held.Remove($id); Emit @{ type = 'release'; pid = $id; name = $h.name }
    }
  }
  $m = $cfg.memory; $standby = -1; $free = -1
  $ml = [BatutaNative]::MemoryList()
  if ($ml[0] -ge 0) { $standby = [math]::Round($ml[0] * 4096 / 1MB); $free = [math]::Round($ml[1] * 4096 / 1MB) }
  if ($m.enabled -and $standby -ge 0 -and ($gaming -or -not $m.onlyGaming) -and $standby -ge $m.listMB -and $free -lt $m.freeMB -and ($now - $lastPurge).TotalSeconds -ge 10) {
    $blocked = $procs | Where-Object { $memSkip -contains $_.ProcessName.ToLower() } | Select-Object -First 1
    if (-not $blocked -and [BatutaNative]::PurgeStandby()) {
      $lastPurge = $now; $after = [BatutaNative]::MemoryList()
      Emit @{ type = 'purge'; before = $standby; after = [math]::Round($after[0] * 4096 / 1MB); free = $free }
    }
  }
  Emit @{ type = 'status'; cpu = [math]::Round($total, 1); standby = $standby; free = $free; idleMs = [BatutaNative]::IdleMs(); gaming = $gaming; managed = $managed; held = @($held.Keys | ForEach-Object { @{ pid = $_; name = $held[$_].name } }) }
  for ($i = 0; $i -lt 20 -and -not $stop.IsCompleted; $i++) { Start-Sleep -Milliseconds 100 }
}
foreach ($id in @($held.Keys)) { try { $byId[$id].PriorityClass = 'Normal' } catch {} }
foreach ($id in @($wdState.Keys)) {
  $s = $wdState[$id]
  if ($s.acted) { try { if ($s.prio) { $byId[$id].PriorityClass = $s.prio }; if ($s.aff) { $byId[$id].ProcessorAffinity = [IntPtr]$s.aff } } catch {} }
}
Emit @{ type = 'stopped' }
`;
}

module.exports = { workerScript, exeKey, NOT_GAME, NOT_GAME_DIR, PROTECTED };
