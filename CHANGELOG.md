# Changelog

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
