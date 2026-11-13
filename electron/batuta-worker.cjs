// The Core engine's PowerShell worker (see batuta.cjs): rules, game auto-detection, watchdog, background
// containment and the standby-list cleaner, every 2 s (5 s while a game runs), until a line arrives on stdin.
// It must cost the game nothing: one system call per pass for the process list, below-normal priority and
// EcoQoS for itself, and no handle with more than query-limited or set-information rights.
const { q } = require('./ps.cjs');
const NATIVE = require('./batuta-native.cjs');
const { GAMES } = require('./batuta-presets.cjs');

const exeKey = (exe) => String(exe).trim().replace(/.exe$/i, '').toLowerCase();

// Never contained, whatever the CPU load: the shell, audio, input and Windows' own core processes.
const PROTECTED = ['system', 'idle', 'registry', 'smss', 'csrss', 'wininit', 'winlogon', 'services', 'lsass', 'dwm', 'audiodg',
  'fontdrvhost', 'explorer', 'ctrl', 'powershell', 'conhost', 'searchhost', 'startmenuexperiencehost', 'shellexperiencehost', 'textinputhost'];

// Executables that live inside game folders but are not the game.
const NOT_GAME = 'overlay|crash|report|launcher|anticheat|easyanticheat|eac|beservice|battleye|vanguard|setup|redist|unins|dxsetup|helper|updater|prereq|ue4prereq|steamerrorreporter';
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
# Win32 priority classes.
$PRIO = @{ idle = 0x40; below = 0x4000; normal = 0x20; above = 0x8000; high = 0x80 }
$NORMAL = 0x20
# Out of the game's way: the worker yields to normal-priority threads and asks Windows for efficiency mode.
try { [Diagnostics.Process]::GetCurrentProcess().PriorityClass = 'BelowNormal' } catch {}
[void][BatutaNative]::Efficiency($PID, 2)
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
  $name = $p.Key
  if ($cfg.auto.enabled -and $p.Session -ne 0 -and $name -notmatch $cfg.notGame) {
    $path = [BatutaNative]::ImagePath($p.Id)
    $isGame = $presets.ContainsKey($name)
    if (-not $isGame -and $path) {
      $lp = $path.ToLower()
      $isGame = ($lp -notmatch $cfg.notGameDir) -and ($libExes.Contains($lp) -or @($gameDirs | Where-Object { $lp.StartsWith($_) }).Count -gt 0)
    }
    if ($isGame) {
      $cores = if ($presets.ContainsKey($name)) { $presets[$name] } else { 'all' }
      $verdict = [pscustomobject]@{ priority = $cfg.auto.priority; gpu = $cfg.auto.gpu; efficiency = $cfg.auto.efficiency; io = 'normal'; cores = $cores; game = $true; auto = $true }
      Emit @{ type = 'detected'; pid = $p.Id; name = $p.Name; path = $path }
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
  $procs = [BatutaNative]::Snapshot(); $byId = @{}; $use = @{}; $next = @{}; $total = 0.0
  foreach ($p in $procs) {
    $byId[$p.Id] = $p
    $t = $p.Cpu / 1e7
    if ($prev.ContainsKey($p.Id)) { $u = ($t - $prev[$p.Id]) / ($dt * $ncpu) * 100; $use[$p.Id] = $u; $total += $u }
    $next[$p.Id] = $t
  }
  $prev = $next
  $gaming = $false; $managed = @()
  foreach ($p in $procs) {
    $r = $rules[$p.Key]
    if (-not $r) { $r = AutoRule $p }
    if (-not $r) { continue }
    if ($r.game) { $gaming = $true }
    $acts = @()
    $denied = $false
    $want = $PRIO[[string]$r.priority]
    if ($want) {
      $cur = [BatutaNative]::Priority($p.Id)
      if ($cur -eq 0) { $denied = $true }
      elseif ($cur -ne $want) { if ([BatutaNative]::SetPriority($p.Id, $want)) { $acts += 'prioridade' } else { $denied = $true } }
    }
    $mask = if ($r.cores -eq 'p' -and $eMask) { $pMask } elseif ($r.cores -eq 'e' -and $eMask) { $eMask } else { 0 }
    if ($mask -and -not $denied) {
      $aff = [BatutaNative]::Affinity($p.Id)
      if ($aff -eq -1) { $denied = $true }
      elseif ($aff -ne $mask) { if ([BatutaNative]::SetAffinity($p.Id, $mask)) { $acts += 'núcleos' } else { $denied = $true } }
    }
    if ($denied -and -not $once.ContainsKey("deny$($p.Id)")) { $once["deny$($p.Id)"] = 1; Emit @{ type = 'denied'; pid = $p.Id; name = $p.Name } }
    # Set once per process, but a game that is still starting (or briefly protected) can refuse: what failed is
    # tried again on the next passes, up to 5 times.
    if (-not $once.ContainsKey($p.Id)) { $once[$p.Id] = @{ tries = 0; io = -not $IO[$r.io]; gpu = -not $GPU[$r.gpu]; eff = -not $EFF[$r.efficiency] } }
    $o = $once[$p.Id]
    if ($o -is [hashtable] -and $o.tries -lt 5 -and -not ($o.io -and $o.gpu -and $o.eff)) {
      $o.tries++
      if (-not $o.io -and [BatutaNative]::IoPriority($p.Id, $IO[$r.io])) { $o.io = $true; $acts += 'E/S' }
      if (-not $o.gpu -and [BatutaNative]::GpuPriority($p.Id, $GPU[$r.gpu])) { $o.gpu = $true; $acts += 'GPU' }
      if (-not $o.eff -and [BatutaNative]::Efficiency($p.Id, $EFF[$r.efficiency])) { $o.eff = $true; $acts += 'eficiência' }
    }
    if ($acts.Count) { Emit @{ type = 'rule'; pid = $p.Id; name = $p.Name; actions = $acts } }
    $managed += @{ pid = $p.Id; name = $p.Name; auto = [bool]$r.auto; game = [bool]$r.game }
  }
  # Watchdog: CPU or RAM above the limit for N seconds -> one reversible action; calm for N seconds -> undone.
  foreach ($p in $procs) {
    $w = $wd[$p.Key]
    if (-not $w) { continue }
    $id = $p.Id
    if (-not $wdState.ContainsKey($id)) { $wdState[$id] = @{ over = $null; calm = $null; acted = $false; prio = $null; aff = $null } }
    $s = $wdState[$id]
    $val = if ($w.metric -eq 'ram') { [math]::Round($p.WorkingSet / 1MB) } else { [math]::Round([double]$use[$id], 1) }
    if ($val -ge $w.threshold) {
      $s.calm = $null
      if (-not $s.over) { $s.over = $now }
      elseif (-not $s.acted -and ($now - $s.over).TotalSeconds -ge $w.seconds) {
        if ($w.action -eq 'below' -or $w.action -eq 'idle') { $s.prio = [BatutaNative]::Priority($id); [void][BatutaNative]::SetPriority($id, $PRIO[$(if ($w.action -eq 'idle') { 'idle' } else { 'below' })]) }
        elseif ($w.action -eq 'ecores' -and $eMask) { $s.aff = [BatutaNative]::Affinity($id); [void][BatutaNative]::SetAffinity($id, $eMask) }
        $s.acted = $true
        Emit @{ type = 'watchdog'; pid = $id; name = $p.Name; action = $w.action; metric = $w.metric; value = $val }
      }
    } else {
      $s.over = $null
      if ($s.acted) {
        if (-not $s.calm) { $s.calm = $now }
        elseif (($now - $s.calm).TotalSeconds -ge $w.seconds) {
          if ($s.prio) { [void][BatutaNative]::SetPriority($id, $s.prio) }; if ($s.aff -gt 0) { [void][BatutaNative]::SetAffinity($id, $s.aff) }
          $s.acted = $false; $s.prio = $null; $s.aff = $null
          Emit @{ type = 'watchdog-release'; pid = $id; name = $p.Name }
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
      if ($null -eq $u -or $id -eq $fg -or $id -eq $self -or $p.Session -eq 0 -or $held.ContainsKey($id) -or $auto[$id] -or $wd[$p.Key] -or $skip.Contains($p.Key)) { $over.Remove($id); continue }
      if ($u -lt $c.proc) { $over.Remove($id); continue }
      if (-not $over.ContainsKey($id)) { $over[$id] = $now; continue }
      if (($now - $over[$id]).TotalMilliseconds -lt $c.overMs) { continue }
      $over.Remove($id)
      if ([BatutaNative]::Priority($id) -eq $NORMAL -and [BatutaNative]::SetPriority($id, $PRIO.below)) { $held[$id] = @{ since = $now; name = $p.Name }; Emit @{ type = 'contain'; pid = $id; name = $p.Name; cpu = [math]::Round($u, 1) } }
    }
  } else { $over.Clear() }
  foreach ($id in @($held.Keys)) {
    $h = $held[$id]; $p = $byId[$id]
    if (-not $p) { $held.Remove($id); continue }
    if ((($use[$id] -lt $c.restore) -or $id -eq $fg -or -not $c.enabled) -and ($now - $h.since).TotalMilliseconds -ge $c.minMs) {
      [void][BatutaNative]::SetPriority($id, $NORMAL)
      $held.Remove($id); Emit @{ type = 'release'; pid = $id; name = $h.name }
    }
  }
  $m = $cfg.memory; $standby = -1; $free = -1
  $ml = [BatutaNative]::MemoryList()
  if ($ml[0] -ge 0) { $standby = [math]::Round($ml[0] * 4096 / 1MB); $free = [math]::Round($ml[1] * 4096 / 1MB) }
  # A purge makes Windows read cached files back from disk, which stutters a running game: at most one
  # every 5 minutes while playing (the first one when the game starts), every 10 s otherwise.
  $cooldown = if ($gaming) { 300 } else { 10 }
  if ($m.enabled -and $standby -ge 0 -and ($gaming -or -not $m.onlyGaming) -and $standby -ge $m.listMB -and $free -lt $m.freeMB -and ($now - $lastPurge).TotalSeconds -ge $cooldown) {
    $blocked = $procs | Where-Object { $memSkip -contains $_.Key } | Select-Object -First 1
    if (-not $blocked -and [BatutaNative]::PurgeStandby()) {
      $lastPurge = $now; $after = [BatutaNative]::MemoryList()
      Emit @{ type = 'purge'; before = $standby; after = [math]::Round($after[0] * 4096 / 1MB); free = $free }
    }
  }
  Emit @{ type = 'status'; cpu = [math]::Round($total, 1); standby = $standby; free = $free; idleMs = [BatutaNative]::IdleMs(); gaming = $gaming; managed = $managed; held = @($held.Keys | ForEach-Object { @{ pid = $_; name = $held[$_].name } }) }
  # Rules are already in place while a game runs, so the pass slows down to keep out of its way.
  # One kernel wait instead of a sleep loop; a line on stdin ends it at once.
  [void]$stop.AsyncWaitHandle.WaitOne($(if ($gaming) { 5000 } else { 2000 }))
}
foreach ($id in @($held.Keys)) { [void][BatutaNative]::SetPriority($id, $NORMAL) }
foreach ($id in @($wdState.Keys)) {
  $s = $wdState[$id]
  if ($s.acted) { if ($s.prio) { [void][BatutaNative]::SetPriority($id, $s.prio) }; if ($s.aff -gt 0) { [void][BatutaNative]::SetAffinity($id, $s.aff) } }
}
Emit @{ type = 'stopped' }
`;
}

module.exports = { workerScript, exeKey, NOT_GAME, NOT_GAME_DIR, PROTECTED };
