// Gaming area: game features, latency, input, USB, audio, process priority and platforms.
const { HKCU, HKLM, P, reg, serviceTweak, powerSetting, ifeoPriority, bcdValue } = require('./helpers.cjs');

const GAMES_TASK = `${P.sysProfile}\\Tasks\\Games`;
const AUDIO_TASK = `${P.sysProfile}\\Tasks\\Audio`;
const PRIORITY = `${HKLM}SYSTEM\\CurrentControlSet\\Control\\PriorityControl`;
const USB_SUB = '2a737441-1930-4402-8d77-b2bebba308a3';

module.exports = [
  // ---------------- Otimizador de jogos ----------------
  {
    id: 'game-mode-on', module: 'gaming',
    name: 'Ativar Modo de Jogo do Windows',
    description: 'Prioriza o jogo em foco e impede que o Windows Update instale drivers ou mostre notificações de reinício durante a partida.',
    impact: 'medium', risk: 'safe', admin: false, restart: 'none', tags: ['quick-win'],
    registry: [
      reg(`${HKCU}Software\\Microsoft\\GameBar`, 'AutoGameModeEnabled', 1),
      reg(`${HKCU}Software\\Microsoft\\GameBar`, 'AllowAutoGameMode', 1),
    ],
  },
  {
    id: 'game-dvr-off', module: 'gaming',
    name: 'Desativar Game DVR (gravação em segundo plano)',
    description: 'A Xbox Game Bar para de gravar os últimos minutos em segundo plano, o que consumia GPU e disco o tempo todo.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'none', tags: ['quick-win'],
    registry: [
      reg(`${HKCU}System\\GameConfigStore`, 'GameDVR_Enabled', 0, 'DWord', 1),
      reg(`${HKCU}Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR`, 'AppCaptureEnabled', 0),
      reg(`${P.polWin}\\GameDVR`, 'AllowGameDVR', 0),
    ],
  },
  {
    id: 'game-fse-legacy', module: 'gaming',
    name: 'Tela cheia exclusiva real (desativar FSO global)',
    description: 'Jogos em “tela cheia” passam a usar o modo exclusivo de verdade, em vez da tela cheia otimizada que roda sobre o DWM.',
    impact: 'medium', risk: 'safe', admin: false, restart: 'none',
    registry: [
      reg(`${HKCU}System\\GameConfigStore`, 'GameDVR_FSEBehaviorMode', 2),
      reg(`${HKCU}System\\GameConfigStore`, 'GameDVR_HonorUserFSEBehaviorMode', 1),
      reg(`${HKCU}System\\GameConfigStore`, 'GameDVR_FSEBehavior', 2),
      reg(`${HKCU}System\\GameConfigStore`, 'GameDVR_DXGIHonorFSEWindowsCompatible', 1),
    ],
  },
  {
    id: 'game-mmcss-games', module: 'gaming',
    name: 'Prioridade alta para jogos no agendador multimídia',
    description: 'Tarefa “Games” do MMCSS com prioridade 6, categoria High e I/O alta; reserva de CPU para segundo plano reduzida para 10%.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'reboot', tags: ['quick-win'],
    registry: [
      reg(P.sysProfile, 'SystemResponsiveness', 10, 'DWord', 20),
      reg(GAMES_TASK, 'GPU Priority', 8, 'DWord', 8),
      reg(GAMES_TASK, 'Priority', 6, 'DWord', 2),
      reg(GAMES_TASK, 'Scheduling Category', 'High', 'String', 'Medium'),
      reg(GAMES_TASK, 'SFIO Priority', 'High', 'String', 'Normal'),
    ],
  },
  {
    id: 'game-bar-tips-off', module: 'gaming',
    name: 'Desativar dicas e painel inicial da Game Bar',
    description: 'Remove o aviso “Pressione Win+G” e o painel de boas-vindas que aparecem ao abrir jogos.',
    impact: 'low', risk: 'safe', admin: false, restart: 'none',
    registry: [reg(`${HKCU}Software\\Microsoft\\GameBar`, 'ShowStartupPanel', 0, 'DWord', 1)],
  },
  {
    id: 'game-pri-sep-fps', module: 'gaming',
    name: 'Agendador: favorecer o jogo em foco (FPS)',
    description: 'Win32PrioritySeparation = 0x26: quanta curtos e variáveis com boost triplo para a janela em primeiro plano.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none', conflicts: ['latency-pri-sep-fixed'],
    registry: [reg(PRIORITY, 'Win32PrioritySeparation', 0x26, 'DWord', 2)],
  },

  // ---------------- Latência ----------------
  {
    id: 'latency-pri-sep-fixed', module: 'latency',
    name: 'Agendador: quanta curtos e fixos (latência)',
    description: 'Win32PrioritySeparation = 0x28: fatias de tempo curtas e iguais para todos os processos, sem boost. Tempo de resposta mais previsível.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none', conflicts: ['game-pri-sep-fps'],
    registry: [reg(PRIORITY, 'Win32PrioritySeparation', 0x28, 'DWord', 2)],
  },
  {
    id: 'latency-global-timer', module: 'latency',
    name: 'Resolução de timer global (Windows 11)',
    description: 'GlobalTimerResolutionRequests=1 faz o pedido de timer de 0,5 ms de um processo valer para o sistema todo, como no Windows 10.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'reboot', requires: { win11: true },
    registry: [reg(`${HKLM}SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel`, 'GlobalTimerResolutionRequests', 1)],
  },
  {
    id: 'latency-dynamic-tick-off', module: 'latency',
    name: 'Desativar tick dinâmico',
    description: 'bcdedit disabledynamictick=yes: o timer do kernel dispara em intervalos regulares, sem pausas de economia de energia.',
    impact: 'low', risk: 'moderate', admin: true, restart: 'reboot', requires: { desktop: true },
    script: bcdValue('disabledynamictick', 'yes'),
  },
  {
    id: 'latency-platform-clock-fix', module: 'latency',
    name: 'Remover HPET forçado (useplatformclock)',
    description: 'Se algum programa forçou o HPET como fonte de clock, remove a opção para voltar ao TSC, que é muito mais rápido de ler.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'reboot', tags: ['fix'],
    script: {
      snapshot: `$l = bcdedit /enum '{current}' | Select-String '^useplatformclock\\s+(\\S+)'; if ($l) { $l.Matches[0].Groups[1].Value } else { '<unset>' }`,
      apply: `bcdedit /deletevalue '{current}' useplatformclock | Out-Null; $global:LASTEXITCODE = 0`,
      revert: `if ($Snapshot -and $Snapshot -ne '<unset>') { bcdedit /set '{current}' useplatformclock $Snapshot | Out-Null }`,
      check: `$bcd = bcdedit /enum '{current}'; if ($LASTEXITCODE) { throw 'bcdedit indisponível' }; -not ($bcd | Select-String '^useplatformclock')`,
    },
  },
  {
    id: 'latency-hvci-off', module: 'latency',
    name: 'Desativar Integridade de Memória (HVCI)',
    description: 'Pode reduzir latência e ganhar FPS em CPUs mais antigas, mas remove a proteção contra drivers maliciosos.',
    impact: 'medium', risk: 'advanced', admin: true, restart: 'reboot',
    warn: 'Alguns anti-cheats (ex.: Valorant, FACEIT) e o Windows 11 em PCs corporativos exigem HVCI ligado.',
    registry: [reg(`${HKLM}SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity`, 'Enabled', 0, 'DWord', 1)],
  },
  {
    id: 'latency-network-throttling-off', module: 'latency',
    name: 'Desativar limitação de rede multimídia',
    description: 'NetworkThrottlingIndex = 0xFFFFFFFF remove o limite de pacotes que o Windows aplica enquanto há mídia tocando.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot', tags: ['quick-win'],
    registry: [reg(P.sysProfile, 'NetworkThrottlingIndex', 0xffffffff, 'DWord', 10)],
  },

  // ---------------- Input ----------------
  {
    id: 'input-mouse-accel-off', module: 'input',
    name: 'Desativar aceleração do mouse',
    description: 'Desliga “Aumentar precisão do ponteiro”: o cursor se move exatamente na proporção do movimento físico.',
    impact: 'high', risk: 'safe', admin: false, restart: 'none', tags: ['quick-win'],
    registry: [
      reg(P.mouse, 'MouseSpeed', '0', 'String', '1'),
      reg(P.mouse, 'MouseThreshold1', '0', 'String', '6'),
      reg(P.mouse, 'MouseThreshold2', '0', 'String', '10'),
    ],
  },
  {
    id: 'input-sticky-keys-off', module: 'input',
    name: 'Desativar atalhos de acessibilidade do teclado',
    description: 'Sem pop-up de Teclas de Aderência (Shift 5x), Teclas de Filtragem (segurar Shift) e Teclas de Alternância durante o jogo.',
    impact: 'medium', risk: 'safe', admin: false, restart: 'none', tags: ['quick-win'],
    registry: [
      reg(`${HKCU}Control Panel\\Accessibility\\StickyKeys`, 'Flags', '506', 'String', '510'),
      reg(`${HKCU}Control Panel\\Accessibility\\ToggleKeys`, 'Flags', '58', 'String', '62'),
      reg(`${HKCU}Control Panel\\Accessibility\\Keyboard Response`, 'Flags', '122', 'String', '126'),
    ],
  },
  {
    id: 'input-keyboard-fast', module: 'input',
    name: 'Repetição de teclado mais rápida',
    description: 'Atraso antes de repetir no mínimo e taxa de repetição no máximo.',
    impact: 'low', risk: 'safe', admin: false, restart: 'logoff',
    registry: [
      reg(`${HKCU}Control Panel\\Keyboard`, 'KeyboardDelay', '0', 'String', '1'),
      reg(`${HKCU}Control Panel\\Keyboard`, 'KeyboardSpeed', '31', 'String', '31'),
    ],
  },
  {
    id: 'input-hover-time', module: 'input',
    name: 'Reduzir tempo de foco do ponteiro',
    description: 'MouseHoverTime de 400 ms para 10 ms: dicas e pré-visualizações aparecem quase imediatamente.',
    impact: 'low', risk: 'safe', admin: false, restart: 'logoff',
    registry: [reg(P.mouse, 'MouseHoverTime', '10', 'String', '400')],
  },
  {
    id: 'input-lang-hotkey-off', module: 'input',
    name: 'Desativar atalho Alt+Shift de troca de idioma',
    description: 'Evita trocar o layout do teclado sem querer no meio do jogo. Win+Espaço continua funcionando.',
    impact: 'medium', risk: 'safe', admin: false, restart: 'logoff',
    registry: [
      reg(`${HKCU}Keyboard Layout\\Toggle`, 'Hotkey', '3', 'String'),
      reg(`${HKCU}Keyboard Layout\\Toggle`, 'Language Hotkey', '3', 'String'),
      reg(`${HKCU}Keyboard Layout\\Toggle`, 'Layout Hotkey', '3', 'String'),
    ],
  },
  {
    id: 'input-queue-priority', module: 'input',
    name: 'Prioridade alta para os drivers de mouse e teclado',
    description: 'ThreadPriority=31 nos drivers mouclass e kbdclass, para que a entrada seja processada antes de outras tarefas do kernel.',
    impact: 'low', risk: 'moderate', admin: true, restart: 'reboot',
    registry: [
      reg(`${HKLM}SYSTEM\\CurrentControlSet\\Services\\mouclass\\Parameters`, 'ThreadPriority', 31),
      reg(`${HKLM}SYSTEM\\CurrentControlSet\\Services\\kbdclass\\Parameters`, 'ThreadPriority', 31),
    ],
  },

  // ---------------- USB ----------------
  {
    id: 'usb-selective-suspend-off', module: 'usb',
    name: 'Desativar suspensão seletiva de USB',
    description: 'Mouse, teclado e headset USB não entram em economia de energia — causa comum de travadas e desconexões.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'none', tags: ['quick-win'],
    script: powerSetting(USB_SUB, '48e6b7a6-50f5-4782-a5d4-53bb8f07e226', 0, 0),
  },
  {
    id: 'usb-link-power-off', module: 'usb',
    name: 'Desativar economia de energia do link USB 3',
    description: 'USB 3 Link Power Management desligado: controladoras USB 3 mantêm o link ativo, reduzindo latência de dispositivos.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    script: powerSetting(USB_SUB, 'd4e98f31-5ffe-4ce1-be31-1b38b384c009', 0, null),
  },
  {
    id: 'usb-device-power-off', module: 'usb',
    name: 'Impedir que dispositivos USB sejam desligados',
    description: 'Desmarca “Permitir que o computador desligue este dispositivo” em todos os dispositivos USB conectados (EnhancedPowerManagement, IdleInD3).',
    impact: 'low', risk: 'moderate', admin: true, restart: 'reboot',
    script: {
      snapshot: `$o = @(); Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\USB' -ErrorAction SilentlyContinue | Get-ChildItem -ErrorAction SilentlyContinue | ForEach-Object { $dp = Join-Path $_.PSPath 'Device Parameters'; if (Test-Path $dp) { $k = Get-Item $dp; foreach ($n in 'EnhancedPowerManagementEnabled','AllowIdleIrpInD3','SelectiveSuspendEnabled') { $v = $k.GetValue($n, $null); if ($null -ne $v) { $o += [pscustomobject]@{ k = $dp; n = $n; v = $v } } } } }; ConvertTo-Json -InputObject @($o) -Compress`,
      apply: `Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\USB' -ErrorAction SilentlyContinue | Get-ChildItem -ErrorAction SilentlyContinue | ForEach-Object { $dp = Join-Path $_.PSPath 'Device Parameters'; if (Test-Path $dp) { $k = Get-Item $dp; foreach ($n in 'EnhancedPowerManagementEnabled','AllowIdleIrpInD3','SelectiveSuspendEnabled') { if ($null -ne $k.GetValue($n, $null)) { try { Set-ItemProperty -LiteralPath $dp -Name $n -Value 0 -ErrorAction Stop } catch {} } } } }`,
      revert: `if ($Snapshot) { foreach ($e in @($Snapshot | ConvertFrom-Json)) { try { Set-ItemProperty -LiteralPath $e.k -Name $e.n -Value $e.v -ErrorAction Stop } catch {} } }`,
      check: `$on = 0; $seen = 0; Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\USB' -ErrorAction SilentlyContinue | Get-ChildItem -ErrorAction SilentlyContinue | ForEach-Object { $dp = Join-Path $_.PSPath 'Device Parameters'; if (Test-Path $dp) { $v = (Get-Item $dp).GetValue('EnhancedPowerManagementEnabled', $null); if ($null -ne $v) { $seen++; if ($v -ne 0) { $on++ } } } }; $seen -gt 0 -and $on -eq 0`,
    },
  },

  // ---------------- Áudio ----------------
  {
    id: 'audio-ducking-off', module: 'audio',
    name: 'Não abaixar o volume durante chamadas',
    description: 'O Windows para de reduzir o som do jogo em 80% quando detecta comunicação (Discord, Teams).',
    impact: 'medium', risk: 'safe', admin: false, restart: 'none', tags: ['quick-win'],
    registry: [reg(`${HKCU}Software\\Microsoft\\Multimedia\\Audio`, 'UserDuckingPreference', 3, 'DWord', 1)],
  },
  {
    id: 'audio-mmcss-high', module: 'audio',
    name: 'Prioridade alta para a tarefa de áudio (MMCSS)',
    description: 'Categoria de agendamento e I/O altas para threads de áudio, reduzindo estalos sob carga pesada de CPU.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot',
    registry: [
      reg(AUDIO_TASK, 'Scheduling Category', 'High', 'String', 'Medium'),
      reg(AUDIO_TASK, 'SFIO Priority', 'High', 'String', 'Normal'),
    ],
  },
  {
    id: 'audio-startup-sound-off', module: 'audio',
    name: 'Desativar som de inicialização',
    description: 'Silencia o som tocado na tela de logon.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: [reg(`${HKLM}SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI\\BootAnimation`, 'DisableStartupSound', 1, 'DWord', 0)],
  },
  {
    id: 'audio-system-sounds-off', module: 'audio',
    name: 'Esquema de sons do Windows: sem sons',
    description: 'Troca o esquema de sons do sistema para “Sem Sons” (bipes de erro, notificações do sistema).',
    impact: 'low', risk: 'safe', admin: false, restart: 'none',
    script: {
      snapshot: `$o = @(); Get-ChildItem 'HKCU:\\AppEvents\\Schemes\\Apps' -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -eq '.Current' } | ForEach-Object { $o += [pscustomobject]@{ k = $_.PSPath; v = [string]$_.GetValue('') } }; $s = (Get-ItemProperty 'HKCU:\\AppEvents\\Schemes').'(default)'; ConvertTo-Json -InputObject @{ scheme = $s; items = @($o) } -Depth 4 -Compress`,
      apply: `Get-ChildItem 'HKCU:\\AppEvents\\Schemes\\Apps' -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -eq '.Current' } | ForEach-Object { Set-ItemProperty -LiteralPath $_.PSPath -Name '(default)' -Value '' }; Set-ItemProperty 'HKCU:\\AppEvents\\Schemes' -Name '(default)' -Value '.None'`,
      revert: `if ($Snapshot) { $d = $Snapshot | ConvertFrom-Json; foreach ($e in @($d.items)) { Set-ItemProperty -LiteralPath $e.k -Name '(default)' -Value $e.v }; Set-ItemProperty 'HKCU:\\AppEvents\\Schemes' -Name '(default)' -Value $(if ($d.scheme) { $d.scheme } else { '.Default' }) }`,
      check: `(Get-ItemProperty 'HKCU:\\AppEvents\\Schemes').'(default)' -eq '.None'`,
    },
  },

  // ---------------- Prioridade de processos ----------------
  {
    id: 'prio-onedrive-low', module: 'priority',
    name: 'OneDrive com prioridade baixa',
    description: 'Sincronização do OneDrive roda abaixo do normal (CPU e disco), sem competir com o jogo.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: ifeoPriority('OneDrive.exe', 5, 1),
  },
  {
    id: 'prio-searchindexer-low', module: 'priority',
    name: 'Indexador de pesquisa com prioridade baixa',
    description: 'SearchIndexer.exe e SearchProtocolHost.exe passam a usar CPU e disco só quando sobra.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot',
    registry: [...ifeoPriority('SearchIndexer.exe', 5, 1), ...ifeoPriority('SearchProtocolHost.exe', 1, 0)],
  },
  {
    id: 'prio-compattel-idle', module: 'priority',
    name: 'Telemetria de compatibilidade em prioridade ociosa',
    description: 'CompatTelRunner.exe — conhecido por picos de CPU e disco — só roda quando o PC está ocioso.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: ifeoPriority('CompatTelRunner.exe', 1, 0),
  },
  {
    id: 'prio-updaters-low', module: 'priority',
    name: 'Atualizadores com prioridade baixa',
    description: 'Atualizadores do Edge, Google e Adobe rodam abaixo do normal.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: [
      ...ifeoPriority('MicrosoftEdgeUpdate.exe', 5, 1),
      ...ifeoPriority('GoogleUpdate.exe', 5, 1),
      ...ifeoPriority('AdobeARM.exe', 5, 1),
    ],
  },
  {
    id: 'prio-defender-scan-low', module: 'priority',
    name: 'Varredura agendada do Defender com CPU limitada',
    description: 'Limita a varredura agendada do Microsoft Defender a 20% de CPU e prioridade baixa.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none', requires: { defender: true },
    script: {
      snapshot: `$p = Get-MpPreference; "$($p.ScanAvgCPULoadFactor),$([int]$p.EnableLowCpuPriority)"`,
      apply: 'Set-MpPreference -ScanAvgCPULoadFactor 20 -EnableLowCpuPriority $true',
      revert: `if ($Snapshot -match '^(\\d+),(\\d)$') { Set-MpPreference -ScanAvgCPULoadFactor ([int]$Matches[1]) -EnableLowCpuPriority ([bool][int]$Matches[2]) } else { Set-MpPreference -ScanAvgCPULoadFactor 50 -EnableLowCpuPriority $false }`,
      check: '$p = Get-MpPreference; $p.ScanAvgCPULoadFactor -le 20 -and $p.EnableLowCpuPriority',
    },
  },

  // ---------------- Plataformas ----------------
  {
    id: 'platform-steam-helper-low', module: 'platforms',
    name: 'Steam: navegador interno com prioridade baixa',
    description: 'steamwebhelper.exe (loja, amigos, overlay web) roda abaixo do normal, sem disputar CPU com o jogo. A janela da Steam pode ficar um pouco mais lenta.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: ifeoPriority('steamwebhelper.exe', 5, 1),
  },
  {
    id: 'platform-epic-low', module: 'platforms',
    name: 'Epic Games: launcher com prioridade baixa',
    description: 'EpicGamesLauncher.exe e EpicWebHelper.exe rodam abaixo do normal enquanto você joga.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: [...ifeoPriority('EpicGamesLauncher.exe', 5, 1), ...ifeoPriority('EpicWebHelper.exe', 5, 1)],
  },
  {
    id: 'platform-battlenet-low', module: 'platforms',
    name: 'Battle.net: launcher com prioridade baixa',
    description: 'Battle.net.exe roda abaixo do normal. (O atualizador “Agent.exe” fica de fora: o nome é genérico demais e a regra valeria para outros programas.)',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: ifeoPriority('Battle.net.exe', 5, 1),
  },
  {
    id: 'platform-ea-low', module: 'platforms',
    name: 'EA app: launcher com prioridade baixa',
    description: 'EADesktop.exe e EABackgroundService.exe rodam abaixo do normal.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: [...ifeoPriority('EADesktop.exe', 5, 1), ...ifeoPriority('EABackgroundService.exe', 5, 1)],
  },
  {
    id: 'platform-ubisoft-low', module: 'platforms',
    name: 'Ubisoft Connect: launcher com prioridade baixa',
    description: 'upc.exe e UplayWebCore.exe rodam abaixo do normal.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: [...ifeoPriority('upc.exe', 5, 1), ...ifeoPriority('UplayWebCore.exe', 5, 1)],
  },
  {
    id: 'platform-gog-low', module: 'platforms',
    name: 'GOG Galaxy: cliente com prioridade baixa',
    description: 'GalaxyClient.exe e GalaxyClient Helper.exe rodam abaixo do normal.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: [...ifeoPriority('GalaxyClient.exe', 5, 1), ...ifeoPriority('GalaxyClient Helper.exe', 5, 1)],
  },
  serviceTweak({
    id: 'platform-xbox-services-off', module: 'platforms',
    name: 'Desativar serviços Xbox',
    description: 'Somente se você não usa Game Pass, jogos da Xbox app nem controle Xbox sem fio.',
    impact: 'low', risk: 'moderate',
  }, ['XblAuthManager', 'XblGameSave', 'XboxNetApiSvc', 'XboxGipSvc']),
  {
    id: 'platform-store-autoupdate-off', module: 'platforms',
    name: 'Microsoft Store: não atualizar apps sozinha',
    description: 'Evita downloads grandes da Store em segundo plano no meio da partida. Você ainda pode atualizar manualmente.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: [reg(`${HKLM}SOFTWARE\\Policies\\Microsoft\\WindowsStore`, 'AutoDownload', 2)],
  },
  {
    id: 'platform-discord-hwaccel-off', module: 'platforms',
    name: 'Discord: desativar aceleração de hardware',
    description: 'O Discord deixa de usar a GPU para desenhar a interface, liberando-a para o jogo. Reabra o Discord para aplicar.',
    impact: 'low', risk: 'safe', admin: false, restart: 'none',
    script: {
      snapshot: `$f = Join-Path $env:APPDATA 'discord\\settings.json'; if (Test-Path $f) { $j = Get-Content $f -Raw | ConvertFrom-Json; if ($null -ne $j.enableHardwareAcceleration) { [string]$j.enableHardwareAcceleration } else { '<unset>' } }`,
      apply: `$f = Join-Path $env:APPDATA 'discord\\settings.json'; if (-not (Test-Path $f)) { throw 'Discord não encontrado.' }; $j = Get-Content $f -Raw | ConvertFrom-Json; $j | Add-Member -NotePropertyName enableHardwareAcceleration -NotePropertyValue $false -Force; $j | ConvertTo-Json -Depth 10 | Set-Content $f -Encoding UTF8`,
      revert: `$f = Join-Path $env:APPDATA 'discord\\settings.json'; if (Test-Path $f) { $j = Get-Content $f -Raw | ConvertFrom-Json; if (-not $Snapshot -or $Snapshot -eq '<unset>') { $j.PSObject.Properties.Remove('enableHardwareAcceleration') } else { $j | Add-Member -NotePropertyName enableHardwareAcceleration -NotePropertyValue ($Snapshot -eq 'True') -Force }; $j | ConvertTo-Json -Depth 10 | Set-Content $f -Encoding UTF8 }`,
      check: `$f = Join-Path $env:APPDATA 'discord\\settings.json'; (Test-Path $f) -and ((Get-Content $f -Raw | ConvertFrom-Json).enableHardwareAcceleration -eq $false)`,
    },
  },
];
