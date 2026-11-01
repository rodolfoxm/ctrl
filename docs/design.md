# Design e acessibilidade

## Direção

Interface em pt-BR para Windows desktop (janela mínima 1040×660), seguindo o guia de marca do **ctrl**: fundo quase preto, barra lateral
e cartões em cinzas carvão separados por um degrau de tom, tinta branca e **um acento, `#E52249`**, usado em status e dados (saúde do
sistema, interruptores ligados, gráficos ao vivo, confirmações). O botão principal de cada tela é branco com texto preto. Sem gradientes,
brilhos ou vidro: superfícies planas.

Navegação como no guia: Visão geral, Ajustes, Perfis, Jogos, Verificação, Histórico e Configurações; Agendador, Guia e Sobre ficam no pé da
barra lateral. "Ajustes" agrupa Desempenho, Rede, Sistema, Hardware e o catálogo completo num seletor acima de cada área; o Modo ao vivo
virou uma aba de Jogos.

Cores de alerta: âmbar (`--warning`) para avisos e laranja (`--danger`) para erros e ações destrutivas, para não se confundirem com o
acento. O selo de risco "Seguro" é neutro pelo mesmo motivo.

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

## Interação

- Navegação por teclado: sub-abas com setas; busca global com `Ctrl+K`, setas e Enter; foco visível (`:focus-visible` no acento).
- Interruptores e checkboxes são `button` com `role="switch"`/`aria-pressed` e `aria-label`; a barra de saúde é `role="meter"`.
- Operações demoradas mostram spinner no botão (`ActionButton`) ou o overlay de progresso com contagem; o resultado vira toast.
- Ajustes "avançados" ou com ressalva pedem confirmação antes de aplicar.
- `prefers-reduced-motion` desliga animações e transições, incluindo o cursor do logo.

## Estados

Carregando (spinner/`Loading`), vazio (`Empty`), erro (toast e `ErrorBoundary` por tela), "sem leitura" para ajustes cujo estado não pode
ser lido, "oculto" com o motivo para ajustes que não se aplicam à máquina, falta de administrador (selo no topo + "Reabrir como
administrador") e versão nova disponível (cartão no pé da barra lateral e aba Configurações › Atualizações).

## Revisões feitas

- 01/11/2026: rebranding para ctrl. Telas principais conferidas no modo navegador a 1440×900 e o app instalado conferido com dados reais.
- Use a skill `web-design-guidelines` nas próximas revisões de interface.

## Manutenção

Mudanças visuais atualizam os tokens/componentes e esta página quando uma regra mudar.
