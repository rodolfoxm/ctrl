# Changelog

## 1.6.1 — 10/11/2026

- **Core mais leve durante os jogos.** Medido lado a lado, cada passada do Core gasta cerca de 40% menos CPU (de ~31 ms para ~19 ms). Com um jogo aberto, ele passa a olhar os processos a cada 5 segundos em vez de 2, roda com prioridade abaixo do normal e em modo de eficiência, para nunca disputar a CPU com o jogo.
- **Core sem leitura de memória dos jogos.** Para descobrir a pasta de um jogo, o Core abria o processo com permissão de leitura de memória (é o que o PowerShell faz por baixo). Agora usa só a consulta limitada do Windows, como sempre foi a intenção. Prioridade e núcleos também passam a ser lidos e mudados com o mínimo de permissão.
- **Limpeza de memória sem travadas no jogo.** Durante um jogo, a lista de espera é limpa no máximo uma vez a cada 5 minutos (antes podia ser a cada 10 segundos). O assistente do Core não liga mais a limpeza em PCs com 32 GB ou mais.

## 1.6.0 — 10/11/2026

- **Diagnóstico da Saúde do sistema.** Clique na nota ou em "Ver diagnóstico" para ver o que tira pontos, quanto cada item pesa, o que já está em dia e o que depende de você, com o atalho para resolver.
- **Otimizar agora, do começo ao fim.** Mostra os ajustes que serão aplicados antes de mexer em qualquer coisa, aplica com backup, confere no sistema e mostra a nota antes e depois, lida de novo do Windows. Dá para desfazer ali mesmo, e o que falhar aparece com o motivo.
- **Core ligado por padrão** em instalações novas, se nenhum programa que briga com ele estiver aberto. Quem já usa o ctrl continua como estava.
- **Sua máquina** mostra os dois discos principais e "+N dispositivos", que abre a lista completa. A Saúde dos discos passou a mostrar espaço usado e livre de cada disco físico.
- Animações mais suaves: cartões que entram em sequência, janelas, botões e a nota que conta até o valor. Tudo respeita a opção do Windows de reduzir movimento.

## 1.5.0 — 05/11/2026

- **Saúde dos discos com as regras do CrystalDiskInfo.** O ctrl agora lê os limites definidos pelo fabricante e avalia cada disco do mesmo jeito: Saudável, Atenção, Com problemas ou Desconhecido. Cada disco ganhou "Todos os atributos", com atual, pior, limite e valor bruto. A vida útil de SSDs SATA cobre mais marcas.

## 1.4.1 — 05/11/2026

- **Saúde dos discos corrigida.** O Windows dizia 100% de vida útil e não mostrava as horas em muitos SSDs NVMe, e o ctrl mostrava vida útil até em HDs. Agora a leitura vem direto do disco: vida útil real, horas ligado, erros de mídia e ciclos. A "máx. registrada" saiu, porque era o limite do disco, não uma medição.
- **Aviso de versão nova mais confiável.** Antes o ctrl só procurava ao abrir: quem deixa na bandeja não via a versão nova, e sem internet ao ligar o PC a busca falhava sem tentar de novo. Agora ele procura a cada 30 minutos enquanto estiver aberto.
- **Tutorial.** Depois da primeira configuração, um tour passa por todas as partes do ctrl, com "Próximo" e "Pular tutorial". Dá para rever em Guia → Ver o tutorial.

## 1.4.0 — 05/11/2026

- **Primeira configuração guiada.** Na primeira abertura, o ctrl pergunta o que você joga, confere se Process Lasso, ParkControl ou ISLC estão abertos, escolhe a rede de segurança e mostra tudo antes de aplicar: a configuração do Core e os ajustes essenciais.
- **Verificar e reparar na Visão geral.** Quando o Windows desfaz um ajuste, o alerta agora traz um botão que confere de novo e reaplica ali mesmo, e outro que leva para a Verificação.

## 1.3.1 — 04/11/2026

- **Cor nova e do seu jeito.** O destaque do ctrl agora é verde-limão (#C8FF00), e dá para trocar em Configurações → Aparência: rosa, laranja, lilás, ciano, branco ou qualquer outra cor.
- **Saúde do sistema** virou uma barra contínua, com um pulso leve na ponta.
- Nova animação de abertura.
- O instalador passa a ser gerado pelo GitHub Actions a partir do código do repositório.

## 1.3.0 — 04/11/2026

- **Atualização dentro do app.** Quando sai versão nova, aparece "Nova versão" ao lado de Administrador e uma janela ao abrir o ctrl, com as novidades dela e das duas versões anteriores (as mais antigas ficam no GitHub).
- **Instalar agora:** baixa o instalador direto do GitHub, confere o tamanho e a assinatura SHA-256 publicada lá, abre o instalador e fecha o ctrl. Antes era preciso baixar pelo navegador.
- A janela aparece uma vez por abertura enquanto houver versão nova; "Agora não" fecha até a próxima vez.

## 1.2.2 — 04/11/2026

- **Instalador:** nova etapa "Iniciar o ctrl com o Windows", já marcada. Cria a inicialização durante a instalação, quando você acabou de autorizar como administrador. Desinstalar remove as tarefas do ctrl (atualizar não).
- **Antivírus que bloqueia em silêncio:** alguns antivírus (o Kaspersky, por exemplo) restringem programas sem assinatura paga e descartam o que eles gravam, sem erro. Agora o ctrl confere cada gravação e, se ela não ficou, mostra um aviso no topo dizendo qual antivírus está bloqueando e como liberar.
- "Iniciar com o Windows" confere se a tarefa foi criada de verdade. Se o antivírus barrar, o botão volta para desligado e explica o motivo, em vez de ficar ligado sem funcionar. O botão também passa a refletir a tarefa real ao abrir o app.
- Corrigido: a tarefa de inicialização tinha limite de 30 minutos, e o Windows podia encerrar o ctrl aberto pela inicialização depois desse tempo.

## 1.2.1 — 03/11/2026

- Corrigido: aplicar um perfil (ou a otimização recomendada) de novo pedia para reiniciar o PC mesmo sem mudar nada. Agora o ctrl confere antes e só aplica o que ainda não está valendo; o que já estava fica como está e não pede reinício.
- Corrigido: "Garantir que a depuração do kernel está desativada" e "Garantir que drivers de teste estão desativados" falhavam com "bcdedit falhou" em PCs com Secure Boot, que já mantém os dois desligados e bloqueia a mudança. Como já estão como deveriam, o ctrl não tenta mais escrever.

## 1.2.0 — 03/11/2026

- **Core**, nova página para reger os processos:
  - **Regras** por programa: prioridade, só P-cores ou só E-cores, prioridade de E/S e de GPU e modo de eficiência, aplicadas sempre que o programa abre.
  - **Jogos detectados sozinhos:** tudo que roda das pastas de jogos da Steam, Epic, Xbox, EA, Ubisoft, Riot e Battle.net, da biblioteca do ctrl ou da lista do assistente ganha a regra de jogo, sem cadastrar nada. Launchers, anti-cheats e relatórios de erro ficam de fora.
  - **Vigia:** se um programa escolhido passar do limite de CPU ou de memória por um tempo, recebe uma ação reversível (baixar a prioridade, ir para os E-cores ou só avisar), desfeita quando ele se acalma. Nunca fecha programas.
  - **Contenção:** programas em segundo plano que exageram descem de prioridade enquanto a CPU está carregada e voltam sozinhos.
  - **Memória:** limpa a lista de espera quando ela cresce e a memória livre acaba, só durante os jogos se você quiser.
  - **Núcleos:** quanto do processador fica sempre acordado e plano de energia que muda quando você para de usar o PC.
  - **Assistente:** pergunta o que você joga (CS2, VALORANT, Warzone, Fortnite e outros) e monta a configuração certa para cada combinação.
  - Só usa o agendador e a energia do Windows, sem tocar na memória dos jogos. Avisa se Process Lasso, ParkControl ou ISLC estiverem abertos.
- Corrigido: o texto "Ativo" ao lado dos ajustes e os selos de sucesso ainda saíam em rosa, resto da cor antiga. Agora usam o ciano.
- A busca (Ctrl+K) encontra as abas do Core e o Agendador, o Guia e o Sobre; procurar "Process Lasso", "ISLC", "memória" ou "apoiar" leva direto ao lugar certo.
- Sobre: cartão **Apoiar o desenvolvimento**, que abre a página de apoio no site. É opcional e não muda nada no app.

## 1.1.0 — 02/11/2026

### Novidades

- **Ícone na bandeja.** Fechar a janela deixa o ctrl rodando em segundo plano, com a Sentinela e o Modo ao vivo ativos. Clique no ícone para reabrir; "Sair" no menu encerra. Dá para desligar em Configurações › Geral ("Manter na bandeja ao fechar").
- **Animação de abertura** ao iniciar o app. Um clique ou qualquer tecla pula, e dá para desligar em Configurações › Geral.
- **Teste de bufferbloat** em Ajustes › Rede: mede quanto a latência sobe com o download e o upload no máximo e dá uma nota de A+ a F, com a recomendação certa (SQM/QoS no roteador). Usa os servidores de teste da Cloudflare, com limite de dados.
- **"Otimizar agora" com tela de progresso** do começo ao fim: ponto de restauração, aplicação de cada ajuste e conferência do resultado.
- **Nova cor de destaque: ciano `#29CDF2`.** Erros agora aparecem em vermelho, sem confusão com o destaque.

### 26 ajustes novos (241 no total)

- **Privacidade:** bloquear a instalação de apps promovidos, pesquisa do Windows só local, histórico da área de transferência, dados de escrita à mão, inventário de apps e gravador de passos, coletas extras de diagnóstico, mais tarefas de diagnóstico, idiomas enviados aos sites, localização bloqueada em todo o sistema e "Encontrar meu dispositivo".
- **Navegadores e Office:** Edge sem rastreamento, anúncios e promoções; Brave sem extras e sem telemetria; Office sem telemetria e pesquisas.
- **Windows 11:** Click to Do e IA do Bloco de Notas e do Paint desativados, "Início" fora do painel do Explorer e porcentagem da bateria em notebooks.
- **Explorer:** sem anúncios do OneDrive e do Microsoft 365, e Notícias e Interesses desativado no Windows 10.
- **Windows Update:** não baixar apps de fabricante ao conectar dispositivos (Razer, Logitech…) e permitir pausas de até 52 semanas.
- **Serviços:** descoberta de rede local, Bluetooth e Arquivos Offline.
- **Segurança e sistema:** ignorar programas injetados pela BIOS (WPBT), tela azul com detalhes técnicos e caminhos com mais de 260 caracteres.
- O perfil **Privacidade** inclui os novos ajustes de privacidade seguros, e o **Segurança reforçada** inclui o bloqueio do WPBT.

### Remoção de apps

- **95 apps** na lista (eram 47): apps do MSN, Notícias, 3D Builder, Sway, Power BI, AI Hub, LinkedIn, TikTok, Instagram, Facebook, Candy Crush, apps de streaming, Photoshop Express, Dolby Access, utilitários de Dell, HP e Lenovo, Widgets e mais. Só aparecem os que estão instalados.
- Apps que podem quebrar algo (Xbox, Gaming Services, extensões de vídeo HEVC/VP9/Web, Fotos, Store, Widgets, myHP, Experiência entre dispositivos) mostram o que deixa de funcionar e pedem confirmação.

### Ferramentas e correções

- Nova correção: verificar o disco do sistema com `chkdsk /scan`, sem reiniciar.
- A limpeza de shaders da GPU inclui o NV_Cache da NVIDIA.
- Fechar o ctrl no meio de uma operação (aplicar ajustes, limpeza, ponto de restauração, DNS…) pede confirmação em vez de interromper calado.
- Saúde do sistema: o item "memória livre agora", que mudava a cada segundo, foi trocado por "manutenção nos últimos 30 dias" (última limpeza e última verificação de integridade).
- As leituras ao vivo de CPU, GPU e rede pausam enquanto a janela está escondida.
- A checagem do catálogo agora barra dois ajustes que escrevem o mesmo valor do registro sem estarem marcados como conflitantes, o que quebraria o desfazer de um deles.

## 1.0.0 — 01/11/2026

Primeira versão pública, com o nome **ctrl**.

- Nova identidade visual: wordmark `⌜ctrl_`, preto e cinzas carvão, acento `#E52249` e a fonte Plus Jakarta Sans.
- Navegação reorganizada: Visão geral, Ajustes, Perfis, Jogos, Verificação, Histórico e Configurações.
- Visão geral nova: saúde do sistema, otimização recomendada, CPU, GPU, RAM, rede e disco ao vivo, atividade recente e resumo da máquina.
- O Modo ao vivo virou uma aba de Jogos. Desfazer, atividade e backups foram reunidos em Histórico.
- Aviso de versão nova: consulta as releases deste repositório ao abrir (pode ser desligado) e mostra o botão para baixar.
- Página Sobre, com o que o app faz, a licença e o aviso de responsabilidade.
- Instalador em português, com ícone e imagens próprias e termos de uso que precisam ser aceitos.
- Licença PolyForm Noncommercial 1.0.0.
- Quem usava a versão anterior (mojoTWEEKS) mantém os ajustes aplicados e os backups: o estado é migrado na primeira abertura, e o plano de energia e a regra de firewall antigos continuam reconhecidos.
