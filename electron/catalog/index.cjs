// Catalog index: tweak modules grouped into areas (same information architecture as
// the original app: Performance / Gaming / Network / System), one-shot repair actions
// and preset profiles.
const performance = require('./performance.cjs');
const gaming = require('./gaming.cjs');
const network = require('./network.cjs');
const system = require('./system.cjs');
const security = require('./security.cjs');

const MODULES = [
  { id: 'cpu', area: 'performance', label: 'CPU', icon: 'cpu', description: 'Estacionamento de núcleos, boost, estados de energia e agendamento.' },
  { id: 'gpu', area: 'performance', label: 'GPU', icon: 'monitor-cog', description: 'Agendamento por hardware, MPO, TDR e ajustes por fabricante.' },
  { id: 'memory', area: 'performance', label: 'Memória', icon: 'memory-stick', description: 'Compressão, paginação, SysMain e pré-carregamento.' },
  { id: 'storage', area: 'performance', label: 'Armazenamento', icon: 'hard-drive', description: 'NTFS, TRIM, energia de discos e espaço reservado.' },
  { id: 'display', area: 'performance', label: 'Tela', icon: 'monitor', description: 'Modelo de apresentação, VRR e qualidade de imagem.' },
  { id: 'power', area: 'performance', label: 'Energia', icon: 'zap', description: 'Plano de energia, hibernação e economia de barramento.' },
  { id: 'gaming', area: 'gaming', label: 'Otimizador de jogos', icon: 'gamepad-2', description: 'Modo de Jogo, Game DVR, MMCSS e tela cheia.' },
  { id: 'latency', area: 'gaming', label: 'Latência', icon: 'timer', description: 'Timer do kernel, agendador e fontes de clock.' },
  { id: 'input', area: 'gaming', label: 'Input lag', icon: 'mouse', description: 'Mouse, teclado e atalhos que atrapalham.' },
  { id: 'usb', area: 'gaming', label: 'USB', icon: 'usb', description: 'Suspensão seletiva e energia de dispositivos USB.' },
  { id: 'audio', area: 'gaming', label: 'Áudio', icon: 'volume-2', description: 'Atenuação, prioridade de áudio e sons do sistema.' },
  { id: 'priority', area: 'gaming', label: 'Prioridade de processos', icon: 'list-ordered', description: 'Processos de fundo com prioridade reduzida.' },
  { id: 'platforms', area: 'gaming', label: 'Plataformas', icon: 'store', description: 'Xbox, Microsoft Store e Discord.' },
  { id: 'network', area: 'network', label: 'Rede', icon: 'wifi', description: 'Nagle, P2P de atualizações e correções de TCP.' },
  { id: 'network-adv', area: 'network', label: 'Otimizador avançado', icon: 'network', description: 'Placa de rede, portas TCP e DNS.' },
  { id: 'net-privacy', area: 'network', label: 'Privacidade de rede', icon: 'shield', description: 'Protocolos legados e exposição na rede local.' },
  { id: 'privacy', area: 'system', label: 'Privacidade', icon: 'eye-off', description: 'Telemetria, anúncios, sugestões e coleta de dados.' },
  { id: 'visual', area: 'system', label: 'Visual', icon: 'sparkles', description: 'Efeitos, animações e transparência.' },
  { id: 'services', area: 'system', label: 'Serviços', icon: 'server', description: 'Serviços em segundo plano que podem ser desligados.' },
  { id: 'explorer', area: 'system', label: 'Explorer', icon: 'folder', description: 'Explorador de Arquivos e barra de tarefas.' },
  { id: 'startup', area: 'system', label: 'Inicialização', icon: 'rocket', description: 'Atrasos e pré-carregamentos no logon.' },
  { id: 'updates', area: 'system', label: 'Windows Update', icon: 'refresh-cw', description: 'Drivers automáticos, reinícios e adiamento de versões.' },
  { id: 'w11', area: 'system', label: 'Windows 11', icon: 'layout-grid', description: 'Copilot, Recall, Widgets, Iniciar e menu de contexto.' },
  { id: 'security', area: 'system', label: 'Segurança', icon: 'shield-check', description: 'Endurecimento do Windows: AutoRun, LSASS, acesso remoto, SmartScreen e regras ASR do Defender.' },
  { id: 'defender', area: 'system', label: 'Defender', icon: 'shield-half', description: 'Varreduras do Defender fora do seu caminho — sem desligar a proteção em tempo real.' },
  { id: 'notifications', area: 'system', label: 'Notificações', icon: 'bell-off', description: 'Pop-ups, tela de bloqueio, boas-vindas e avisos que roubam o foco.' },
  { id: 'boot', area: 'system', label: 'Boot', icon: 'power', description: 'Gerenciador de inicialização: tempo de menu, F8, animação e hypervisor.' },
  { id: 'features', area: 'system', label: 'Recursos do Windows', icon: 'puzzle', description: 'Componentes opcionais legados que podem ser removidos.' },
];

const TWEAKS = [...performance, ...gaming, ...network, ...system, ...security];

const ACTIONS = [
  {
    id: 'sfc', name: 'Verificar arquivos do sistema (SFC)', group: 'repair', admin: true, timeout: 1800000,
    description: 'Executa sfc /scannow para encontrar e reparar arquivos protegidos do Windows corrompidos. Leva de 5 a 15 minutos.',
    run: `$out = sfc /scannow | Out-String; $clean = ($out -replace "\\x00", ''); ($clean -split "\\r?\\n" | Where-Object { $_.Trim() } | Select-Object -Last 3) -join ' '`,
  },
  {
    id: 'chkdsk-scan', name: 'Verificar o disco do sistema (ChkDsk)', group: 'repair', admin: true, timeout: 3600000,
    description: 'chkdsk /scan: verificação online do NTFS no disco do Windows, sem reiniciar nem bloquear o disco. Se encontrar algo que só dá para reparar offline, avisa.',
    run: String.raw`chkdsk $env:SystemDrive /scan | Out-Null; $code = $LASTEXITCODE; if ($code -ge 3) { throw "O ChkDsk encontrou erros que precisam de reparo offline. Rode 'chkdsk $env:SystemDrive /spotfix' num terminal de administrador e reinicie." }; if ($code -eq 0) { 'Nenhum problema no sistema de arquivos' } else { 'Disco verificado; pequenos problemas corrigidos' }`,
  },
  {
    id: 'dism', name: 'Reparar imagem do Windows (DISM)', group: 'repair', admin: true, timeout: 3600000,
    description: 'DISM /RestoreHealth baixa e substitui componentes corrompidos da imagem do sistema. Rode antes do SFC se ele não conseguir reparar.',
    run: 'DISM /Online /Cleanup-Image /RestoreHealth | Out-Null; if ($LASTEXITCODE) { throw "DISM terminou com código $LASTEXITCODE" }; "Imagem do Windows reparada"',
  },
  {
    id: 'flush-dns', name: 'Limpar cache DNS', group: 'network', admin: false,
    description: 'Resolve sites que não abrem depois de trocar de DNS ou de rede.',
    run: 'Clear-DnsClientCache; "Cache DNS limpo"',
  },
  {
    id: 'reset-network', name: 'Redefinir pilha de rede', group: 'network', admin: true, restart: 'reboot',
    description: 'netsh winsock reset + netsh int ip reset. Corrige conexões quebradas por VPNs e programas antigos.',
    run: 'netsh winsock reset | Out-Null; netsh int ip reset | Out-Null; "Rede redefinida. Reinicie o PC."',
  },
  {
    id: 'restart-explorer', name: 'Reiniciar o Explorer', group: 'shell', admin: false,
    description: 'Aplica mudanças da barra de tarefas e do Explorer sem reiniciar o PC.',
    run: 'Stop-Process -Name explorer -Force; Start-Sleep -Milliseconds 800; if (-not (Get-Process explorer -ErrorAction SilentlyContinue)) { Start-Process explorer.exe }; "Explorer reiniciado"',
  },
  {
    id: 'rebuild-icon-cache', name: 'Reconstruir cache de ícones e miniaturas', group: 'shell', admin: false,
    description: 'Corrige ícones em branco ou errados e miniaturas desatualizadas.',
    run: String.raw`Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 600
Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Windows\Explorer" -Filter '*cache*.db' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\IconCache.db" -Force -ErrorAction SilentlyContinue
Start-Process explorer.exe
"Caches de ícones e miniaturas apagados"`,
  },
  {
    id: 'reset-windows-update', name: 'Redefinir componentes do Windows Update', group: 'repair', admin: true, timeout: 300000,
    description: 'Para os serviços de atualização, renomeia SoftwareDistribution e catroot2 e reinicia tudo. Corrige atualizações travadas.',
    run: String.raw`$svcs = 'wuauserv','bits','cryptsvc','msiserver'
Stop-Service $svcs -Force -ErrorAction SilentlyContinue
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
if (Test-Path "$env:SystemRoot\SoftwareDistribution") { Rename-Item "$env:SystemRoot\SoftwareDistribution" "SoftwareDistribution.bak$stamp" -ErrorAction SilentlyContinue }
if (Test-Path "$env:SystemRoot\System32\catroot2") { Rename-Item "$env:SystemRoot\System32\catroot2" "catroot2.bak$stamp" -ErrorAction SilentlyContinue }
Start-Service $svcs -ErrorAction SilentlyContinue
"Componentes do Windows Update redefinidos"`,
  },
  {
    id: 'store-reset', name: 'Limpar cache da Microsoft Store', group: 'repair', admin: false,
    description: 'Executa wsreset para corrigir downloads e atualizações da Store que não andam.',
    run: 'Start-Process wsreset.exe -Wait -WindowStyle Hidden; Get-Process WinStore.App -ErrorAction SilentlyContinue | Stop-Process -Force; "Cache da Store limpo"',
  },
  {
    id: 'time-sync', name: 'Sincronizar relógio', group: 'repair', admin: true,
    description: 'Força a sincronização com o servidor de horário. Relógio errado quebra login em jogos e sites.',
    run: 'Start-Service w32time -ErrorAction SilentlyContinue; w32tm /resync /force | Out-Null; "Relógio sincronizado: " + (Get-Date).ToString("HH:mm:ss")',
  },
  {
    id: 'trim-now', name: 'Otimizar SSDs agora (TRIM)', group: 'repair', admin: true, timeout: 600000,
    description: 'Envia TRIM para todos os SSDs e desfragmenta HDs (Optimize-Volume).',
    run: String.raw`$r = @(); Get-Volume | Where-Object { $_.DriveLetter -and $_.DriveType -eq 'Fixed' } | ForEach-Object { try { Optimize-Volume -DriveLetter $_.DriveLetter -ErrorAction Stop; $r += "$($_.DriveLetter):" } catch {} }; "Otimizado: " + ($r -join ', ')`,
  },
  {
    id: 'empty-recycle-bin', name: 'Esvaziar Lixeira', group: 'shell', admin: false,
    confirm: 'Os itens da Lixeira serão apagados permanentemente. Continuar?',
    description: 'Remove permanentemente os itens da Lixeira de todas as unidades.',
    run: 'Clear-RecycleBin -Force -ErrorAction SilentlyContinue; "Lixeira esvaziada"',
  },
];

/** Built-in profiles. `tweaks` are catalog ids; ids gated off on a machine are skipped. */
const PROFILES = [
  {
    id: 'competitive', name: 'Competitivo', icon: 'crosshair', accent: 'danger',
    description: 'Menor latência possível para FPS e jogos competitivos. Usa mais energia e esquenta mais em repouso.',
    tweaks: [
      'power-ultimate-plan', 'cpu-core-parking-off', 'cpu-boost-aggressive', 'cpu-epp-performance', 'cpu-power-throttling-off',
      'game-mode-on', 'game-dvr-off', 'game-mmcss-games', 'game-fse-legacy', 'latency-pri-sep-fixed', 'latency-global-timer',
      'latency-network-throttling-off', 'latency-platform-clock-fix', 'input-mouse-accel-off', 'input-sticky-keys-off',
      'input-lang-hotkey-off', 'usb-selective-suspend-off', 'usb-link-power-off', 'audio-ducking-off', 'net-nagle-off',
      'net-delivery-optimization-off', 'netadv-eee-off', 'storage-ahci-lpm-off', 'power-pcie-aspm-off', 'gpu-mpo-off',
      'display-windowed-optimizations', 'prio-onedrive-low', 'prio-compattel-idle', 'prio-updaters-low',
      'cpu-perf-ramp-fast', 'cpu-perf-hold', 'cpu-latency-hint', 'cpu-hybrid-pcores', 'cpu-max-freq-unlock',
      'def-scan-idle', 'def-quick-scan', 'platform-steam-helper-low', 'notif-toasts-off', 'boot-test-signing-off', 'boot-debug-off',
    ],
  },
  {
    id: 'balanced', name: 'Equilibrado', icon: 'scale', accent: 'accent',
    description: 'Ganhos seguros de desempenho e resposta sem aumentar consumo. Bom ponto de partida para qualquer PC.',
    tweaks: [
      'game-mode-on', 'game-dvr-off', 'game-mmcss-games', 'game-pri-sep-fps', 'cpu-power-throttling-off',
      'input-mouse-accel-off', 'input-sticky-keys-off', 'usb-selective-suspend-off', 'audio-ducking-off',
      'net-delivery-optimization-off', 'net-autotuning-normal', 'storage-last-access-off', 'storage-trim-on',
      'visual-menu-delay', 'explorer-show-extensions', 'priv-advertising-id-off', 'priv-suggestions-off',
      'display-windowed-optimizations', 'startup-delay-off', 'cpu-max-freq-unlock', 'cpu-hybrid-pcores',
      'def-scan-idle', 'notif-welcome-off', 'sec-autorun-off', 'sec-pua-on',
    ],
  },
  {
    id: 'privacy', name: 'Privacidade', icon: 'eye-off', accent: 'info',
    description: 'Corta telemetria, anúncios, rastreamento e recursos de IA na nuvem, sem mexer em desempenho.',
    tweaks: [
      'priv-telemetry-min', 'priv-telemetry-tasks-off', 'priv-telemetry-firewall', 'priv-advertising-id-off',
      'priv-activity-history-off', 'priv-tailored-off', 'priv-feedback-off', 'priv-inking-typing-off',
      'priv-app-launch-tracking-off', 'priv-online-speech-off', 'priv-error-reporting-off', 'priv-ceip-off',
      'priv-suggestions-off', 'priv-lockscreen-ads-off', 'priv-settings-suggestions-off', 'priv-web-search-off',
      'priv-cloud-clipboard-off', 'priv-edge-background-off', 'w11-copilot-off', 'w11-recall-off', 'w11-widgets-off',
      'w11-start-recommendations-off', 'netpriv-llmnr-off', 'netpriv-wifi-sense-off', 'priv-cross-device-off',
      'w11-suggested-actions-off', 'notif-welcome-off', 'notif-tips-off', 'notif-spotlight-off', 'notif-lockscreen-off', 'feat-recall-off',
      'priv-promoted-apps-off', 'priv-search-cloud-off', 'priv-handwriting-off', 'priv-app-inventory-off', 'priv-diag-extra-off',
      'priv-diag-tasks-off', 'priv-language-list-off', 'priv-edge-tracking-off', 'priv-office-telemetry-off', 'explorer-sync-ads-off',
      'explorer-news-interests-off', 'w11-ai-features-off',
    ],
  },
  {
    id: 'hardened', name: 'Segurança reforçada', icon: 'shield-check', accent: 'success',
    description: 'Fecha portas de entrada comuns de malware e roubo de senha sem afetar jogos: AutoRun, WDigest, acesso remoto, regras ASR e protocolos legados.',
    tweaks: [
      'sec-autorun-off', 'sec-wdigest-off', 'sec-restrict-anonymous', 'sec-winrm-off', 'sec-pua-on', 'sec-network-protection',
      'sec-asr-scripts', 'sec-asr-credentials', 'sec-asr-email-usb', 'sec-asr-adobe', 'netpriv-smb1-off', 'netpriv-llmnr-off',
      'netpriv-remote-registry-off', 'netpriv-remote-assistance-off', 'feat-powershell2-off', 'boot-test-signing-off', 'boot-debug-off', 'sec-wpbt-off',
    ],
  },
  {
    id: 'laptop', name: 'Notebook', icon: 'laptop', accent: 'success',
    description: 'Responsividade e jogos sem sacrificar a bateria: nada de CPU travada em 100% ou núcleos sempre ativos.',
    tweaks: [
      'game-mode-on', 'game-dvr-off', 'game-mmcss-games', 'audio-ducking-off', 'input-mouse-accel-off',
      'input-sticky-keys-off', 'net-delivery-optimization-off', 'storage-trim-on', 'visual-transparency-off',
      'visual-menu-delay', 'priv-advertising-id-off', 'priv-suggestions-off', 'prio-compattel-idle', 'startup-delay-off',
    ],
  },
  {
    id: 'lightweight', name: 'PC modesto', icon: 'feather', accent: 'warning',
    description: 'Para máquinas com pouca RAM ou CPU fraca: menos efeitos, menos serviços e menos processos em segundo plano.',
    tweaks: [
      'visual-best-performance', 'visual-transparency-off', 'visual-animations-off', 'visual-menu-delay',
      'svc-search-off', 'svc-rarely-used-off', 'svc-diag-hub-off', 'mem-svchost-split', 'priv-telemetry-min',
      'priv-telemetry-tasks-off', 'priv-edge-background-off', 'startup-edge-prelaunch-off', 'w11-widgets-off',
      'prio-searchindexer-low', 'prio-onedrive-low', 'game-mode-on', 'game-dvr-off', 'startup-delay-off',
    ],
  },
];

const QUICK_WINS = TWEAKS.filter((t) => t.tags?.includes('quick-win')).map((t) => t.id);

/** Whether a tweak applies to this machine, and why not when it doesn't. */
function gate(t, m) {
  const r = t.requires;
  if (!r || !m) return null;
  if (r.gpu && !m.gpuVendors?.includes(r.gpu)) return `Requer GPU ${r.gpu.toUpperCase()}`;
  if (r.win11 && !m.win11) return 'Requer Windows 11';
  if (r.win10 && m.win11) return 'Somente Windows 10';
  if (r.desktop && m.laptop) return 'Não recomendado para notebooks';
  if (r.laptop && !m.laptop) return 'Somente notebooks';
  if (r.wifi && !m.wifi) return 'Requer adaptador Wi-Fi';
  if (r.minRamGb && m.ramGb < r.minRamGb) return `Requer ${r.minRamGb} GB de RAM ou mais`;
  if (r.hybrid && !m.hybrid) return 'Requer CPU híbrida (Intel 12ª geração ou mais nova)';
  if (r.defender && !m.defender) return 'Requer o Microsoft Defender como antivírus ativo';
  return null;
}

function publicTweak(t, machine) {
  const { registry, script, afterApply, afterRevert, ...meta } = t;
  const mod = MODULES.find((m) => m.id === t.module);
  return {
    ...meta,
    area: mod?.area,
    kind: script ? 'script' : 'registry',
    verifiable: !script || script.check != null,
    changes: registry ? registry.map((r) => `${r.path}\\${r.name} = ${Array.isArray(r.value) ? `[${r.value.length} bytes]` : r.value}`) : [],
    hiddenReason: gate(t, machine),
  };
}

module.exports = {
  MODULES,
  TWEAKS,
  ACTIONS,
  PROFILES,
  QUICK_WINS,
  gate,
  publicTweak,
  findTweak: (id) => TWEAKS.find((t) => t.id === id),
  findAction: (id) => ACTIONS.find((a) => a.id === id),
  findProfile: (id) => PROFILES.find((p) => p.id === id),
};
