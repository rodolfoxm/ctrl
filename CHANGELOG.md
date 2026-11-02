# Changelog

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
