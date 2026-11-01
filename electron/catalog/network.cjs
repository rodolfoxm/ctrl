// Network area: basic, advanced optimizer and network privacy.
const { HKLM, P, reg, serviceTweak, adapterProperties, cmdletValue } = require('./helpers.cjs');

const IFACES = `${P.tcpip}\\Interfaces`;

module.exports = [
  // ---------------- Rede (básico) ----------------
  {
    id: 'net-nagle-off', module: 'network',
    name: 'Desativar algoritmo de Nagle',
    description: 'TcpAckFrequency=1 e TCPNoDelay=1 em todas as interfaces: pacotes TCP pequenos saem imediatamente. Ajuda jogos e apps que usam TCP.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot',
    script: {
      apply: `Get-ChildItem '${IFACES}' | ForEach-Object {
  New-ItemProperty -LiteralPath $_.PSPath -Name TcpAckFrequency -Value 1 -PropertyType DWord -Force | Out-Null
  New-ItemProperty -LiteralPath $_.PSPath -Name TCPNoDelay -Value 1 -PropertyType DWord -Force | Out-Null
}`,
      revert: `Get-ChildItem '${IFACES}' | ForEach-Object {
  Remove-ItemProperty -LiteralPath $_.PSPath -Name TcpAckFrequency -ErrorAction SilentlyContinue
  Remove-ItemProperty -LiteralPath $_.PSPath -Name TCPNoDelay -ErrorAction SilentlyContinue
}`,
      check: `@(Get-ChildItem '${IFACES}' | Where-Object { $_.GetValue('TCPNoDelay') -eq 1 }).Count -gt 0`,
    },
  },
  {
    id: 'net-delivery-optimization-off', module: 'network',
    name: 'Desativar compartilhamento P2P de atualizações',
    description: 'O Windows deixa de usar seu upload para enviar atualizações a outros PCs na internet.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'none', tags: ['quick-win'],
    registry: [reg(`${P.polWin}\\DeliveryOptimization`, 'DODownloadMode', 0)],
  },
  {
    id: 'net-autotuning-normal', module: 'network',
    name: 'Corrigir ajuste automático da janela TCP',
    description: 'Restaura o Receive Window Auto-Tuning para “Normal”. Ferramentas antigas costumam deixá-lo desativado, limitando downloads.',
    impact: 'medium', risk: 'safe', admin: true, restart: 'none', tags: ['fix'],
    script: cmdletValue(
      '(Get-NetTCPSetting -SettingName Internet).AutoTuningLevelLocal',
      'Set-NetTCPSetting -SettingName Internet -AutoTuningLevelLocal {v}',
      'Normal',
    ),
  },
  {
    id: 'net-rss-on', module: 'network',
    name: 'Ativar Receive Side Scaling (RSS)',
    description: 'Distribui o processamento de pacotes recebidos entre vários núcleos em vez de sobrecarregar o núcleo 0.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none', tags: ['fix'],
    script: cmdletValue(
      '(Get-NetOffloadGlobalSetting).ReceiveSideScaling',
      'Set-NetOffloadGlobalSetting -ReceiveSideScaling {v}',
      'Enabled',
    ),
  },
  {
    id: 'net-qos-reserve-off', module: 'network',
    name: 'Remover reserva de banda do agendador QoS',
    description: 'NonBestEffortLimit=0: nenhuma porcentagem de banda fica reservada para tráfego com prioridade QoS.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot',
    registry: [reg(`${P.polWin}\\Psched`, 'NonBestEffortLimit', 0)],
  },

  // ---------------- Otimizador avançado ----------------
  {
    id: 'netadv-interrupt-moderation-off', module: 'network-adv',
    name: 'Desativar moderação de interrupções da placa de rede',
    description: 'A placa avisa a CPU a cada pacote em vez de agrupar. Menor latência e jitter em troca de um pouco mais de uso de CPU.',
    impact: 'medium', risk: 'moderate', admin: true, restart: 'none',
    warn: 'A conexão de rede cai por alguns segundos enquanto o adaptador reinicia.',
    script: adapterProperties(['*InterruptModeration'], '0'),
  },
  {
    id: 'netadv-eee-off', module: 'network-adv',
    name: 'Desativar Ethernet com Eficiência Energética (EEE)',
    description: 'Impede que o link Ethernet entre em modo de baixa energia entre pacotes — fonte de picos de latência.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    warn: 'A conexão de rede cai por alguns segundos enquanto o adaptador reinicia.',
    script: adapterProperties(['*EEE', 'EEELinkAdvertisement', 'EnableGreenEthernet'], '0'),
  },
  {
    id: 'netadv-flow-control-off', module: 'network-adv',
    name: 'Desativar controle de fluxo',
    description: 'Evita que o switch/roteador pause o envio da placa de rede, o que causa atrasos curtos sob carga.',
    impact: 'low', risk: 'moderate', admin: true, restart: 'none',
    script: adapterProperties(['*FlowControl'], '0'),
  },
  {
    id: 'netadv-lso-off', module: 'network-adv',
    name: 'Desativar Large Send Offload',
    description: 'A CPU segmenta os pacotes grandes em vez da placa. Corrige lentidão e picos com alguns drivers.',
    impact: 'low', risk: 'moderate', admin: true, restart: 'none',
    script: adapterProperties(['*LsoV2IPv4', '*LsoV2IPv6'], '0'),
  },
  {
    id: 'netadv-time-wait', module: 'network-adv',
    name: 'Liberar portas TCP mais rápido',
    description: 'TcpTimedWaitDelay=30s (padrão 120s): conexões encerradas devolvem a porta antes.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot',
    registry: [reg(P.tcpip, 'TcpTimedWaitDelay', 30)],
  },
  {
    id: 'netadv-dns-negative-cache', module: 'network-adv',
    name: 'Não guardar falhas de DNS no cache',
    description: 'MaxNegativeCacheTtl=0: um site que falhou uma vez volta a ser resolvido na próxima tentativa.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: [reg(`${HKLM}SYSTEM\\CurrentControlSet\\Services\\Dnscache\\Parameters`, 'MaxNegativeCacheTtl', 0)],
  },
  {
    id: 'netadv-prefer-ipv4', module: 'network-adv',
    name: 'Preferir IPv4 em vez de IPv6',
    description: 'DisabledComponents=0x20: mantém o IPv6 ligado, mas usa IPv4 primeiro. Útil quando o IPv6 do provedor tem rotas piores.',
    impact: 'low', risk: 'moderate', admin: true, restart: 'reboot',
    registry: [reg(`${HKLM}SYSTEM\\CurrentControlSet\\Services\\Tcpip6\\Parameters`, 'DisabledComponents', 0x20)],
  },
  {
    id: 'netadv-heuristics-off', module: 'network-adv',
    name: 'Desativar heurísticas de escala da janela TCP',
    description: 'Impede que o Windows reduza a janela de recepção TCP por “heurística” em redes que ele julga problemáticas.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    script: cmdletValue(
      '(Get-NetTCPSetting -SettingName Internet).ScalingHeuristics',
      'Set-NetTCPSetting -SettingName Internet -ScalingHeuristics {v}',
      'Disabled',
    ),
  },

  {
    id: 'netadv-teredo-off', module: 'network-adv',
    name: 'Desativar túnel Teredo',
    description: 'Teredo encapsula IPv6 sobre IPv4 e pode desviar o tráfego por rotas piores. Desligá-lo evita esse caminho extra.',
    impact: 'low', risk: 'moderate', admin: true, restart: 'none',
    warn: 'O chat em grupo do app Xbox e alguns jogos com NAT do Xbox Live usam Teredo.',
    script: cmdletValue('(Get-NetTeredoConfiguration).Type', 'Set-NetTeredoConfiguration -Type {v}', 'Disabled'),
  },

  // ---------------- Privacidade de rede ----------------
  {
    id: 'netpriv-llmnr-off', module: 'net-privacy',
    name: 'Desativar LLMNR',
    description: 'Desliga a resolução de nomes por multicast na rede local, usada em ataques de captura de credenciais.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: [reg(`${HKLM}SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient`, 'EnableMulticast', 0)],
  },
  {
    id: 'netpriv-netbios-off', module: 'net-privacy',
    name: 'Desativar NetBIOS sobre TCP/IP',
    description: 'NetbiosOptions=2 em todas as interfaces. Reduz tráfego de broadcast e superfície de ataque na rede local.',
    impact: 'low', risk: 'moderate', admin: true, restart: 'none',
    warn: 'Pode afetar o acesso a compartilhamentos de redes muito antigas.',
    script: {
      snapshot: `$o = @(); Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces' | ForEach-Object { $o += [pscustomobject]@{ k = $_.PSPath; v = $_.GetValue('NetbiosOptions', 0) } }; ConvertTo-Json -InputObject @($o) -Compress`,
      apply: `Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces' | ForEach-Object { Set-ItemProperty -LiteralPath $_.PSPath -Name NetbiosOptions -Value 2 }`,
      revert: `if ($Snapshot) { foreach ($e in @($Snapshot | ConvertFrom-Json)) { Set-ItemProperty -LiteralPath $e.k -Name NetbiosOptions -Value $e.v } }`,
      check: `$i = @(Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces'); $i.Count -gt 0 -and @($i | Where-Object { $_.GetValue('NetbiosOptions', 0) -ne 2 }).Count -eq 0`,
    },
  },
  {
    id: 'netpriv-smb1-off', module: 'net-privacy',
    name: 'Desativar SMBv1',
    description: 'Desliga o protocolo de compartilhamento SMB 1.0, obsoleto e explorado por ransomwares como o WannaCry.',
    impact: 'low', risk: 'safe', admin: true, restart: 'reboot', tags: ['quick-win'],
    script: cmdletValue(
      '(Get-SmbServerConfiguration).EnableSMB1Protocol',
      'Set-SmbServerConfiguration -EnableSMB1Protocol ([bool]::Parse({v})) -Force -Confirm:$false',
      'False',
    ),
  },
  {
    id: 'netpriv-remote-assistance-off', module: 'net-privacy',
    name: 'Desativar Assistência Remota',
    description: 'Impede convites de Assistência Remota (não afeta a Área de Trabalho Remota).',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: [reg(`${HKLM}SYSTEM\\CurrentControlSet\\Control\\Remote Assistance`, 'fAllowToGetHelp', 0, 'DWord', 1)],
  },
  {
    id: 'netpriv-wifi-sense-off', module: 'net-privacy',
    name: 'Não conectar a hotspots sugeridos',
    description: 'Desativa a conexão automática a redes Wi-Fi abertas sugeridas pela Microsoft.',
    impact: 'low', risk: 'safe', admin: true, restart: 'none',
    registry: [reg(`${HKLM}SOFTWARE\\Microsoft\\PolicyManager\\default\\WiFi\\AllowAutoConnectToWiFiSenseHotspots`, 'value', 0, 'DWord', 1)],
  },
  serviceTweak({
    id: 'netpriv-remote-registry-off', module: 'net-privacy',
    name: 'Desativar Registro Remoto',
    description: 'Garante que nenhum computador da rede possa ler ou alterar seu registro remotamente.',
    impact: 'low', risk: 'safe',
  }, 'RemoteRegistry', { revertTo: 3 }),
];
