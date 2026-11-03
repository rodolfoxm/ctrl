# Design e acessibilidade

## Direção

Interface em pt-BR para Windows desktop (janela mínima 1040×660), seguindo o guia de marca do **ctrl**: fundo quase preto, barra lateral
e cartões em cinzas carvão separados por um degrau de tom, tinta branca e **um acento, ciano `#29CDF2`**, usado em status e dados (saúde do
sistema, interruptores ligados, gráficos ao vivo, confirmações). O botão principal de cada tela é branco com texto preto; sobre o acento, o texto é escuro (`--accent-ink`). Sem gradientes,
brilhos ou vidro: superfícies planas.

Navegação como no guia: Visão geral, Ajustes, Perfis, Jogos, Verificação, Histórico e Configurações; Agendador, Guia e Sobre ficam no pé da
barra lateral. "Ajustes" agrupa Desempenho, Rede, Sistema, Hardware e o catálogo completo num seletor acima de cada área; o Modo ao vivo
virou uma aba de Jogos.

Cores de alerta: âmbar (`--warning`) para avisos e vermelho (`--danger`) para erros e ações destrutivas. Até a 1.0 o acento era vermelho
(`#E52249`) e não dava para distinguir o que estava certo do que estava com erro; por isso ele virou ciano e o vermelho ficou só para
erro. O selo de risco "Seguro" é neutro.

Abertura: `src/components/Intro.jsx` toca `src/assets/intro.mp4` (1280×720, fundo `#171717`, o mesmo do overlay) uma vez por
abertura; clique ou tecla pula, e a opção "Animação de abertura" desliga. Não toca se a janela abrir escondida (bandeja).

Operações em lote mostram o overlay de progresso com etapas (ponto de restauração → aplicando → conferindo); etapas sem contagem usam a
barra indeterminada.

## Sistema existente

- **Tokens:** `:root` em `src/styles.css` (cores `--bg`, `--sidebar-bg`, `--surface-0…3`, `--accent*`, `--text-1…4`, métricas
  `--c-cpu/ram/gpu/net/disk`, raios, sombra). É a fonte da verdade; não duplique valores aqui.
- **Tipografia:** Plus Jakarta Sans (variável, empacotada via `@fontsource-variable`, funciona offline). Títulos em 800 com tracking
  negativo; texto em 14 px.
- **Componentes:** `src/components/ui.jsx` (Switch, Checkbox, Badge, Card, Stat, Meter, Ring, Sparkline, ActionButton, Logo, Wordmark),
  `Page.jsx` (Hero, SubNav), `TweakList.jsx`, `ModuleView.jsx`, `GlobalSearch.jsx`; `AreaSwitch` em `pages/AreaPage.jsx`.
- **Marca:** wordmark `⌜ctrl_` (canto superior esquerdo, o nome e um cursor em bloco que pisca) desenhado em CSS com a fonte do app; o
  ícone usa a versão `⌜c_` num quadrado preto. `scripts/make-brand.mjs` renderiza `build/icon.png`, `build/icon.ico`, as imagens do
  instalador e `docs/social.png` a partir de `scripts/brand/*.html`.
- **Ícones:** lucide-react.

## Core

Página própria na barra lateral (rota `/core`; no código, `Batuta.jsx` e canais `batuta:*`), com abas Regras (com o cartão de jogos detectados), Contenção, Vigia, Memória, Núcleos e Atividade, mais o assistente "Configurar para meus
jogos" (modal em dois passos: escolher os jogos, ver e aplicar). Avisa quando Process Lasso, ParkControl ou ISLC estão abertos, porque
brigariam com ele. Em Sobre, o cartão "Apoiar o desenvolvimento" abre o site; nada de pop-up.

## Interação

- Navegação por teclado: sub-abas com setas; busca global com `Ctrl+K`, setas e Enter; foco visível (`:focus-visible` no acento).
- Interruptores e checkboxes são `button` com `role="switch"`/`aria-pressed` e `aria-label`; a barra de saúde é `role="meter"`.
- Operações demoradas mostram spinner no botão (`ActionButton`) ou o overlay de progresso com contagem; o resultado vira toast.
- Ajustes "avançados" ou com ressalva pedem confirmação antes de aplicar.
- `prefers-reduced-motion` desliga animações e transições, incluindo o cursor do logo.

## Estados

Carregando (spinner/`Loading`), vazio (`Empty`), erro (toast e `ErrorBoundary` por tela), "sem leitura" para ajustes cujo estado não pode
ser lido, "oculto" com o motivo para ajustes que não se aplicam à máquina, falta de administrador (selo no topo + "Reabrir como
administrador") janela fechada para a bandeja (aviso do Windows só na primeira vez; leituras ao vivo pausadas enquanto escondida) e versão nova disponível (cartão no pé da barra lateral e aba Configurações › Atualizações).

## Revisões feitas

- 01/11/2026: rebranding para ctrl. Telas principais conferidas no modo navegador a 1440×900 e o app instalado conferido com dados reais.
- Use a skill `web-design-guidelines` nas próximas revisões de interface.

## Manutenção

Mudanças visuais atualizam os tokens/componentes e esta página quando uma regra mudar.
