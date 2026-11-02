# Qualidade

## Comandos

| Comando | Prova | Quando |
|---|---|---|
| `npm run verify` | tudo abaixo, nesta ordem | antes de dar uma mudança por pronta |
| `npm run lint` | ESLint 10 (recomendado + react-hooks + `quality/max-lines`) sem erros | toda mudança em JS/JSX |
| `npm run verify-rules` | self-check das regras copiadas do toolkit (RuleTester) | ao mexer em `eslint-rules/` |
| `npm run check` | catálogo: IDs, módulos, perfis, conflitos, **escritas de registro sobrepostas** entre tweaks não conflitantes e **sintaxe de todo PowerShell gerado** (parser, sem executar) | toda mudança em `electron/catalog/` ou no motor |
| `npm run build` | build do renderer (Vite) | toda mudança em `src/` |
| `node scripts/smoke-readonly.cjs` | todas as verificações e ferramentas somente leitura na máquina real | mudanças no motor, em `check`, ferramentas ou `ps.cjs` |

Não há verificação de tipos (JavaScript sem TypeScript) nem framework de testes. O perfil de lint tipado do toolkit (`no-floating-promises`, `no-misused-promises`) não se aplica sem TypeScript.

## Regras e linha de base (adoção em 21/10/2026)

Configuração em `eslint.config.mjs`, por ambiente. Severidade definida pela medição: regra sem violação = erro; regra nova com violações antigas = *warn* com plano.

| Regra | Violações na adoção | Severidade | Plano |
|---|---|---|---|
| `quality/max-lines` (350) | 4: `catalog/system.cjs` 632, `main.cjs` 497, `catalog/gaming.cjs` 365, `catalog/performance.cjs` 362 | warn | dividir `system.cjs` por módulo; separar handlers IPC de `main.cjs` por domínio quando houver teste dos canais |
| `react-hooks/set-state-in-effect` | 4 (GlobalSearch, TweakList, ui `useAsync`, context) | warn | trocar por estado derivado/handlers ao mexer nesses arquivos |
| `react-hooks/refs` | 2 (`MonitorView` lê ref no render) | warn | guardar o histórico em estado |
| `react-hooks/purity` | 1 (`Guardian` usa `Date.now()` no render) | warn | calcular no handler/efeito |
| demais (recomendado, `rules-of-hooks`, `exhaustive-deps`, `no-unused-vars`…) | 0 após correções | error | — |

Corrigido na adoção: 3 valores iniciais inúteis (`games.cjs`), BOM literal em `ps.cjs`, `document.title` alterado durante o render (`useTitle`). Ajuste de configuração: `ignoreRestSiblings` (omitir campos com `...rest` é intencional).

`quality/no-direct-console` e `quality/no-direct-data-access` não estão ativas: não há logger nem banco no projeto.

## Estratégia de testes

O risco está no motor e no catálogo, que mexem no sistema. A defesa atual: `check` valida sintaxe de todo script sem executar; `smoke-readonly` executa só leituras na máquina real; o mock do navegador (`npm run web`) permite testar a interface sem tocar no Windows. Aplicar/reverter de verdade só com pedido explícito e em máquina de teste. Falta um teste automatizado dos canais IPC (bloqueia a refatoração de `main.cjs`).

## Dependências (auditoria de 21/10/2026)

- **Produção** (`npm audit --omit=dev`): 2 moderadas, `react-router`/`react-router-dom` 6.x; correção só na 7 (major).
- **Completa:** 22 (1 crítica, 14 altas, 7 moderadas), todas na cadeia de build/desenvolvimento: Electron 33, electron-builder 25, Vite 5, tar, node-gyp. Correções exigem majors (Electron, electron-builder, Vite).
- Nenhuma correção aplicada: majors são decisão separada (veja `docs/setup.md`, pendências). Lint e build passando não significam auditoria limpa.

## Revisão depois de implementar

Escopo pela mudança real e pelo risco. Mudanças no motor, `ps.cjs`, preload/IPC ou catálogo são sensíveis: use revisão independente quando disponível e a skill `differential-review`. Registre alvo, chamadores, achados e cobertura; rodadas extras só com evidência nova ou pedido explícito.

## Revisão de segurança

Prompt reutilizável em [prompts/security-review.md](prompts/security-review.md) (toolkit `790a895`), baseline ou diff, somente leitura, relatório privado fora do repositório. `differential-review` instalado localmente para diffs; sem ele, rastreamento manual. Nenhuma revisão de baseline foi feita ainda.

<a id="harness"></a>

## Harness

**Modo:** adaptação nativa inspirada no Harness2 (prompt 15 do toolkit `790a895`). Não executa o framework Harness2 nem reproduz seus resultados; a CLI oficial não foi selecionada.

**Procedimento reutilizável** (rode após mudanças em `AGENTS.md`, skills, plugins ou forma de delegar):

1. Casos de fumaça em cópias descartáveis da fixture `templates/harness-evaluation/` do toolkit, fora deste repositório: correção de fronteira, handoff desatualizado e revisão somente leitura. Rode `scripts/validate-harness.mjs` do toolkit na cópia intocada (esperado: 5 aprovados, 2 reprovados) antes de despachar.
2. Caso do projeto: um agente em contexto limpo responde, só pelos arquivos do repositório, ao comando de verificação, à regra de tweaks, ao teste seguro, ao documento a atualizar e ao fluxo de revisão de segurança.
3. Registre cliente/modelo, entradas, comandos, arquivos alterados, comportamento observado e aprovado/reprovado/não executado em `docs/setup.md`.
4. Só uma falha observada justifica uma comparação: uma mudança mínima nos arquivos do harness, mesma entrada, mesmo avaliador. Adote só se melhorar sem enfraquecer regras.

**Invocação:** peça ao agente "Execute o procedimento de harness de docs/quality.md" ou use o prompt 15 do toolkit. Resultados da adoção: [setup.md](setup.md#avaliação-do-harness).

## Entrega

Checks são comandos explícitos. Sem hooks de git, bloqueio de push ou exigência de branch. Atualize este documento junto com scripts e regras que mudarem.
