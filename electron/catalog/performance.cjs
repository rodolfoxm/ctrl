// Performance area: CPU, GPU, memory, storage, display and power.
const { HKCU, HKLM, P, reg, svc, serviceTweak, powerSetting, powerSettings } = require('./helpers.cjs');

const SUB_PROC = 'SUB_PROCESSOR';
const SUB_DISK = 'SUB_DISK';
const { PLAN_NAME, PLAN_MATCH } = require('./constants.cjs');

module.exports = [
  // ---------------- CPU ----------------
  {
    id: 'cpu-core-parking-off', module: 'cpu',
    name: 'Desativar estacionamento de núcleos',
    description: 'Mantém 100% dos núcleos ativos na tomada (CPMINCORES; nas CPUs híbridas, os E-cores). Evita a latência de “acordar” núcleos estacionados quando um jogo pede mais threads de repente.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'none', tags: ['quick-win'],
    script: powerSetting(SUB_PROC, 'CPMINCORES', 100, null),
  },
  {
    // On hybrid CPUs CPMINCORES covers efficiency class 0 (the E-cores) only; class 1 (the P-cores) has its own
    // setting. A separate tweak keeps the snapshot of cpu-core-parking-off valid for who already applied it.
    id: 'cpu-core-parking-pcores-off', module: 'cpu',
    name: 'Desativar estacionamento dos P-cores (CPUs híbridas)',
    description: 'Em CPUs Intel híbridas, o ajuste anterior só vale para os E-cores. Este mantém os P-cores, onde o jogo roda, sempre ativos na tomada (CPMINCORES1).',
    impact: 'medium', risk: 'safe', admin: true, restart: 'none', requires: { hybrid: true }, tags: ['quick-win'],
    script: powerSetting(SUB_PROC, 'CPMINCORES1', 100, null),
  },
  {
    id: 'cpu-min-state-100', module: 'cpu',
    name: 'Estado mínimo do processador em 100% (na tomada)',
    description: 'A CPU não reduz o clock base quando está ociosa. Melhora a consistência de frametime, mas aumenta consumo e temperatura em repouso.',
    impact: 'medium', risk: 'moderate', admin: true, restart: 'none', warn: 'Aumenta temperatura e consumo em repouso.',
    script: powerSetting(SUB_PROC, 'PROCTHROTTLEMIN', 100, null),
  },
  {
    id: 'cpu-boost-aggressive', module: 'cpu',
    name: 'Turbo Boost agressivo',
    description: 'Define o modo de boost do processador como “Agressivo” (PERFBOOSTMODE=2) na tomada, para atingir frequências de turbo mais rápido.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'none',
    script: powerSetting(SUB_PROC, 'PERFBOOSTMODE', 2, null),
  },
  {
    id: 'cpu-epp-performance', module: 'cpu',
    name: 'Preferência de energia: desempenho máximo',
    description: 'Energy Performance Preference = 0 na tomada. Em CPUs com Speed Shift/CPPC, faz o hardware priorizar frequência em vez de economia.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'none',
    script: powerSetting(SUB_PROC, 'PERFEPP', 0, null),
  },
  {
    id: 'cpu-idle-disable', module: 'cpu',
    name: 'Desativar estados de repouso (C-states) da CPU',
    description: 'IDLEDISABLE=1 impede que a CPU entre em estados de repouso. Reduz latência ao extremo, mas a CPU passa a ficar sempre 100% “acordada”.',
    impact: 'high', risk: 'advanced', admin: true, restart: 'none', requires: { desktop: true },
    warn: 'Uso de CPU mostrado no Gerenciador fica em 100% e a temperatura sobe bastante. Não use em notebooks.',
    script: powerSetting(SUB_PROC, 'IDLEDISABLE', 1, null),
  },
  {
    id: 'cpu-power-throttling-off', module: 'cpu',
    name: 'Desativar Power Throttling',
    description: 'Impede o Windows de reduzir a frequência de processos que ele classifica como “em segundo plano” (EcoQoS).',
    impact: 'medium', risk: 'safe', admin: true, restart: 'reboot', tags: ['quick-win'],
    registry: [reg(`${HKLM}SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling`, 'PowerThrottlingOff', 1)],
  },
  {
    id: 'cpu-spectre-mitigations-off', module: 'cpu',
    name: 'Desativar mitigações Spectre/Meltdown',
    description: 'FeatureSettingsOverride=3: devolve desempenho perdido com as mitigações de CPU, principalmente em processadores Intel antigos.',
    impact: 'medium', risk: 'advanced', admin: true, restart: 'reboot',
    warn: 'Remove proteções contra ataques de canal lateral. Só faça em PCs dedicados a jogos.',
    registry: [
      reg(P.memMgmt, 'FeatureSettingsOverride', 3),
      reg(P.memMgmt, 'FeatureSettingsOverrideMask', 3),
    ],
  },

  {
    id: 'cpu-perf-ramp-fast', module: 'cpu',
    name: 'Subir a frequência mais rápido',
    description: 'Política de aumento “Rocket” e limiar de 10% de uso: a CPU sobe o clock assim que a carga aparece, em vez de esperar.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'none',
    script: powerSettings([[SUB_PROC, 'PERFINCPOL', 2, null], [SUB_PROC, 'PERFINCTHRESHOLD', 10, null]]),
  },
  {
    id: 'cpu-perf-hold', module: 'cpu',
    name: 'Segurar a frequência por mais tempo',
    description: 'Política de redução “Single” (desce um passo por vez): evita a oscilação de clock entre quadros que causa micro-stutter.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    script: powerSetting(SUB_PROC, 'PERFDECPOL', 1, null),
  },
  {
    id: 'cpu-latency-hint', module: 'cpu',
    name: 'Resposta máxima a dicas de latência',
    description: 'Quando um app sinaliza trabalho sensível a latência (áudio, input), todos os núcleos acordam e vão à frequência máxima (LATENCYHINTPERF/UNPARK = 100%).',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    script: powerSettings([[SUB_PROC, 'LATENCYHINTPERF', 100, null], [SUB_PROC, 'LATENCYHINTUNPARK', 100, null]]),
  },
  {
    id: 'cpu-hybrid-pcores', module: 'cpu',
    name: 'Preferir P-cores para threads (CPUs híbridas)',
    description: 'SCHEDPOLICY e SHORTSCHEDPOLICY = “preferir núcleos de desempenho”: threads de jogo vão para os P-cores antes dos E-cores.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'none', requires: { hybrid: true },
    script: powerSettings([[SUB_PROC, 'SCHEDPOLICY', 2, null], [SUB_PROC, 'SHORTSCHEDPOLICY', 2, null]]),
  },
  {
    id: 'cpu-max-freq-unlock', module: 'cpu',
    name: 'Remover limite de frequência máxima',
    description: 'Estado máximo do processador em 100% e sem teto de MHz (PROCFREQMAX=0) — alguns fabricantes deixam a CPU limitada no plano padrão.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none', tags: ['fix'],
    script: powerSettings([[SUB_PROC, 'PROCTHROTTLEMAX', 100, null], [SUB_PROC, 'PROCFREQMAX', 0, null]]),
  },

  // ---------------- GPU ----------------
  {
    id: 'gpu-hags', module: 'gpu',
    name: 'Agendamento de GPU acelerado por hardware (HAGS)',
    description: 'Deixa a GPU gerenciar a própria fila de trabalho. Necessário para DLSS Frame Generation; exige driver WDDM 2.7+.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'reboot',
    registry: [reg(P.graphics, 'HwSchMode', 2, 'DWord', 1)],
  },
  {
    id: 'gpu-mpo-off', module: 'gpu',
    name: 'Desativar Multiplane Overlay (MPO)',
    description: 'OverlayTestMode=5 desliga o MPO, causa conhecida de tela piscando e stutter com alguns drivers e múltiplos monitores.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'reboot',
    registry: [reg(`${HKLM}SOFTWARE\\Microsoft\\Windows\\Dwm`, 'OverlayTestMode', 5)],
  },
  {
    id: 'gpu-tdr-delay', module: 'gpu',
    name: 'Aumentar tempo limite de recuperação da GPU (TDR)',
    description: 'TdrDelay=10s: evita que o Windows reinicie o driver de vídeo durante cargas pesadas (renderização, shaders longos).',
    impact: 'low', risk: 'moderate', admin: true, restart: 'reboot',
    registry: [reg(P.graphics, 'TdrDelay', 10)],
  },
  {
    id: 'gpu-nvidia-telemetry-off', module: 'gpu',
    name: 'NVIDIA: desativar telemetria do driver',
    description: 'Desativa o serviço NvTelemetryContainer e as tarefas de relatório da NVIDIA, quando presentes.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none', requires: { gpu: 'nvidia' },
    registry: [svc('NvTelemetryContainer', 4, 2)],
    afterApply: `Stop-Service NvTelemetryContainer -Force -ErrorAction SilentlyContinue
Get-ScheduledTask -TaskName 'NvTmRep*' -ErrorAction SilentlyContinue | Disable-ScheduledTask -ErrorAction SilentlyContinue | Out-Null`,
    afterRevert: `Get-ScheduledTask -TaskName 'NvTmRep*' -ErrorAction SilentlyContinue | Enable-ScheduledTask -ErrorAction SilentlyContinue | Out-Null`,
  },
  {
    id: 'gpu-amd-ulps-off', module: 'gpu',
    name: 'AMD: desativar ULPS',
    description: 'Impede que a GPU AMD entre no estado de energia ultrabaixa (EnableUlps=0). Corrige travadas ao acordar a GPU, principalmente com várias placas.',
    impact: 'low', risk: 'moderate', admin: true, restart: 'reboot', requires: { gpu: 'amd' },
    script: {
      snapshot: `$o = @(); Get-ChildItem '${P.gpuClass}' -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match '^\\d{4}$' -and $null -ne $_.GetValue('EnableUlps') } | ForEach-Object { $o += [pscustomobject]@{ k = $_.PSPath; v = $_.GetValue('EnableUlps') } }; ConvertTo-Json -InputObject @($o) -Compress`,
      apply: `$n = 0; Get-ChildItem '${P.gpuClass}' -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match '^\\d{4}$' -and $null -ne $_.GetValue('EnableUlps') } | ForEach-Object { Set-ItemProperty -LiteralPath $_.PSPath -Name EnableUlps -Value 0; $n++ }; if ($n -eq 0) { throw 'Nenhuma GPU AMD com ULPS encontrada.' }`,
      revert: `if ($Snapshot) { foreach ($e in @($Snapshot | ConvertFrom-Json)) { Set-ItemProperty -LiteralPath $e.k -Name EnableUlps -Value $e.v } }`,
      check: `$k = @(Get-ChildItem '${P.gpuClass}' -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match '^\\d{4}$' -and $null -ne $_.GetValue('EnableUlps') }); $k.Count -gt 0 -and @($k | Where-Object { $_.GetValue('EnableUlps') -ne 0 }).Count -eq 0`,
    },
  },

  {
    id: 'gpu-preemption-off', module: 'gpu',
    name: 'Desativar preempção de GPU',
    description: 'EnablePreemption=0 no agendador WDDM: a GPU termina o lote atual antes de trocar de contexto. Pode reduzir latência em jogos.',
    impact: 'low', risk: 'advanced', admin: true, restart: 'reboot',
    warn: 'Com outro app pesando na GPU (navegador com vídeo, encoder), o Windows pode reiniciar o driver de vídeo (TDR).',
    registry: [reg(`${P.graphics}\\Scheduler`, 'EnablePreemption', 0)],
  },
  serviceTweak({
    id: 'gpu-amd-external-events-manual', module: 'gpu',
    name: 'AMD: serviço External Events sob demanda',
    description: 'O serviço de eventos de teclas/tela da AMD inicia só quando necessário, em vez de ficar sempre carregado.',
    impact: 'low', risk: 'safe', requires: { gpu: 'amd' },
  }, 'AMD External Events Utility', { start: 3, revertTo: 2 }),

  // ---------------- Memória ----------------
  {
    id: 'mem-compression-off', module: 'memory',
    name: 'Desativar compressão de memória',
    description: 'Economiza o tempo de CPU gasto comprimindo páginas. Só vale a pena com bastante RAM livre.',
    impact: 'low', risk: 'moderate', admin: true, restart: 'reboot', requires: { minRamGb: 16 },
    script: {
      apply: 'Disable-MMAgent -MemoryCompression',
      revert: 'Enable-MMAgent -MemoryCompression',
      check: '(Get-MMAgent).MemoryCompression -eq $false',
    },
  },
  {
    id: 'mem-page-combining-off', module: 'memory',
    name: 'Desativar combinação de páginas',
    description: 'O Windows deixa de procurar páginas de memória idênticas para deduplicar, o que consome CPU em segundo plano.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot', requires: { minRamGb: 16 },
    script: {
      apply: 'Disable-MMAgent -PageCombining',
      revert: 'Enable-MMAgent -PageCombining',
      check: '(Get-MMAgent).PageCombining -eq $false',
    },
  },
  {
    id: 'mem-paging-executive-off', module: 'memory',
    name: 'Manter kernel e drivers na RAM',
    description: 'DisablePagingExecutive=1 impede que código do kernel vá para o arquivo de paginação.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot', requires: { minRamGb: 16 },
    registry: [reg(P.memMgmt, 'DisablePagingExecutive', 1, 'DWord', 0)],
  },
  {
    id: 'mem-svchost-split', module: 'memory',
    name: 'Agrupar processos svchost',
    description: 'Ajusta SvcHostSplitThresholdInKB ao tamanho da RAM, reduzindo o número de processos svchost.exe em execução.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot',
    script: {
      snapshot: `[string](Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control' -Name SvcHostSplitThresholdInKB -ErrorAction SilentlyContinue).SvcHostSplitThresholdInKB`,
      apply: `$kb = [int64]((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1KB); New-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control' -Name SvcHostSplitThresholdInKB -Value ([int]$kb) -PropertyType DWord -Force | Out-Null`,
      revert: `New-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control' -Name SvcHostSplitThresholdInKB -Value $(if ($Snapshot) { [int64]$Snapshot } else { 3670016 }) -PropertyType DWord -Force | Out-Null`,
      check: `$kb = [int64]((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1KB); [int64](Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control').SvcHostSplitThresholdInKB -ge ($kb - 1024)`,
    },
  },
  serviceTweak({
    id: 'mem-sysmain-off', module: 'memory',
    name: 'Desativar SysMain (Superfetch)',
    description: 'Para o pré-carregamento de apps na RAM e a atividade de disco que ele gera. Em SSDs o ganho de inicialização dele é pequeno.',
    impact: 'low', risk: 'moderate',
  }, 'SysMain', { revertTo: 2 }),
  {
    id: 'mem-prefetch-off', module: 'memory',
    name: 'Desativar Prefetcher',
    description: 'EnablePrefetcher=0: evita gravações de rastreamento de inicialização. Indicado para SSDs rápidos.',
    impact: 'low', risk: 'moderate', admin: true, restart: 'reboot',
    registry: [reg(`${P.memMgmt}\\PrefetchParameters`, 'EnablePrefetcher', 0, 'DWord', 3)],
  },

  // ---------------- Armazenamento ----------------
  {
    id: 'storage-last-access-off', module: 'storage',
    name: 'Desativar carimbo de último acesso (NTFS)',
    description: 'O NTFS deixa de gravar a data de último acesso a cada leitura de arquivo, reduzindo escritas em disco.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot', tags: ['quick-win'],
    registry: [reg(`${HKLM}SYSTEM\\CurrentControlSet\\Control\\FileSystem`, 'NtfsDisableLastAccessUpdate', 0x80000001, 'DWord', 0x80000002)],
  },
  {
    id: 'storage-8dot3-off', module: 'storage',
    name: 'Desativar nomes curtos 8.3',
    description: 'Novos arquivos deixam de ganhar um nome curto legado (ex.: PROGRA~1), acelerando pastas com muitos arquivos.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: [reg(`${HKLM}SYSTEM\\CurrentControlSet\\Control\\FileSystem`, 'NtfsDisable8dot3NameCreation', 1, 'DWord', 2)],
  },
  {
    id: 'storage-trim-on', module: 'storage',
    name: 'Garantir TRIM ativo',
    description: 'Confere e ativa o TRIM (DisableDeleteNotify=0) para SSDs manterem o desempenho de escrita ao longo do tempo.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'none', tags: ['fix'],
    registry: [reg(`${HKLM}SYSTEM\\CurrentControlSet\\Control\\FileSystem`, 'DisableDeleteNotification', 0, 'DWord', 0)],
  },
  {
    id: 'storage-ahci-lpm-off', module: 'storage',
    name: 'Desativar economia de energia do link SATA (AHCI LPM)',
    description: 'Mantém o link SATA sempre ativo (HIPM/DIPM = Ativo). Evita micro-travadas quando o disco “acorda”.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    script: powerSetting(SUB_DISK, '0b2d69d7-a2a1-449c-9680-f91c70521c60', 0, null),
  },
  {
    id: 'storage-disk-idle-off', module: 'storage',
    name: 'Nunca desligar discos (na tomada)',
    description: 'Discos não entram em suspensão por inatividade, evitando a espera de alguns segundos para HDs voltarem a girar.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    script: powerSetting(SUB_DISK, 'DISKIDLE', 0, null),
  },
  {
    id: 'storage-reserved-off', module: 'storage',
    name: 'Desativar armazenamento reservado',
    description: 'Libera os ~7 GB que o Windows reserva para atualizações. Só é aplicado quando não há atualização pendente.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    script: {
      apply: 'Set-WindowsReservedStorageState -State Disabled',
      revert: 'Set-WindowsReservedStorageState -State Enabled',
      check: "(Get-WindowsReservedStorageState).ReservedStorageState -eq 'Disabled'",
    },
  },

  {
    id: 'storage-ntfs-memory', module: 'storage',
    name: 'Mais memória para o cache do NTFS',
    description: 'NtfsMemoryUsage=2 aumenta o pool de memória do NTFS — ajuda em pastas com muitos arquivos (bibliotecas de jogos, projetos).',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot', requires: { minRamGb: 16 },
    registry: [reg(`${HKLM}SYSTEM\\CurrentControlSet\\Control\\FileSystem`, 'NtfsMemoryUsage', 2)],
  },
  {
    id: 'storage-long-paths', module: 'storage',
    name: 'Permitir caminhos com mais de 260 caracteres',
    description: 'Evita erros ao extrair mods, projetos de programação e pastas muito aninhadas. Vale para os apps preparados para isso (a maioria dos modernos).',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: [reg(`${HKLM}SYSTEM\\CurrentControlSet\\Control\\FileSystem`, 'LongPathsEnabled', 1, 'DWord', 0)],
  },

  // ---------------- Tela ----------------
  {
    id: 'display-windowed-optimizations', module: 'display',
    name: 'Otimizações para jogos em janela',
    description: 'Usa o modelo flip moderno em jogos DX10/11 em janela/sem borda, reduzindo latência e permitindo VRR e Auto HDR.',
    impact: 'medium', risk: 'safe', admin: false, restart: 'none', requires: { win11: true }, tags: ['quick-win'],
    registry: [reg(`${HKCU}Software\\Microsoft\\DirectX\\UserGpuPreferences`, 'DirectXUserGlobalSettings', 'SwapEffectUpgradeEnable=1;', 'String')],
  },
  {
    id: 'display-vrr-on', module: 'display',
    name: 'Taxa de atualização variável para jogos sem suporte',
    description: 'Ativa o VRR do Windows para jogos DX11/12 que não oferecem G-Sync/FreeSync nativamente.',
    impact: 'low', risk: 'safe', admin: false, restart: 'none',
    registry: [reg(`${HKCU}Software\\Microsoft\\DirectX\\UserGpuPreferences`, 'DirectXUserGlobalSettings', 'SwapEffectUpgradeEnable=1;VRROptimizeEnable=1;', 'String')],
    conflicts: ['display-windowed-optimizations'],
  },
  {
    id: 'display-wallpaper-quality', module: 'display',
    name: 'Papel de parede sem compressão',
    description: 'JPEGImportQuality=100: o Windows para de recomprimir o papel de parede em 85% de qualidade.',
    impact: 'low', risk: 'safe', admin: false, restart: 'logoff',
    registry: [reg(P.desktop, 'JPEGImportQuality', 100)],
  },
  {
    id: 'display-fth-off', module: 'display',
    name: 'Desativar Fault Tolerant Heap',
    description: 'Impede o Windows de aplicar silenciosamente mitigações lentas a apps que já travaram antes (inclusive jogos).',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot',
    registry: [reg(`${HKLM}SOFTWARE\\Microsoft\\FTH`, 'Enabled', 0, 'DWord', 1)],
  },

  // ---------------- Energia ----------------
  {
    id: 'power-ultimate-plan', module: 'power',
    name: 'Plano de energia de desempenho máximo',
    description: `Cria e ativa o plano “${PLAN_NAME}” baseado no Desempenho Máximo. Ao reverter, o plano anterior volta a ficar ativo.`,
    impact: 'high', risk: 'safe', admin: true, restart: 'none', tags: ['quick-win'],
    script: {
      snapshot: `if ((powercfg /getactivescheme) -match '([0-9a-fA-F-]{36})') { $Matches[1] }`,
      apply: [
        `powercfg /list | Select-String '${PLAN_MATCH}' | ForEach-Object { if ($_ -match '([0-9a-fA-F-]{36})') { powercfg /delete $Matches[1] | Out-Null } }`,
        `$out = powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61`,
        `if ($out -notmatch '([0-9a-fA-F-]{36})') { $out = powercfg -duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c }`,
        `if ($out -notmatch '([0-9a-fA-F-]{36})') { throw 'Não foi possível criar o plano de energia.' }`,
        `$g = $Matches[1]`,
        `powercfg -changename $g '${PLAN_NAME}' | Out-Null`,
        `powercfg -setactive $g`,
      ].join('\n'),
      revert: [
        `if ($Snapshot) { powercfg -setactive $Snapshot } else { powercfg -setactive 381b4222-f694-41f0-9685-ff5bb260df2e }`,
        `powercfg /list | Select-String '${PLAN_MATCH}' | ForEach-Object { if ($_ -match '([0-9a-fA-F-]{36})') { powercfg /delete $Matches[1] | Out-Null } }`,
      ].join('\n'),
      check: `(powercfg /getactivescheme) -match '${PLAN_MATCH}'`,
    },
  },
  {
    id: 'power-fast-startup-off', module: 'power',
    name: 'Desativar Inicialização Rápida',
    description: 'Garante um desligamento completo: drivers e kernel recarregam do zero, evitando problemas que “sobrevivem” ao desligar.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: [reg(`${HKLM}SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power`, 'HiberbootEnabled', 0, 'DWord', 1)],
  },
  {
    id: 'power-hibernation-off', module: 'power',
    name: 'Desativar hibernação',
    description: 'Apaga o hiberfil.sys (vários GB). A Inicialização Rápida também deixa de funcionar.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none', requires: { desktop: true },
    script: {
      snapshot: `(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power').HibernateEnabled`,
      apply: 'powercfg /hibernate off',
      revert: `if ($Snapshot -ne '0') { powercfg /hibernate on }`,
      check: `(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power').HibernateEnabled -eq 0`,
    },
  },
  {
    id: 'power-pcie-aspm-off', module: 'power',
    name: 'Desativar economia de energia do PCI Express',
    description: 'Link State Power Management desligado na tomada: GPU e SSD NVMe não entram em estados de baixa energia do barramento.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    script: powerSetting('SUB_PCIEXPRESS', 'ASPM', 0, null),
  },
  {
    id: 'power-wifi-max', module: 'power',
    name: 'Wi-Fi em desempenho máximo',
    description: 'Adaptador sem fio no modo “Desempenho Máximo” na tomada, evitando picos de ping causados pela economia de energia.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'none', requires: { wifi: true },
    script: powerSetting('19cbb8fa-5279-450e-9fac-8a3d5fedd0c1', '12bbebe6-58d6-4636-95bb-3217ef867c1a', 0, null),
  },
];
