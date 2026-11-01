// System area, second part: security hardening, Defender tuning (without turning it
// off), boot configuration, notifications and optional Windows features.
const { HKCU, HKLM, P, reg, serviceTweak, bcdValue, optionalFeature, asrRules, cmdletValue } = require('./helpers.cjs');

const LSA = `${HKLM}SYSTEM\\CurrentControlSet\\Control\\Lsa`;
const POL_EXPLORER_LM = `${HKLM}SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer`;
const POL_EXPLORER_CU = `${HKCU}Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer`;
const NOTIF = `${HKCU}Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings`;

/** Defender preference through Set-MpPreference, only offered when Defender is the active AV. */
function mpPref(base, prop, value, setExpr) {
  return {
    admin: true, restart: 'none', requires: { defender: true }, ...base,
    script: cmdletValue(`(Get-MpPreference).${prop}`, `Set-MpPreference -${prop} ${setExpr || '{v}'}`, value),
  };
}

/** ASR rule group (Block mode); requires Defender real-time protection. */
function asr(base, ids) {
  return { module: 'security', impact: 'low', admin: true, restart: 'none', requires: { defender: true }, ...base, script: asrRules(ids) };
}

module.exports = [
  // ---------------- Segurança ----------------
  {
    id: 'sec-autorun-off', module: 'security',
    name: 'Desativar AutoRun/AutoPlay de mídias',
    description: 'Pendrives e discos não executam nada sozinhos ao serem conectados — vetor clássico de malware.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none', tags: ['quick-win'],
    registry: [
      reg(POL_EXPLORER_LM, 'NoDriveTypeAutoRun', 255),
      reg(POL_EXPLORER_LM, 'NoAutorun', 1),
    ],
  },
  {
    id: 'sec-wdigest-off', module: 'security',
    name: 'Não guardar senhas em texto na memória (WDigest)',
    description: 'UseLogonCredential=0 garante que o WDigest não mantenha a senha de logon em texto claro na memória do LSASS.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot',
    registry: [reg(`${HKLM}SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\WDigest`, 'UseLogonCredential', 0)],
  },
  {
    id: 'sec-lsass-ppl', module: 'security',
    name: 'Proteger o LSASS (processo protegido)',
    description: 'RunAsPPL=1: o processo que guarda credenciais roda como Protected Process Light, bloqueando ferramentas de roubo de senha.',
    impact: 'low', risk: 'moderate', admin: true, restart: 'reboot',
    warn: 'Plugins antigos de autenticação (alguns leitores de impressão digital/smartcard) podem parar de funcionar.',
    registry: [reg(LSA, 'RunAsPPL', 1)],
  },
  {
    id: 'sec-restrict-anonymous', module: 'security',
    name: 'Bloquear enumeração anônima de contas e compartilhamentos',
    description: 'RestrictAnonymous=1 e RestrictAnonymousSAM=1: visitantes sem login não listam usuários nem pastas compartilhadas.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot',
    registry: [reg(LSA, 'RestrictAnonymous', 1, 'DWord', 0), reg(LSA, 'RestrictAnonymousSAM', 1, 'DWord', 1)],
  },
  {
    id: 'sec-rdp-off', module: 'security',
    name: 'Desativar Área de Trabalho Remota',
    description: 'Fecha a porta 3389 e recusa conexões RDP. Não afeta TeamViewer, AnyDesk ou Parsec.',
    impact: 'low', risk: 'moderate', admin: true, restart: 'none',
    registry: [reg(`${HKLM}SYSTEM\\CurrentControlSet\\Control\\Terminal Server`, 'fDenyTSConnections', 1, 'DWord', 0)],
  },
  serviceTweak({
    id: 'sec-winrm-off', module: 'security',
    name: 'Desativar Gerenciamento Remoto do Windows (WinRM)',
    description: 'Serviço de administração remota via PowerShell, inútil em PCs domésticos.',
    impact: 'low', risk: 'safe',
  }, 'WinRM'),
  {
    id: 'sec-smartscreen-block', module: 'security',
    name: 'SmartScreen: bloquear apps desconhecidos',
    description: 'Programas baixados sem reputação são bloqueados em vez de apenas mostrar um aviso que dá para ignorar.',
    impact: 'low', risk: 'moderate', admin: true, restart: 'none',
    registry: [
      reg(`${P.polWin}\\System`, 'EnableSmartScreen', 1),
      reg(`${P.polWin}\\System`, 'ShellSmartScreenLevel', 'Block', 'String'),
    ],
  },
  {
    id: 'sec-dep-optout', module: 'security',
    name: 'DEP para todos os programas (OptOut)',
    description: 'Prevenção de Execução de Dados ligada para todos os processos, exceto os que você excluir manualmente.',
    impact: 'low', risk: 'moderate', admin: true, restart: 'reboot',
    script: bcdValue('nx', 'OptOut'),
  },
  {
    id: 'sec-vbs-off', module: 'security',
    name: 'Desativar Segurança Baseada em Virtualização (VBS)',
    description: 'EnableVirtualizationBasedSecurity=0. Em alguns PCs devolve 5–10% de FPS, mas desliga HVCI, Credential Guard e proteções do kernel.',
    impact: 'medium', risk: 'advanced', admin: true, restart: 'reboot',
    warn: 'Reduz bastante a proteção contra malware de kernel. Alguns anti-cheats (Valorant/Vanguard, FACEIT) exigem VBS/HVCI ligados no Windows 11.',
    registry: [reg(`${HKLM}SYSTEM\\CurrentControlSet\\Control\\DeviceGuard`, 'EnableVirtualizationBasedSecurity', 0)],
  },
  {
    id: 'sec-pua-on', module: 'security',
    ...mpPref({ name: 'Bloquear apps potencialmente indesejados (PUA)', description: 'O Defender bloqueia adware, mineradores e “otimizadores” empacotados em instaladores.', impact: 'low', risk: 'safe', tags: ['quick-win'] }, 'PUAProtection', '1'),
  },
  {
    id: 'sec-network-protection', module: 'security',
    ...mpPref({ name: 'Proteção de rede do Defender', description: 'Bloqueia conexões de qualquer app com domínios e IPs maliciosos conhecidos (phishing, comando de malware).', impact: 'low', risk: 'safe' }, 'EnableNetworkProtection', '1'),
  },
  asr({
    id: 'sec-asr-office', name: 'ASR: blindar o Office contra macros maliciosas', risk: 'moderate',
    description: 'Bloqueia o Office de criar processos filhos, gravar executáveis, injetar código em outros processos e chamar APIs Win32 em macros.',
    warn: 'Suplementos e macros corporativas que fazem essas coisas deixam de funcionar.',
  }, ['d4f940ab-401b-4efc-aadc-ad5f3c50688a', '3b576869-a4ec-4529-8536-b80a7769e899', '75668c1f-73b5-4cf0-bb93-3ecf5cb7cc84', '92e97fa1-2edf-4476-bdd6-9dd0b4dddc7b']),
  asr({
    id: 'sec-asr-scripts', name: 'ASR: bloquear scripts ofuscados e downloads por JS/VBS', risk: 'safe',
    description: 'Impede scripts ofuscados e JavaScript/VBScript de iniciar executáveis baixados — técnica comum de loaders.',
  }, ['5beb7efe-fd9a-4556-801d-275e5ffc04cc', 'd3e037e1-3eb8-44c8-a917-57927947596d']),
  asr({
    id: 'sec-asr-credentials', name: 'ASR: proteger credenciais e bloquear drivers vulneráveis', risk: 'safe',
    description: 'Bloqueia roubo de credenciais do LSASS e o carregamento de drivers assinados conhecidos por vulnerabilidades (usados para desligar antivírus).',
  }, ['9e6c4e1f-7d60-472f-ba1a-a39ef669e4b2', '56a863a9-875e-4185-98a7-b882c64b5ce5']),
  asr({
    id: 'sec-asr-email-usb', name: 'ASR: e-mail, USB e persistência', risk: 'safe',
    description: 'Bloqueia executáveis vindos de clientes de e-mail, processos não assinados rodando de pendrives e persistência via assinaturas de eventos WMI.',
  }, ['be9ba2d9-53ea-4cdc-84e5-9b1eeee46550', 'b2b3f03d-6a65-4f7b-a9c7-1c7ef74a9ba4', 'e6db77e5-3df2-4cf1-b95a-636979351e5b']),
  asr({
    id: 'sec-asr-adobe', name: 'ASR: impedir o Adobe Reader de abrir processos', risk: 'safe',
    description: 'PDFs maliciosos não conseguem usar o Adobe Reader para iniciar outros programas.',
  }, ['7674ba52-37eb-4a4f-a9a1-f0f9a1619a2c']),

  // ---------------- Defender (sem desligar a proteção) ----------------
  {
    id: 'def-quick-scan', module: 'defender',
    ...mpPref({ name: 'Verificação agendada rápida em vez de completa', description: 'A varredura agendada termina em minutos em vez de horas, com a proteção em tempo real intacta.', impact: 'medium', risk: 'safe' }, 'ScanParameters', '1'),
  },
  {
    id: 'def-scan-3am', module: 'defender',
    ...mpPref({ name: 'Verificação agendada às 3h', description: 'Move a varredura para a madrugada, longe do horário em que você usa o PC.', impact: 'low', risk: 'safe' }, 'ScanScheduleTime', '03:00:00'),
  },
  {
    id: 'def-scan-idle', module: 'defender',
    ...mpPref({ name: 'Verificar só com o PC ocioso', description: 'A varredura agendada espera o PC ficar ocioso para começar.', impact: 'medium', risk: 'safe', tags: ['quick-win'] }, 'ScanOnlyIfIdleEnabled', 'True', '([bool]::Parse({v}))'),
  },
  {
    id: 'def-signature-8h', module: 'defender',
    ...mpPref({ name: 'Atualizar definições a cada 8 horas', description: 'Checagens de definições menos frequentes (o Windows Update também as entrega), reduzindo atividade de fundo.', impact: 'low', risk: 'moderate' }, 'SignatureUpdateInterval', '8'),
  },
  {
    id: 'def-exclude-games', module: 'defender',
    name: 'Excluir bibliotecas de jogos da verificação em tempo real',
    description: 'Adiciona as pastas de jogos da Steam e da Epic às exclusões do Defender: menos stutter ao carregar texturas e shaders.',
    impact: 'medium', risk: 'moderate', admin: true, restart: 'none', requires: { defender: true },
    warn: 'Arquivos nessas pastas deixam de ser verificados ao serem abertos. Instale jogos só de lojas confiáveis.',
    script: (() => {
      const find = String.raw`$dirs = @()
$steam = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction SilentlyContinue).SteamPath
if ($steam) {
  $steam = $steam -replace '/', '\'
  $libs = @($steam)
  $vdf = Join-Path $steam 'steamapps\libraryfolders.vdf'
  if (Test-Path $vdf) { foreach ($m in [regex]::Matches((Get-Content $vdf -Raw), '"path"\s+"([^"]+)"')) { $libs += ($m.Groups[1].Value -replace '\\\\', '\') } }
  foreach ($l in $libs | Select-Object -Unique) { $c = Join-Path $l 'steamapps\common'; if (Test-Path $c) { $dirs += (Resolve-Path $c).Path } }
}
$man = Join-Path $env:ProgramData 'Epic\EpicGamesLauncher\Data\Manifests'
if (Test-Path $man) { Get-ChildItem $man -Filter *.item | ForEach-Object { try { $loc = (Get-Content $_.FullName -Raw | ConvertFrom-Json).InstallLocation; if ($loc -and (Test-Path $loc)) { $dirs += (Split-Path $loc -Parent) } } catch {} } }
$dirs = @($dirs | Select-Object -Unique)`;
      return {
        snapshot: `${find}; $have = @((Get-MpPreference).ExclusionPath); (@($dirs | Where-Object { $have -notcontains $_ }) -join '|')`,
        apply: `${find}; if (-not $dirs.Count) { throw 'Nenhuma biblioteca da Steam ou Epic encontrada.' }; Add-MpPreference -ExclusionPath $dirs`,
        revert: `$add = @($Snapshot -split '\\|' | Where-Object { $_ }); if ($add.Count) { Remove-MpPreference -ExclusionPath $add -ErrorAction SilentlyContinue }`,
        check: `${find}; $have = @((Get-MpPreference).ExclusionPath); $dirs.Count -gt 0 -and @($dirs | Where-Object { $have -notcontains $_ }).Count -eq 0`,
      };
    })(),
  },

  // ---------------- Boot ----------------
  {
    id: 'boot-timeout-3', module: 'boot',
    name: 'Menu de boot em 3 segundos',
    description: 'Reduz o tempo de espera do Gerenciador de Inicialização (padrão 30 s quando há mais de um sistema).',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    script: bcdValue('timeout', '3', '{bootmgr}'),
  },
  {
    id: 'boot-legacy-menu', module: 'boot',
    name: 'Menu F8 clássico (Modo de Segurança rápido)',
    description: 'bootmenupolicy=Legacy: apertar F8 ao ligar abre o menu de opções avançadas, sem precisar de três boots com falha.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    script: bcdValue('bootmenupolicy', 'Legacy'),
  },
  {
    id: 'boot-ux-off', module: 'boot',
    name: 'Desativar animação de boot',
    description: 'bootux=disabled: sem o logo e a animação de carregamento do Windows durante a inicialização.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot',
    script: bcdValue('bootux', 'disabled'),
  },
  {
    id: 'boot-test-signing-off', module: 'boot',
    name: 'Garantir que drivers de teste estão desativados',
    description: 'testsigning=No: impede carregar drivers sem assinatura válida (deixado ligado por alguns programas de mod/cheat). Anti-cheats exigem desligado.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot', tags: ['fix'],
    script: bcdValue('testsigning', 'No'),
  },
  {
    id: 'boot-debug-off', module: 'boot',
    name: 'Garantir que a depuração do kernel está desativada',
    description: 'debug=No: o kernel não inicializa transporte de depuração, que adiciona sobrecarga e é bloqueado por anti-cheats.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot', tags: ['fix'],
    script: bcdValue('debug', 'No'),
  },
  {
    id: 'boot-hypervisor-off', module: 'boot',
    name: 'Não carregar o hypervisor (Hyper-V)',
    description: 'hypervisorlaunchtype=Off: o Windows roda direto no hardware, sem a camada de virtualização. Pode reduzir latência em jogos.',
    impact: 'medium', risk: 'advanced', admin: true, restart: 'reboot',
    warn: 'Desliga WSL 2, Docker, máquinas virtuais Hyper-V, Windows Sandbox, VBS/HVCI e o subsistema Android.',
    script: bcdValue('hypervisorlaunchtype', 'Off'),
  },

  // ---------------- Notificações ----------------
  {
    id: 'notif-toasts-off', module: 'notifications',
    name: 'Desativar notificações pop-up',
    description: 'Nenhum app mostra banners no canto da tela (as notificações continuam na central).',
    impact: 'medium', risk: 'moderate', admin: false, restart: 'none',
    registry: [reg(`${HKCU}Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications`, 'ToastEnabled', 0, 'DWord', 1)],
  },
  {
    id: 'notif-lockscreen-off', module: 'notifications',
    name: 'Sem notificações na tela de bloqueio',
    description: 'Mensagens e lembretes não aparecem para quem olhar o PC bloqueado.',
    impact: 'low', risk: 'safe', admin: false, restart: 'none',
    registry: [reg(NOTIF, 'NOC_GLOBAL_SETTING_ALLOW_TOASTS_ABOVE_LOCK', 0, 'DWord', 1)],
  },
  {
    id: 'notif-welcome-off', module: 'notifications',
    name: 'Sem telas de boas-vindas após atualizações',
    description: 'Desliga “Veja as novidades” e “Vamos terminar de configurar seu dispositivo” depois de updates.',
    impact: 'low', risk: 'safe', admin: false, restart: 'none', tags: ['quick-win'],
    registry: [
      reg(P.cdm, 'SubscribedContent-310093Enabled', 0, 'DWord', 1),
      reg(`${HKCU}Software\\Microsoft\\Windows\\CurrentVersion\\UserProfileEngagement`, 'ScoobeSystemSettingEnabled', 0, 'DWord', 1),
    ],
  },
  {
    id: 'notif-tips-off', module: 'notifications',
    name: 'Sem notificações de dicas e sugestões',
    description: 'Desliga as notificações “sugeridas” do Windows (apps para experimentar, recursos para ativar).',
    impact: 'low', risk: 'safe', admin: false, restart: 'none',
    registry: [reg(`${NOTIF}\\Windows.SystemToast.Suggested`, 'Enabled', 0, 'DWord', 1)],
  },
  {
    id: 'notif-spotlight-off', module: 'notifications',
    name: 'Desativar Windows Spotlight na tela de bloqueio',
    description: 'Para de baixar imagens rotativas e “curiosidades” para a tela de bloqueio (use uma imagem fixa).',
    impact: 'low', risk: 'safe', admin: false, restart: 'none',
    registry: [reg(P.cdm, 'RotatingLockScreenEnabled', 0, 'DWord', 1)],
  },
  {
    id: 'notif-low-disk-off', module: 'notifications',
    name: 'Sem avisos de pouco espaço em disco',
    description: 'O Explorer para de checar periodicamente e avisar sobre discos quase cheios (útil para discos de jogos sempre cheios).',
    impact: 'low', risk: 'safe', admin: false, restart: 'explorer',
    registry: [reg(POL_EXPLORER_CU, 'NoLowDiskSpaceChecks', 1)],
  },

  // ---------------- Recursos do Windows ----------------
  {
    id: 'feat-powershell2-off', module: 'features',
    name: 'Remover PowerShell 2.0',
    description: 'Motor antigo sem os recursos de segurança das versões novas, usado para burlar logs. O PowerShell 5.1 continua.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none', timeout: 600000,
    script: optionalFeature(['MicrosoftWindowsPowerShellV2Root', 'MicrosoftWindowsPowerShellV2']),
  },
  {
    id: 'feat-xps-off', module: 'features',
    name: 'Desativar Serviços XPS',
    description: 'Suporte a impressão em formato XPS, raramente usado.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none', timeout: 600000,
    script: optionalFeature('Printing-XPSServices-Features'),
  },
  {
    id: 'feat-workfolders-off', module: 'features',
    name: 'Desativar cliente de Pastas de Trabalho',
    description: 'Sincronização de arquivos corporativa (Work Folders), inútil fora de empresas.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none', timeout: 600000,
    script: optionalFeature('WorkFolders-Client'),
  },
  {
    id: 'feat-fax-off', module: 'features',
    name: 'Desativar Fax e Digitalização do Windows',
    description: 'Componente de fax legado.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none', timeout: 600000,
    script: optionalFeature('FaxServicesClientPackage'),
  },
  {
    id: 'feat-wmp-off', module: 'features',
    name: 'Desativar Windows Media Player clássico',
    description: 'Remove o Media Player antigo (o novo app Media Player continua). Alguns programas antigos usam os componentes dele.',
    impact: 'low', risk: 'moderate', admin: true, restart: 'reboot', timeout: 600000,
    script: optionalFeature('WindowsMediaPlayer'),
  },
  {
    id: 'feat-recall-off', module: 'features',
    name: 'Remover o recurso Recall',
    description: 'Desinstala o componente opcional Recall (PCs Copilot+), além de desativá-lo por política.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot', requires: { win11: true }, timeout: 600000,
    script: optionalFeature('Recall'),
  },
  {
    id: 'feat-smb-direct-off', module: 'features',
    name: 'Desativar SMB Direct',
    description: 'Compartilhamento de arquivos via RDMA para servidores corporativos; nenhuma placa doméstica usa.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none', timeout: 600000,
    script: optionalFeature('SmbDirect'),
  },
];
