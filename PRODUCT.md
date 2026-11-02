# ctrl

## Problema e objetivo

Quem joga ou usa o PC para trabalho pesado no Windows aplica "tweaks" (registro, serviços, plano de energia) a partir de listas soltas na internet ou de otimizadores pagos que não dizem o que mudam e nem sempre desfazem direito. O ctrl aplica cada ajuste guardando antes o valor original, verifica depois se o Windows desfez algo e permite reverter qualquer alteração — uma por uma, por período ou tudo.

Nome e identidade visual seguem o guia de marca do ctrl (preto e cinzas carvão, tinta branca, acento ciano `#29CDF2`; vermelho só para erro). Até a versão 0.1 o app se chamava mojoTWEEKS; a 1.0 migra o estado e reconhece os objetos do Windows criados com o nome antigo.

## Público

Usuários de Windows 10/11 (principalmente gamers) que querem desempenho, privacidade e menos ruído do sistema, sem saber editar o registro. Um único papel: o dono do PC, rodando o app como administrador.

## Fluxos essenciais

| Fluxo | Entrada | Resultado esperado |
|---|---|---|
| Otimização recomendada | Visão geral › Otimizar agora | Cria ponto de restauração, aplica os tweaks "essenciais" seguros que faltam, mostra progresso e pontuação nova |
| Ajuste por módulo | Ajustes (Desempenho, Rede, Sistema, Hardware) ou Jogos › sub-aba › interruptor | Aplica/desfaz um tweak; tweaks "avançados" ou com ressalva pedem confirmação |
| Perfil | Perfis › Aplicar | Aplica um conjunto (Competitivo, Equilibrado, Privacidade, Notebook, PC modesto, Segurança reforçada ou personalizado) pulando o que não se aplica à máquina |
| Verificação | Verificação › Verificar agora | Relê cada tweak aplicado no sistema e marca verificado / desfeito pelo Windows / sem leitura; reaplica com um clique |
| Desfazer | Histórico › Central de desfazer | Restaura o valor original de um tweak, de tudo aplicado num período ou de tudo |
| Modo ao vivo | Jogos › Modo ao vivo › ativar + abrir um jogo da biblioteca | Prioridade alta, plano de alto desempenho e timer de 0,5 ms só durante a sessão; tudo restaurado ao fechar |
| Bandeja | Fechar a janela (opção "Manter na bandeja ao fechar", ligada por padrão) | O app continua rodando na bandeja com a Sentinela e o Modo ao vivo; o ícone reabre a janela e "Sair" encerra de vez |
| Atualização | Aviso na barra lateral › Baixar atualização | Abre a página da versão nova no GitHub; o usuário instala por cima, estado preservado |
| Ferramentas | Rede, Sistema, Hardware | Benchmark e troca de DNS reversível, latência/jitter, bufferbloat (latência sob carga, nota A+ a F), limpeza, Windows Update, apps de inicialização, MSI, DPC, saúde de disco/bateria, boot |

## Escopo atual

Catálogo de 241 tweaks em 28 módulos, 12 correções (SFC, DISM, ChkDsk, rede…) , 6 perfis prontos e remoção reversível de 95 apps pré-instalados (Microsoft, parceiros e fabricantes). Interface em pt-BR com a identidade do ctrl. Instalador NSIS em português, com termos de uso (isenção de responsabilidade) que precisam ser aceitos, e que sempre abre o app como administrador. Licença PolyForm Noncommercial 1.0.0. Código e versões em https://github.com/rodolfoxm/ctrl.

## Fora de escopo

Conta, ativação, telemetria, download ou instalação automática de atualizações, nuvem; captura de frametime (PresentMon), teste de banda (iperf3), S.M.A.R.T. via smartctl, escrita de BIOS; outros idiomas.

## Requisitos

- Nenhuma alteração sem backup: registro é snapshotado e restaurado exatamente; scripts guardam o próprio estado anterior.
- O renderer nunca envia scripts: só um nome de canal IPC e IDs; o processo principal procura o que executar no catálogo.
- Tweaks que não se aplicam ao hardware (GPU, CPU híbrida, notebook, Windows 11, Wi-Fi, RAM, Defender ativo) ficam ocultos, com o motivo.
- Sem telemetria. Acessos à rede: os testes pedidos pelo usuário (ping, DNS, bufferbloat nos servidores de teste da Cloudflare, até ~370 MB) e, se a opção estiver ligada (padrão), uma consulta à API de releases do GitHub ao abrir. Nada é baixado sem pedido.

## Restrições e decisões técnicas

Electron 33 + React 18 + Vite 5 em JavaScript (sem TypeScript), PowerShell 5.1 como executor, estado em JSON em `%APPDATA%\ctrl` (copiado uma vez de `%APPDATA%\mojoTWEEKS` na primeira abertura). Sem banco de dados: o estado é pequeno, local e de um único usuário. Detalhes em [docs/architecture.md](docs/architecture.md).

## Premissas e decisões pendentes

- A interface só é testável sem tocar no sistema pelo modo navegador (`npm run web`, backend simulado); aplicar tweaks exige administrador e muda o PC de verdade.
- Os arquivos acima de 350 linhas (`electron/main.cjs`, `electron/catalog/system.cjs`) ficam como dívida medida até existirem testes que cubram uma refatoração.

## Critérios de aceite

- `npm run verify` passa: lint sem erros, self-check das regras, catálogo válido (estrutura e sintaxe de todo PowerShell gerado) e build.
- `node scripts/smoke-readonly.cjs` roda todas as verificações e ferramentas somente leitura sem erro na máquina real.
- No modo navegador, as rotas principais renderizam sem erro de console.

## Manutenção

Atualize este documento quando objetivo, escopo, restrições ou critérios mudarem. Decisões técnicas ficam em `docs/architecture.md`; evidências do setup em `docs/setup.md`.
