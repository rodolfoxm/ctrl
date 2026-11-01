// Builders shared by the catalog files. Every tweak is plain data that the engine
// turns into PowerShell: `registry` entries are snapshotted and restored exactly;
// `script` tweaks provide their own snapshot/apply/revert/check.
//
// Tweak fields:
//   id, module, name, description, impact (low|medium|high), risk (safe|moderate|advanced),
//   admin, restart (none|explorer|logoff|reboot), registry[] | script{}, afterApply, afterRevert,
//   requires { gpu, cpu, win11, laptop, desktop, wifi, minRamGb }, conflicts[], warn, tags[]

const HKCU = 'HKCU:\\';
const HKLM = 'HKLM:\\';

const P = {
  adv: `${HKCU}Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced`,
  explorer: `${HKCU}Software\\Microsoft\\Windows\\CurrentVersion\\Explorer`,
  sysProfile: `${HKLM}SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile`,
  cdm: `${HKCU}Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager`,
  desktop: `${HKCU}Control Panel\\Desktop`,
  mouse: `${HKCU}Control Panel\\Mouse`,
  memMgmt: `${HKLM}SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management`,
  graphics: `${HKLM}SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers`,
  tcpip: `${HKLM}SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters`,
  polWin: `${HKLM}SOFTWARE\\Policies\\Microsoft\\Windows`,
  polSystem: `${HKLM}SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System`,
  ifeo: `${HKLM}SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options`,
  gpuClass: `${HKLM}SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}`,
};

/** Registry value. Omitting `revertTo` deletes the value on revert when no snapshot exists. */
function reg(path, name, value, type = 'DWord', revertTo) {
  const e = { path, name, value, type };
  if (revertTo !== undefined) e.revertTo = revertTo;
  return e;
}

/** Service start type; skipped silently on machines where the service doesn't exist. */
function svc(name, start = 4, revertTo = 3) {
  return { path: `${HKLM}SYSTEM\\CurrentControlSet\\Services\\${name}`, name: 'Start', value: start, type: 'DWord', revertTo, ifKeyExists: true };
}

function stopServices(names) {
  return names.map((n) => `Stop-Service -Name '${n}' -Force -ErrorAction SilentlyContinue`).join('\n');
}
function startServices(names) {
  return names.map((n) => `Start-Service -Name '${n}' -ErrorAction SilentlyContinue`).join('\n');
}

/** Service tweak that also stops/starts the services immediately. */
function serviceTweak(base, names, { start = 4, revertTo = 3 } = {}) {
  const list = Array.isArray(names) ? names : [names];
  const reverts = Array.isArray(revertTo) ? revertTo : list.map(() => revertTo);
  return {
    admin: true, restart: 'none', ...base,
    registry: list.map((n, i) => svc(n, start, reverts[i])),
    afterApply: start === 4 ? stopServices(list) : undefined,
    afterRevert: startServices(list.filter((_, i) => reverts[i] === 2)),
  };
}

/**
 * Power plan setting on the active scheme (AC and/or DC index). Snapshot keeps the
 * original indices; check compares the current AC (and DC when set) index.
 */
function powerSetting(sub, setting, ac, dc) {
  // /qh also lists hidden settings (CPMINCORES, PERFBOOSTMODE…), which /q omits.
  const q = `powercfg /qh SCHEME_CURRENT ${sub} ${setting}`;
  const read = `$v = [regex]::Matches((${q} | Out-String), '0x[0-9a-fA-F]{8}'); $ac = [Convert]::ToInt32($v[$v.Count-2].Value, 16); $dc = [Convert]::ToInt32($v[$v.Count-1].Value, 16)`;
  const set = (acv, dcv) =>
    [
      acv != null ? `powercfg /setacvalueindex SCHEME_CURRENT ${sub} ${setting} ${acv}` : '',
      dcv != null ? `powercfg /setdcvalueindex SCHEME_CURRENT ${sub} ${setting} ${dcv}` : '',
      'powercfg /setactive SCHEME_CURRENT',
    ].filter(Boolean).join('\n');
  return {
    snapshot: `${read}; "$ac,$dc"`,
    apply: set(ac, dc),
    revert: `if ($Snapshot -match '^(\\d+),(\\d+)$') { ${set('$Matches[1]', '$Matches[2]')} }`,
    check: `${read}; ($ac -eq ${ac ?? '$ac'}) -and ($dc -eq ${dc ?? '$dc'})`,
  };
}

/** Several power settings as one tweak: [[sub, setting, ac, dc], …]. Snapshots join with ';'. */
function powerSettings(list) {
  const parts = list.map(([sub, setting, ac, dc]) => powerSetting(sub, setting, ac, dc));
  return {
    snapshot: `(@(${parts.map((p) => `(& { ${p.snapshot} })`).join(', ')}) -join ';')`,
    apply: parts.map((p) => p.apply).join('\n'),
    revert: `$all = "$Snapshot" -split ';'\n${parts.map((p, i) => `$Snapshot = $all[${i}]\n${p.revert}`).join('\n')}`,
    check: parts.map((p) => `(& { ${p.check} })`).join(' -and '),
  };
}

/** IFEO PerfOptions priority for an executable (1 idle, 2 normal, 3 high, 5 below normal, 6 above normal). */
function ifeoPriority(exe, cpu, io) {
  const path = `${P.ifeo}\\${exe}\\PerfOptions`;
  const out = [reg(path, 'CpuPriorityClass', cpu)];
  if (io != null) out.push(reg(path, 'IoPriority', io));
  return out;
}

/**
 * Scheduled tasks toggle. Snapshot stores the tasks that were enabled before,
 * so revert only re-enables what the user had on.
 */
function scheduledTasks(paths) {
  const list = `@(${paths.map((p) => `'${p}'`).join(',')})`;
  return {
    snapshot: `$on = @(); foreach ($p in ${list}) { $t = Get-ScheduledTask -TaskPath ($p.Substring(0, $p.LastIndexOf('\\') + 1)) -TaskName ($p.Substring($p.LastIndexOf('\\') + 1)) -ErrorAction SilentlyContinue; if ($t -and $t.State -ne 'Disabled') { $on += $p } }; ($on -join '|')`,
    apply: `foreach ($p in ${list}) { Disable-ScheduledTask -TaskPath ($p.Substring(0, $p.LastIndexOf('\\') + 1)) -TaskName ($p.Substring($p.LastIndexOf('\\') + 1)) -ErrorAction SilentlyContinue | Out-Null }`,
    revert: `$back = if ($Snapshot) { $Snapshot -split '\\|' } else { ${list} }; foreach ($p in $back) { if ($p) { Enable-ScheduledTask -TaskPath ($p.Substring(0, $p.LastIndexOf('\\') + 1)) -TaskName ($p.Substring($p.LastIndexOf('\\') + 1)) -ErrorAction SilentlyContinue | Out-Null } }`,
    check: `$found = 0; $off = 0; foreach ($p in ${list}) { $t = Get-ScheduledTask -TaskPath ($p.Substring(0, $p.LastIndexOf('\\') + 1)) -TaskName ($p.Substring($p.LastIndexOf('\\') + 1)) -ErrorAction SilentlyContinue; if ($t) { $found++; if ($t.State -eq 'Disabled') { $off++ } } }; $found -gt 0 -and $off -eq $found`,
  };
}

/**
 * bcdedit value on a BCD entry ({current} by default, {bootmgr} for the boot manager);
 * snapshot keeps whether it was set before. Yes/No also match localized output.
 */
function bcdValue(name, value, entry = '{current}') {
  // bcdedit needs elevation to read; failing loudly keeps the state "unknown" instead of "off".
  const read = `$bcd = bcdedit /enum '${entry}'; if ($LASTEXITCODE) { throw 'bcdedit indisponível' }; $cur = ($bcd | Select-String -Pattern ('^' + '${name}' + '\\s+(\\S+)')) | ForEach-Object { $_.Matches[0].Groups[1].Value }`;
  const expect = { yes: '^(yes|sim)$', no: '^(no|não|nao)$' }[String(value).toLowerCase()] || `^${value}$`;
  return {
    snapshot: `${read}; if ($cur) { $cur } else { '<unset>' }`,
    apply: `bcdedit /set '${entry}' ${name} ${value} | Out-Null; if ($LASTEXITCODE) { throw 'bcdedit falhou' }`,
    revert: `if (-not $Snapshot -or $Snapshot -eq '<unset>') { bcdedit /deletevalue '${entry}' ${name} | Out-Null } else { $v = $Snapshot -replace '^(sim)$', 'Yes' -replace '^(não|nao)$', 'No'; bcdedit /set '${entry}' ${name} $v | Out-Null }`,
    // An unset boolean element means "No", so "ensure No" tweaks also pass when absent.
    check: `${read}; ${String(value).toLowerCase() === 'no' ? '(-not $cur) -or ' : ''}([string]$cur -match '${expect}')`,
  };
}

/**
 * Windows optional feature (DISM). Snapshot keeps the previous state so revert never
 * enables a feature that was already off. Features missing from this edition fail clearly.
 */
function optionalFeature(names) {
  const list = `@(${(Array.isArray(names) ? names : [names]).map((n) => `'${n}'`).join(',')})`;
  const present = `$f = @(foreach ($n in ${list}) { Get-WindowsOptionalFeature -Online -FeatureName $n -ErrorAction SilentlyContinue | Where-Object { $_ } })`;
  return {
    snapshot: `${present}; ($f | Where-Object { $_.State -eq 'Enabled' } | ForEach-Object FeatureName) -join '|'`,
    apply: `${present}; if (-not $f.Count) { throw 'Este recurso não existe nesta edição do Windows.' }; foreach ($x in $f) { if ($x.State -eq 'Enabled') { Disable-WindowsOptionalFeature -Online -FeatureName $x.FeatureName -NoRestart -WarningAction SilentlyContinue | Out-Null } }`,
    revert: `foreach ($n in @($Snapshot -split '\\|' | Where-Object { $_ })) { Enable-WindowsOptionalFeature -Online -FeatureName $n -NoRestart -All -WarningAction SilentlyContinue | Out-Null }`,
    check: `${present}; $f.Count -gt 0 -and @($f | Where-Object { $_.State -eq 'Enabled' }).Count -eq 0`,
  };
}

/**
 * Microsoft Defender Attack Surface Reduction rules set to Block (1). Snapshot stores each
 * rule's previous action ('-' when it wasn't configured) so revert restores it exactly.
 */
function asrRules(ids) {
  const list = `@(${ids.map((g) => `'${g}'`).join(',')})`;
  const read = `$p = Get-MpPreference; $ids = @($p.AttackSurfaceReductionRules_Ids); $acts = @($p.AttackSurfaceReductionRules_Actions)`;
  return {
    snapshot: `${read}; (@(foreach ($g in ${list}) { $i = [array]::IndexOf(@($ids | ForEach-Object { "$_".ToLower() }), $g); if ($i -ge 0) { "$g=$($acts[$i])" } else { "$g=-" } }) -join '|')`,
    apply: `foreach ($g in ${list}) { Add-MpPreference -AttackSurfaceReductionRules_Ids $g -AttackSurfaceReductionRules_Actions Enabled }`,
    revert: `foreach ($e in @($Snapshot -split '\\|' | Where-Object { $_ })) { $g, $a = $e -split '='; if ($a -eq '-') { Remove-MpPreference -AttackSurfaceReductionRules_Ids $g -ErrorAction SilentlyContinue } else { Add-MpPreference -AttackSurfaceReductionRules_Ids $g -AttackSurfaceReductionRules_Actions ([int]$a) } }`,
    check: `${read}; $low = @($ids | ForEach-Object { "$_".ToLower() }); @(foreach ($g in ${list}) { $i = [array]::IndexOf($low, $g); $i -ge 0 -and [int]$acts[$i] -eq 1 }) -notcontains $false`,
  };
}

/**
 * Network adapter advanced properties by registry keyword, on every physical adapter
 * that exposes them. Snapshot is JSON of the original values per adapter.
 */
function adapterProperties(keywords, value) {
  const kw = `@(${keywords.map((k) => `'${k}'`).join(',')})`;
  return {
    snapshot: `$o = @(); Get-NetAdapter -Physical -ErrorAction SilentlyContinue | ForEach-Object { $a = $_.Name; Get-NetAdapterAdvancedProperty -Name $a -RegistryKeyword ${kw} -ErrorAction SilentlyContinue | ForEach-Object { $o += [pscustomobject]@{ a = $a; k = $_.RegistryKeyword; v = [string]($_.RegistryValue | Select-Object -First 1) } } }; ConvertTo-Json -InputObject @($o) -Compress`,
    apply: `$n = 0; Get-NetAdapter -Physical -ErrorAction SilentlyContinue | ForEach-Object { $a = $_.Name; Get-NetAdapterAdvancedProperty -Name $a -RegistryKeyword ${kw} -ErrorAction SilentlyContinue | ForEach-Object { Set-NetAdapterAdvancedProperty -Name $a -RegistryKeyword $_.RegistryKeyword -RegistryValue '${value}' -ErrorAction SilentlyContinue; $n++ } }; if ($n -eq 0) { throw 'Nenhum adaptador expõe esta configuração.' }`,
    revert: `if ($Snapshot) { foreach ($e in @($Snapshot | ConvertFrom-Json)) { Set-NetAdapterAdvancedProperty -Name $e.a -RegistryKeyword $e.k -RegistryValue $e.v -ErrorAction SilentlyContinue } }`,
    check: `$p = @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | ForEach-Object { Get-NetAdapterAdvancedProperty -Name $_.Name -RegistryKeyword ${kw} -ErrorAction SilentlyContinue }); $p.Count -gt 0 -and @($p | Where-Object { [string]($_.RegistryValue | Select-Object -First 1) -ne '${value}' }).Count -eq 0`,
  };
}

/**
 * A property read/written through a PowerShell getter/setter pair (language-independent
 * cmdlets such as Get-NetTCPSetting). `get` must evaluate to the current value.
 */
function cmdletValue(get, setTemplate, value) {
  const set = (v) => setTemplate.replace('{v}', v);
  return {
    snapshot: `[string](${get})`,
    apply: set(`'${value}'`),
    revert: `if ($Snapshot) { ${set('$Snapshot')} }`,
    check: `[string](${get}) -eq '${value}'`,
  };
}

module.exports = {
  HKCU, HKLM, P, reg, svc, serviceTweak, stopServices, startServices,
  powerSetting, powerSettings, ifeoPriority, scheduledTasks, bcdValue, adapterProperties, cmdletValue,
  optionalFeature, asrRules,
};
