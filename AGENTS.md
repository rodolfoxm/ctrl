# ctrl — instruções para agentes

Otimizador de Windows (Electron + React) que aplica tweaks com backup e desfaz qualquer alteração. Produto e escopo: [PRODUCT.md](PRODUCT.md). Arquitetura: [docs/architecture.md](docs/architecture.md). Setup, integrações e evidências: [docs/setup.md](docs/setup.md).

## Stack

Electron 33, React 18, Vite 5, JavaScript (CJS no processo principal, ESM no renderer), Windows PowerShell 5.1 como executor, npm 12 + `package-lock.json`, Node 24. Sem banco: estado em `%APPDATA%\ctrl\state.json`. Repositório público: https://github.com/rodolfoxm/ctrl (licença PolyForm Noncommercial 1.0.0).

## Comandos canônicos

- Instalar: `npm install` (npm 12 bloqueia scripts de instalação; veja `docs/onboarding.md`)
- Desenvolver: `npm run dev` · só UI com backend simulado: `npm run web`
- Lint: `npm run lint` (0 erros; avisos acompanhados em `docs/quality.md`)
- Regras locais: `npm run verify-rules`
- Tipos: indisponível (JavaScript sem TypeScript)
- Catálogo: `npm run check` (estrutura + sintaxe de todo PowerShell gerado, sem executar)
- Testes: não há framework; `node scripts/smoke-readonly.cjs` testa leituras na máquina real (somente leitura)
- Build: `npm run build` · instalador: `npm run dist` → `release/ctrl-Setup-<versão>.exe` · marca (ícone, imagens do instalador): `node scripts/make-brand.mjs`
- Verificar tudo: `npm run verify`

## Regras do projeto

- **Nada roda sem backup.** Tweak novo vai em `electron/catalog/*.cjs` com `registry[]` (snapshot automático) ou `script{snapshot,apply,revert,check}`. Depois: `npm run check` e `node scripts/export-catalog.cjs`.
- O renderer nunca envia script: só canal `area:acao` + IDs. Canal novo exige handler em `electron/main.cjs`, mock em `src/lib/mock.js` e, se for evento, entrada na allowlist de `electron/preload.cjs`.
- Aplicar tweaks muda o PC de verdade. Para testar UI use `npm run web`; para testar leituras use `smoke-readonly`. Não aplique tweaks, não crie tarefas agendadas nem pontos de restauração sem pedido.
- `check` é a fonte da verdade do estado de um tweak; se não puder ser lido (ex.: exige admin), retorne `null` (sem leitura), nunca `false`.
- IFEO só com nomes de executável específicos; nomes genéricos afetam outros programas.
- Objetos do Windows criados pelo app (plano de energia, regra de firewall, pasta do Agendador) usam o nome "ctrl"; `catalog/constants.cjs` mantém o reconhecimento dos nomes antigos "mojoTWEEKS" em `check`/`revert`. Não remova sem motivo.
- Versão nova: suba `version` no `package.json`, rode `npm run verify` e `npm run dist`, e publique uma release `v<versão>` no GitHub com o instalador anexado (é o que o aviso de atualização consulta). Publicar exige pedido explícito.

## Acordos de trabalho

- Leia as instruções e o código relevante antes de editar. Separe observação, premissa, decisão e evidência.
- Defina critério de aceite e comando de verificação antes de implementar. Correção de bug: reproduza e prove a regressão quando viável.
- Menor mudança suficiente; reuse padrões, componentes e dependências. Sem abstrações, opções ou dependências para necessidades não pedidas.
- Preserve mudanças locais, validação, tratamento de erro, segurança e acessibilidade.
- Atualize o documento responsável junto com a mudança: `PRODUCT.md` (escopo), `docs/architecture.md` (estrutura, decisões), `docs/design.md` (interface), `docs/onboarding.md` (preparação), `docs/quality.md` (checks), `docs/setup.md` (ferramentas e evidências).
- Publicar, enviar mensagens, custos e ações destrutivas exigem autorização específica; instalar uma ferramenta não autoriza usá-la para isso.

## Continuidade

- Durante trabalho autorizado, responda perguntas de status e continue. Um bloqueio para só o que depende dele.
- Trabalho de várias sessões: mantenha um handoff curto (objetivo, estado verificado, checks, pendências, próxima ação) no registro do plano. Ao retomar, confira arquivos, `git status`, checks e processos reais antes de confiar no handoff.
- Não repita a mesma tentativa sem evidência nova; não prometa execução em segundo plano sem um processo verificável.

## Ferramentas

Verifique instalação e descoberta antes de depender de uma ferramenta; ausência vira registro em `docs/setup.md`.

- **Superpowers:** use as skills de processo proporcionais ao tamanho da tarefa. Instruções explícitas e execução já autorizada vencem aprovações repetidas.
- **Ponytail** (`full`): menor solução completa. `stop ponytail` desliga.
- **Caveman:** conversa concisa em pt-BR; código, docs e commits em texto normal. `stop caveman` desliga.
- **Context7:** consulte a documentação atual antes de mexer em APIs/configuração de Electron, React, Vite, ESLint. Uma consulta por conceito; nunca envie código privado ou segredos.
- **RTK:** com o hook nativo ativo, use comandos normais (sem duplo prefixo); `rtk bypass <cmd>` para saída completa (na RTK 1.0.1 o antigo `rtk proxy` virou `bypass`; não use `llm-proxy`).
- **Graphify:** `GRAPHIFY_NO_AUTO_REFRESH=1 graphify query "…"` / `explain "arquivo::símbolo"` em `graphify-out/` (só código; pode estar desatualizado — regenere com `graphify extract . --code-only --no-cluster` e confirme no código).
- **Skills locais** (`.claude/skills/`): `vercel-react-best-practices` e `vercel-composition-patterns` ao escrever/revisar React; `web-design-guidelines` ao revisar telas; `writing-guidelines` ao revisar docs; `differential-review` em mudanças sensíveis (motor, `ps.cjs`, IPC, preload, catálogo); `find-skills` quando faltar uma capacidade concreta.
- **Modelos:** preserve o cliente, o modelo principal e a autenticação. Subagentes podem usar o modelo mais leve que cumpra o critério de aceite; aumente a capacidade para segurança, motor de tweaks e revisão crítica.

## Delegação e revisão

- Delegue só quando isolamento de contexto, especialização ou paralelismo independente compensarem. Cada tarefa recebe objetivo, contexto mínimo, arquivos permitidos, critério de aceite e checks. Um escritor por arquivo; lockfile, configuração compartilhada e git ficam com o coordenador. Revisores são somente leitura.
- Confira diff e checks antes de aceitar o resultado de um subagente.
- Revisão proporcional ao risco e ao diff real; mudanças não triviais têm revisão independente quando disponível. Termine quando os achados relevantes estiverem resolvidos ou com destino explícito, os checks passarem e os riscos residuais estiverem registrados.
- Revisão de segurança (baseline ou diff, somente leitura, relatório privado fora do repositório): [docs/prompts/security-review.md](docs/prompts/security-review.md).
- Melhoria do harness (modo nativo, medido): procedimento em [docs/quality.md](docs/quality.md#harness).

## Git

Repositório local, sem remoto. Sem hooks de commit/push, sem exigência de branch. Commits só quando pedidos ou ao fechar uma etapa autorizada.
