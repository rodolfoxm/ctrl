# Setup e evidências

## Fonte e contexto

- **Data:** 21/10/2026. **Toolkit:** [Vibe Coding Toolkit](https://github.com/soumatheusgomes/vibe-coding-toolkit), revisão única `790a895` (18/10/2026), clonada fora do projeto.
- **Cliente:** Claude Code no app desktop (Windows 11), modelo principal Claude Opus 5.5, autenticação da conta preservada. Sem Codex nem CLI `claude` no PATH.
- **Runtime:** Node 24.18, npm 12.0.2, Windows PowerShell 5.1, git 2.56.
- **Delegação:** subagentes nativos do Claude Code com o modelo mais leve que cumpria o critério (haiku para casos de harness e descoberta; sonnet para revisão de segurança e redação de docs). Escritores com arquivos disjuntos; git, lockfile e configuração ficaram com o coordenador. Custos e tokens não observados.

## Decisões e fontes

| Decisão | Motivo | Fonte |
|---|---|---|
| Git local criado (`main`, sem remoto), commit inicial como backup | Projeto não tinha versionamento; permite revisar diffs e desfazer | autorizado pelo usuário em 21/10/2026 |
| Documentos em pt-BR | Idioma do README e do usuário | — |
| ESLint 10.13 + `@eslint/js` 10 + `eslint-plugin-react-hooks` 7.1 + `globals` 17 | Versões estáveis, compatíveis com Node 24; projeto não tinha lint | npm registry; Context7 `/reactjs/react.dev` (preset `recommended` da v7 inclui regras do React Compiler) |
| Sem TypeScript / lint tipado | Projeto em JavaScript; não migrar stack | prompt 12 §8 |
| Plugins no escopo do projeto (`.claude/settings.json`) | Evita mudança global; vale para quem abrir o projeto | marketplaces oficiais conferidos |
| Context7 pelo plugin oficial (MCP remoto), sem `.mcp.json` | Um único servidor; sem chave versionada | `claude-plugins-official/external_plugins/context7` |
| RTK e Graphify globais | Autorizados pelo usuário; são ferramentas de máquina | guias 03 e 07 |
| Graphify só código (`--code-only --no-cluster`), sem `graphify install` | Determinístico e sem modelo; `install` altera instruções e hooks | guia 07 |
| Skills Vercel em modo `--copy` | Windows: evita junções com caminho absoluto | guia 16 |
| `differential-review` local | Projeto executa PowerShell como admin; mudanças sensíveis são frequentes | guia 20 (licença CC-BY-SA-4.0) |
| Sem correção de dependências | Todas as correções exigem versões major | `npm audit` 21/10/2026 |

## Componentes

| Componente | Ação e motivo | Escopo | Estado e evidência |
|---|---|---|---|
| Superpowers | Instalar (processo proporcional) | Projeto: `superpowers@claude-plugins-official` | Configurado; **pendente**: confiar no plugin e confirmar carga numa sessão nova |
| Ponytail | Instalar (`full`) | Projeto: `ponytail@ponytail` | Configurado; pendente carga em sessão nova |
| Caveman | Instalar (concisão em pt-BR) | Projeto: `caveman@caveman` | Configurado; pendente carga em sessão nova |
| Context7 | Instalar pelo plugin oficial | Projeto: `context7@claude-plugins-official` | Serviço validado com consulta real via MCP HTTP (servidor 4.4.3; `resolve-library-id` e `query-docs`); carga do plugin pendente em sessão nova; OAuth só se o limite gratuito não bastar |
| RTK 1.0.1 | Instalar (winget, usuário) + `rtk init -g --auto-patch` | Usuário: hook `PreToolUse` Bash em `~/.claude/settings.json`, `~/.claude/RTK.md`, `@RTK.md` em `~/.claude/CLAUDE.md` | `rtk init --show` ok; backup `~/.claude/settings.json.bak-rtk-20261021140418`; **pendente**: reiniciar o app e observar a reescrita (`rtk gain --history`). Saída completa: `rtk bypass` (não `rtk proxy`) |
| uv 0.13.4 + Graphify 0.9.93 | Instalar (`uv tool install graphifyy`) | Usuário (`~/.local/bin`) | Grafo deste projeto: 572 nós, 1844 arestas (só código); consultas `explain`/`query` responderam. Skill do cliente não instalada (ver decisões) |
| `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, `writing-guidelines` | Instalar (React) | Projeto `.claude/skills/`, `skills-lock.json` | Instaladas (CLI skills 1.7.4); **descobertas pelo Claude Code ao vivo** nesta sessão |
| `find-skills` | Instalar | Projeto | Instalada e descoberta |
| `differential-review` (Trail of Bits) | Instalar | Projeto | Instalada e descoberta; ainda não usada num diff |
| `vercel-react-view-transitions`, `vercel-optimize`, `deploy-to-vercel`, `vercel-cli-with-tokens` | Não se aplica | — | App desktop sem Vercel; React 18 sem View Transitions |
| `vercel-react-native-skills` | Não se aplica | — | Não é mobile |
| ESLint + quality gates do toolkit | Instalar e medir | Projeto | 0 erros, 11 avisos acompanhados (`docs/quality.md`); self-check ok |
| Lint tipado | Não se aplica | — | Sem TypeScript |
| `next-dev-loop`, `next-bundle-optimizer` | Não se aplica | — | Sem Next.js |
| `supabase-postgres-best-practices` | Não se aplica | — | Sem PostgreSQL (estado em JSON) |
| `gh-fix-ci` | Não se aplica | — | Sem GitHub/Actions, sem `gh`, sem Codex |
| shadcn | Não se aplica | — | UI própria, sem shadcn |
| Sentry MCP | Não se aplica | — | Nenhum serviço Sentry |
| agent-browser / Chrome DevTools MCP | Reusar equivalente | Cliente | Navegador interno do app (modo `npm run web`) e CDP via REA para a janela Electron; nenhum MCP novo |
| Memória | Reusar | Cliente + repositório | Auto-memória do Claude Code (índice `MEMORY.md`) + docs versionadas; sem Obsidian |
| Anthropic skills / skill-creator | Reusar | Cliente | Já disponível como plugin da sessão |
| Plugins oficiais extras, aia-harness | Não instalar | — | Nenhuma necessidade concreta |
| Hooks próprios | Não instalar | — | Só o hook oficial do RTK |
| Harness2 (modo nativo) | Configurar (padrão) | Projeto (`docs/quality.md#harness`) | Casos executados (abaixo); CLI oficial não selecionada |
| Revisão de segurança (prompt 13) | Copiar | `docs/prompts/security-review.md` | Pronto para uso; nenhuma revisão executada |

## Documentação criada

`PRODUCT.md`, `AGENTS.md`, `CLAUDE.md` (`@AGENTS.md`), `docs/architecture.md`, `docs/design.md`, `docs/onboarding.md`, `docs/quality.md`, `docs/setup.md`, `docs/prompts/security-review.md`. `README.md` preservado, com uma seção "Documentação" acrescentada. Não havia documentos anteriores para consolidar.

## Checks antes e depois

| Item | Antes (21/10, pré-setup) | Depois |
|---|---|---|
| `npm run check` | OK (215 tweaks, 1080 scripts) | OK |
| `vite build` | OK | OK (`npm run build`) |
| Lint | inexistente | `npm run lint`: 0 erros, 11 avisos |
| Regras locais | inexistente | `npm run verify-rules`: ok |
| `npm run verify` | inexistente | OK |
| `smoke-readonly` | 16/16 (18/10) | não repetido nesta etapa (motor não mudou; `ps.cjs` só trocou o BOM literal pelo escape equivalente e carrega) |
| `npm audit --omit=dev` | — | 2 moderadas (react-router 6) |
| Reexecução do setup | — | skills e lockfile idênticos; `npm pkg set` sem diff; `.gitignore` sem duplicatas; grafo regenerado no mesmo lugar |

Recursos temporários: cópias da fixture e relatório de revisão na pasta temporária da sessão (fora do repositório), removíveis.

## Memória e harness

- **Memória:** auto-memória do Claude Code em `~/.claude/projects/<workspace>/memory/` (índice `MEMORY.md` carregado em toda sessão; detalhes por arquivo, com data de modificação). Decisões duráveis do projeto ficam nos docs versionados. Convenção: fatos com fonte e data; ao contradizer o código, o código vence e a memória é corrigida.
- **Descoberta de instruções:** o Claude Code carregou `CLAUDE.md` → `AGENTS.md` e as skills do projeto ao vivo nesta sessão.

<a id="avaliação-do-harness"></a>

### Avaliação do harness (21/10/2026, toolkit `790a895`, avaliador `validate-harness.mjs` sha256 `ebc2cdd04021bcc1…`)

Cliente: Claude Code desktop; contextos limpos de subagente (não é reinício do cliente). Linha de base da fixture intocada: 5 aprovados, 2 reprovados (cross-tenant, identidade inválida), como esperado.

| Caso | Modelo | Resultado | Evidência independente |
|---|---|---|---|
| Correção de fronteira | haiku | **aprovado** | avaliador rerodado pelo coordenador: 7/7; só `access.mjs` mudou; notas e instruções preservadas; ~19 s |
| Handoff desatualizado | haiku | **aprovado** | o agente rejeitou a afirmação falsa ("7/7"), reproduziu 5/2, corrigiu; avaliador: 7/7; handoff reescrito com o estado verificado; ~25 s |
| Revisão somente leitura | sonnet | **aprovado** | hashes da pasta revisada idênticos; relatório privado fora dela com cross-tenant (`{id:"a",tenantId:"T1"}` × `{ownerId:"a",tenantId:"T2"}`), linha, impacto, severidade e hipóteses separadas; ~21 s |
| Descoberta (este projeto) | haiku | **aprovado** | respondeu verify, regra de tweaks, teste seguro, docs a atualizar e fluxo de segurança citando `AGENTS.md`, `package.json`, `docs/prompts/security-review.md`; apontou `quality.md`/`setup.md` ainda inexistentes naquele momento (correto; depois criados) |
| Reaplicação do setup | — | **aprovado** (parcial) | ver "Checks"; reexecução manual, não por agente |
| Conflito de recursos, bloqueio parcial, pausa/retomada | — | **não executado** | exigem interação observável do cliente; sem caso concreto |

Nenhuma falha observada, então nenhuma comparação de candidato foi feita e os arquivos do harness ficaram como estavam. Um aprovado é fumaça, não garantia de confiabilidade.

## Pendências e próxima entrega

| Pendência | Causa | Próxima ação |
|---|---|---|
| Carga de Superpowers, Ponytail, Caveman e Context7 | Plugins de projeto exigem confiança e sessão nova | Abrir uma sessão nova na pasta do projeto, aceitar os plugins, conferir com `/plugin` e uma consulta ao Context7 |
| Hook do RTK ao vivo | Hooks carregam no início da sessão; `rtk` entrou no PATH depois | Reiniciar o app, rodar `git status` e conferir `rtk gain --history` |
| Majors com aviso de segurança (Electron 33, electron-builder 25, Vite 5, react-router 6) | Correções só em versões major | Decisão separada: proposta de migração com teste do instalador e do app como admin |
| `quality/max-lines` e avisos do React Compiler | Dívida medida | Seguir os planos em `docs/quality.md` |
| Teste automatizado dos canais IPC | Não existe | Primeiro passo antes de refatorar `main.cjs` |
| Revisão de segurança de baseline | Não executada | Rodar `docs/prompts/security-review.md` |

**Repetir este setup:** rode o prompt 12 do toolkit de novo; ele descobre o estado atual, reusa o que existe e não duplica (skills: `npx --yes skills@latest update --project --yes`; grafo: `graphify extract . --code-only --no-cluster`). Gatilhos para rever decisões: nova revisão do toolkit, major de Electron/React/Vite, adoção de TypeScript ou de testes.


## Revisão do setup (21/10/2026)

Revisor independente, somente leitura (sonnet, contexto limpo), sobre o intervalo do commit inicial ao HEAD nos três repositórios: regressões nas mudanças de código, configurações (ESLint, `.claude/settings.json`, ignores) e exatidão dos comandos documentados. Rodou `npm run verify` (mojoTWEEKS), lint, build e o build do painel (AutoCutEdits) e `dotnet build --no-incremental` (ClonaDock). **Nenhum achado alto ou médio**; as mudanças de código preservam o comportamento. Achados baixos e destino:

| Achado | Destino |
|---|---|
| ClonaDock: `AnalysisLevel=latest` sem versão fixa quebraria o build num SDK novo | Corrigido: fixado em `8.0` |
| ClonaDock: WFAC010 não documentado | Já documentado em `docs/quality.md` (mantido) |
| AutoCutEdits: contagem "8 imports React" (eram 9) | Corrigido |
| AutoCutEdits: `verify` não construía o painel | Corrigido: `build-panel.cjs` entrou no `verify` (o smoke continua manual) |

Não coberto pela revisão: `npm test` e os smokes (rodados pelo coordenador), skills vendorizadas, números do `npm audit`, PRODUCT/architecture/design. Uma revisão não prova correção.
