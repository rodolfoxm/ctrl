# Preparação local

## Pré-requisitos

- Windows 10/11 com Windows PowerShell 5.1 (já vem no sistema).
- Node.js 24 e npm 12. O npm 12 bloqueia scripts de instalação: se o Electron ou o esbuild faltarem depois de um `npm install`, rode `node install.js` dentro de `node_modules/electron` e `node_modules/esbuild`.
- Privilégio de administrador para aplicar a maioria dos tweaks.

## Primeira execução

```bash
npm install
npm run web        # só a interface, backend simulado: seguro para mexer na UI
npm run dev        # Vite + Electron com hot reload (sem admin, a não ser que o terminal seja admin)
npm run start      # gera a interface e abre o app
```

Para abrir como administrador sem instalar: `Iniciar como Admin.cmd` (pede UAC). O app só permite uma instância: feche outras janelas antes.

Instalador: `npm run dist` → `release/ctrl-Setup-<versão>.exe`.

## Verificar

| Comando | O que faz | Toca no sistema? |
|---|---|---|
| `npm run verify` | lint + self-check das regras + catálogo + build | Não |
| `npm run lint` | ESLint (0 erros esperados; avisos acompanhados em `docs/quality.md`) | Não |
| `npm run check` | estrutura do catálogo + sintaxe de todo PowerShell gerado (parser, sem executar) | Não |
| `node scripts/smoke-readonly.cjs` | roda todas as verificações e ferramentas somente leitura na máquina real | Só lê |

Depois de editar o catálogo: `node scripts/export-catalog.cjs` para atualizar o mock do navegador.

## Banco de dados

Não há. O estado fica em `%APPDATA%\ctrl\state.json` (snapshots dos tweaks aplicados, histórico, configurações).

## Agentes

Leia [AGENTS.md](../AGENTS.md). [CLAUDE.md](../CLAUDE.md) importa as mesmas instruções. Skills locais, integrações e escopos configurados estão em [setup.md](setup.md).

## Problemas conhecidos

| Sintoma | Causa verificada | Solução |
|---|---|---|
| `spawn ENAMETOOLONG` em verificações em lote | `-EncodedCommand` acima de 32K caracteres | Já tratado em `ps.cjs` (`.ps1` temporário) |
| Tweaks de energia "sem leitura" | Configuração oculta não aparece em `powercfg /q` | Já tratado (`/qh`) |
| `electron-builder` falha extraindo winCodeSign ("Cannot create symbolic link") | Pacote traz links de macOS que exigem privilégio | Extrair o `.7z` manualmente em `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0` |
| SmartScreen avisa ao abrir o instalador | Instalador sem assinatura digital | "Mais informações › Executar assim mesmo" |
