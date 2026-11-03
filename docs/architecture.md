# Código e arquitetura

## Stack real

| Camada | Tecnologia | Versão (package-lock) |
|---|---|---|
| Shell | Electron (janela sem moldura, `contextIsolation`, `sandbox`) | 33.x |
| Interface | React + react-router-dom (HashRouter) + lucide-react | React 18.3, router 6.28 |
| Build | Vite + @vitejs/plugin-react | Vite 5.4 |
| Execução no sistema | Windows PowerShell 5.1 via `child_process` | do Windows |
| Instalador | electron-builder → NSIS (`requireAdministrator`) | 25.x |
| Lint | ESLint flat config + eslint-plugin-react-hooks + regras do toolkit | ESLint 10.13 |

JavaScript puro (CommonJS no processo principal, ESM no renderer). Node 24 e npm 12 na máquina de desenvolvimento.

## Mapa do código

```
electron/
  main.cjs          janela, ícone na bandeja (fechar só esconde, se closeToTray), ~80 canais IPC, modo headless --task=clean|repair, Sentinela
  preload.cjs       ponte window.ctrl.invoke/on com allowlist de canais e eventos
  engine.cjs        aplica/reverte com snapshot, conflitos, lotes, verificação de drift
  ps.cjs            runPowerShell/runJson/streamPowerShell (EncodedCommand ou .ps1 temporário)
  store.cjs         estado JSON em %APPDATA%\ctrl\state.json (migra o de %APPDATA%\mojoTWEEKS)
  updates.cjs       consulta a última release em github.com/rodolfoxm/ctrl e abre a página dela
  machine.cjs       perfil da máquina que oculta tweaks (GPU, CPU híbrida, notebook, Defender…)
  livegame.cjs      Modo ao vivo (polling de processos a cada 5 s)
  batuta.cjs        Core (nome interno batuta): worker PowerShell contínuo (regras, contenção, limpeza da lista de espera) + plano por atividade e núcleos
  batuta-worker.cjs script do worker: regras, detecção de jogos por pasta, Vigia, contenção e limpeza de memória
  batuta-native.cjs helper C# (Add-Type) com as APIs de agendador, energia e lista de memória
  batuta-presets.cjs jogos conhecidos e o assistente que monta a configuração
  hardware.cjs      especificações (CIM) e monitor ao vivo (PDH com nomes em inglês)
  backups.cjs games.cjs debloat.cjs
  catalog/          dados: helpers.cjs + performance/gaming/network/system/security.cjs + index.cjs
  tools/            network, bufferbloat (latência TCP sob carga, Cloudflare), cleaner, system (WU, startup, timer, MSI, DPC), health, scheduler
src/
  main.jsx          rotas; context.jsx estado global, toasts, confirmações, lotes
  nav.js            barra lateral e áreas/sub-abas; modulePath()
  components/       Shell, TweakList, ModuleView, GlobalSearch, Page, ui, Onboarding…
  pages/  views/    telas e ferramentas
  lib/              api.js (ponte ou mock), mock.js, format.js, icons.js, catalog.snapshot.json (gerado)
scripts/            check-catalog, smoke-readonly, export-catalog, make-brand.mjs (+ brand/), screenshots.mjs, verify-quality-rules
eslint-rules/       regras do toolkit (max-lines etc.)
```

## Fronteiras e fluxo

1. A interface chama `call('canal', ...ids)` (`src/lib/api.js`). No Electron vai pela ponte `window.ctrl`; no navegador, para `lib/mock.js`.
2. `preload.cjs` só aceita nomes no formato `area:acao` e só repassa eventos conhecidos.
3. `main.cjs` resolve IDs no catálogo (`catalog.findTweak`) e chama o motor ou a ferramenta. Nenhum texto de script vem do renderer.
4. `engine.cjs` monta o PowerShell: `registry[]` vira `Set-Val` com snapshot `Get-Snap` antes; `script{snapshot,apply,revert,check}` usa o próprio snapshot (string ou JSON). O resultado e o snapshot vão para `store.cjs`.
5. Verificação: `checkMany` roda as expressões `check` em lotes de 40; ilegível = `null` (ex.: cmdlets que exigem admin).

## Dados

Sem banco. `state.json` guarda `applied` (id → snapshot, data, origem), histórico (500), varreduras, sessões de jogo, perfis personalizados, DNS anterior e configurações. Escrita atômica (arquivo `.tmp` + rename).

## Decisões

| Decisão | Motivo | Revisitar quando |
|---|---|---|
| Electron em vez de Tauri (original) | Sem toolchain Rust na máquina; mesmo padrão do BarraTweaks | Precisar de binário menor |
| Snapshot antes de aplicar, restauração exata | Desfazer confiável mesmo para valores que já existiam | — |
| Script grande → `.ps1` temporário com BOM | `-EncodedCommand` passa de 32K caracteres e falha (ENAMETOOLONG) | — |
| `powercfg /qh` nas leituras | `/q` não lista configurações ocultas (CPMINCORES, PERFBOOSTMODE…) | — |
| Leituras de `bcdedit` falham sem admin | "Sem leitura" é mais honesto que "inativo" | — |
| IFEO só com nomes de executável específicos | A regra vale para qualquer exe com o mesmo nome (ex.: `Agent.exe` foi rejeitado) | — |
| Bufferbloat mede o handshake TCP com 1.1.1.1:443, não ICMP | Funciona sem administrador e sem depender de ping liberado; a carga vem dos endpoints públicos de teste da Cloudflare com limite de tempo e de dados (250 MB down, 120 MB up) | Houver um servidor de teste próprio |
| Fora de propósito (comparado a Paragon, winutil, optimizerDuck e O&O ShutUp10): bloquear o Windows Update, desligar mitigações de processo (`Set-ProcessMitigation`), baixar drivers/DDU/runtimes, mexer na BIOS, travar P-states/power gating da GPU, pôr ~200 serviços em manual de uma vez, desligar MAPS/envio de amostras do Defender, remover Edge/OneDrive à força, desativar IPv6 e políticas que só valem no Enterprise/Education (ex.: esconder "Recomendados" via `IsEducationEnvironment`) | Deixam o PC menos seguro, baixam executáveis de terceiros ou não têm desfazer confiável | Houver como fazer com backup e revert verificáveis |
| O Core roda num worker PowerShell que lê "stop" do stdin | Um processo só, com o helper C# compilado uma vez; stdin fechado (ctrl morreu) também encerra e devolve a prioridade do que foi contido | Houver um serviço nativo |
| Aplicar confere o estado antes (`checkMany`, uma leitura por lote) e pula o que já vale | Reaplicar o que já está ativo pedia reinício sem mudar nada e reescrevia valores que o Windows trava (bcdedit sob Secure Boot) | — |
| O Core detecta jogos pelo caminho do executável (pastas das lojas e biblioteca), uma vez por processo | O Process Lasso só reconhece o que foi cadastrado; o caminho vem do Windows (QueryFullProcessImageName), sem abrir a memória do jogo | Surgir uma loja nova com pasta própria |
| Vigia só com ações reversíveis; SmartTrim e prioridade por thread ficaram de fora | Fechar processo perde trabalho; aparar a memória causa travadas em jogos; threads mudam a cada execução e mexer nelas é o acesso que anti-cheats vigiam | — |
| O Core não troca plano durante o Modo ao vivo | O Modo ao vivo já é dono do plano e do timer durante a sessão; dois donos se desfariam | Os dois virarem um só |
| O Core só usa agendador e energia (prioridade, afinidade, E/S, GPU, EcoQoS, lista de espera) | É o que o Process Lasso faz (lido nas importações dele); handles nunca pedem leitura ou escrita de memória, então anti-cheats não têm o que acusar | — |
| Atualização só avisa e abre a página da release | Sem assinatura de código, auto-update silencioso seria frágil e pouco transparente; instalar por cima preserva o estado | Houver assinatura e canal de update |
| Nomes de objetos do Windows com legado (`catalog/constants.cjs`) | O plano de energia e a regra de firewall criados como "mojoTWEEKS" continuam reconhecidos por `check` e `revert` | Ninguém mais tiver a versão 0.1 |
| Mock do navegador usa o catálogo real exportado | Desenvolver a UI sem tocar no sistema | Catálogo mudar: rode `scripts/export-catalog.cjs` |

## Formato de um tweak

```js
{
  id: 'meu-tweak', module: 'gaming', name: '…', description: '…',
  impact: 'low|medium|high', risk: 'safe|moderate|advanced', admin: true,
  restart: 'none|explorer|logoff|reboot',
  registry: [reg('HKCU:\\…', 'Valor', 1)],         // snapshot e restauração automáticos
  // ou script: { snapshot, apply, revert, check }  // $Snapshot disponível no revert
  requires: { gpu: 'nvidia', win11: true, win10: true, desktop: true, wifi: true, minRamGb: 16, hybrid: true, defender: true },
  conflicts: ['outro-id'], warn: 'texto mostrado antes de aplicar', tags: ['quick-win' | 'fix'],
}
```

Depois de editar o catálogo: `npm run check` e `node scripts/export-catalog.cjs`.

## Dívida medida

`electron/main.cjs` (497 linhas) e `electron/catalog/system.cjs` (632), além de `gaming.cjs` e `performance.cjs` (~365), passam da referência de 350 linhas (`quality/max-lines` em *warn*). Plano: separar os handlers IPC de `main.cjs` por domínio e dividir `system.cjs` por módulo, quando houver teste de regressão dos canais. Contagens em [quality.md](quality.md).

## Manutenção

Atualize este mapa quando diretórios, dependências relevantes, contratos IPC ou fronteiras mudarem.
