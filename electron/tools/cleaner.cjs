// Disk cleaner: scans known junk locations, reports sizes, deletes only what the
// user selected. Files in use are skipped silently. Never touches user documents.
const { runJson } = require('../ps.cjs');
const store = require('../store.cjs');

// paths use PowerShell expressions; {admin} categories need elevation to clean fully.
const CATEGORIES = [
  { id: 'user-temp', name: 'Temporários do usuário', description: 'Pasta %TEMP% da sua conta.', paths: ['$env:TEMP'], safe: true },
  { id: 'win-temp', name: 'Temporários do Windows', description: 'C:\\Windows\\Temp.', paths: ['"$env:SystemRoot\\Temp"'], admin: true, safe: true },
  { id: 'wu-cache', name: 'Cache do Windows Update', description: 'Pacotes já instalados em SoftwareDistribution\\Download.', paths: ['"$env:SystemRoot\\SoftwareDistribution\\Download"'], admin: true, safe: true },
  { id: 'delivery-opt', name: 'Cache de Otimização de Entrega', description: 'Arquivos de atualização compartilhados via P2P.', paths: ['"$env:SystemRoot\\ServiceProfiles\\NetworkService\\AppData\\Local\\Microsoft\\Windows\\DeliveryOptimization\\Cache"'], admin: true, safe: true },
  { id: 'thumbnails', name: 'Cache de miniaturas', description: 'Miniaturas do Explorer (recriadas automaticamente).', paths: ['"$env:LOCALAPPDATA\\Microsoft\\Windows\\Explorer"'], filter: 'thumbcache_*.db', safe: true },
  { id: 'dx-shader', name: 'Cache de shaders DirectX', description: 'Shaders compilados pelo Windows (recompilados quando necessário).', paths: ['"$env:LOCALAPPDATA\\D3DSCache"'], safe: true },
  { id: 'gpu-shader', name: 'Cache de shaders da GPU', description: 'NVIDIA DXCache/GLCache e AMD DxCache. Jogos podem demorar mais a abrir na primeira vez.', paths: ['"$env:LOCALAPPDATA\\NVIDIA\\DXCache"', '"$env:LOCALAPPDATA\\NVIDIA\\GLCache"', '"$env:LOCALAPPDATA\\AMD\\DxCache"', '"$env:LOCALAPPDATA\\AMD\\GLCache"', '"$env:ProgramData\\NVIDIA Corporation\\NV_Cache"'], safe: false },
  { id: 'crash-dumps', name: 'Despejos de falhas', description: 'Arquivos .dmp de travamentos de apps e do sistema.', paths: ['"$env:LOCALAPPDATA\\CrashDumps"', '"$env:SystemRoot\\Minidump"'], admin: true, safe: true },
  { id: 'wer', name: 'Relatórios de erro', description: 'Relatórios do Windows Error Reporting já enviados ou na fila.', paths: ['"$env:ProgramData\\Microsoft\\Windows\\WER\\ReportArchive"', '"$env:ProgramData\\Microsoft\\Windows\\WER\\ReportQueue"', '"$env:LOCALAPPDATA\\Microsoft\\Windows\\WER"'], safe: true },
  { id: 'logs', name: 'Logs antigos do Windows', description: 'Logs de CBS e DISM.', paths: ['"$env:SystemRoot\\Logs\\CBS"', '"$env:SystemRoot\\Logs\\DISM"'], filter: '*.log', admin: true, safe: true },
  { id: 'browser-chrome', name: 'Cache do Google Chrome', description: 'Cache de páginas e código (não apaga senhas, histórico nem cookies).', paths: ['"$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Cache"', '"$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Code Cache"'], browser: 'chrome', safe: true },
  { id: 'browser-edge', name: 'Cache do Microsoft Edge', description: 'Cache de páginas e código (não apaga senhas, histórico nem cookies).', paths: ['"$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Default\\Cache"', '"$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Default\\Code Cache"'], browser: 'msedge', safe: true },
  { id: 'browser-brave', name: 'Cache do Brave', description: 'Cache de páginas e código.', paths: ['"$env:LOCALAPPDATA\\BraveSoftware\\Brave-Browser\\User Data\\Default\\Cache"', '"$env:LOCALAPPDATA\\BraveSoftware\\Brave-Browser\\User Data\\Default\\Code Cache"'], browser: 'brave', safe: true },
  { id: 'browser-firefox', name: 'Cache do Firefox', description: 'cache2 de todos os perfis.', paths: ['"$env:LOCALAPPDATA\\Mozilla\\Firefox\\Profiles"'], sub: 'cache2', browser: 'firefox', safe: true },
  { id: 'recycle-bin', name: 'Lixeira', description: 'Itens apagados que ainda estão na Lixeira.', recycle: true, safe: false },
];

function sizeExpr(c) {
  if (c.recycle) {
    return `(New-Object -ComObject Shell.Application).NameSpace(10).Items() | ForEach-Object { $sz += [int64]$_.ExtendedProperty('Size'); $cnt++ }`;
  }
  return c.paths
    .map((p) => {
      const base = c.sub
        ? `Get-ChildItem ${p} -Directory -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName '${c.sub}' } | Where-Object { Test-Path $_ }`
        : `@(${p}) | Where-Object { Test-Path $_ }`;
      const filter = c.filter ? ` -Filter '${c.filter}'` : '';
      return `${base} | ForEach-Object { Get-ChildItem -LiteralPath $_${filter} -Recurse -Force -File -ErrorAction SilentlyContinue | ForEach-Object { $sz += $_.Length; $cnt++ } }`;
    })
    .join('\n');
}

function cleanExpr(c) {
  if (c.recycle) return 'Clear-RecycleBin -Force -ErrorAction SilentlyContinue';
  return c.paths
    .map((p) => {
      const base = c.sub
        ? `Get-ChildItem ${p} -Directory -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName '${c.sub}' } | Where-Object { Test-Path $_ }`
        : `@(${p}) | Where-Object { Test-Path $_ }`;
      if (c.filter) return `${base} | ForEach-Object { Get-ChildItem -LiteralPath $_ -Filter '${c.filter}' -Force -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue }`;
      return `${base} | ForEach-Object { Get-ChildItem -LiteralPath $_ -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }`;
    })
    .join('\n');
}

async function scan() {
  const body = CATEGORIES.map(
    (c) => `$sz = [int64]0; $cnt = 0\ntry {\n${sizeExpr(c)}\n} catch {}\n$r += [pscustomobject]@{ id = '${c.id}'; bytes = $sz; files = $cnt }`,
  ).join('\n');
  const procs = `$running = @(Get-Process chrome, msedge, brave, firefox -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessName -Unique)`;
  const rows = await runJson(`$r = @()\n${body}\n${procs}\n[pscustomobject]@{ items = $r; running = $running } | ConvertTo-Json -Depth 4 -Compress`, { timeout: 300000 });
  const running = new Set((rows.running || []).map((p) => p.toLowerCase()));
  return {
    at: new Date().toISOString(),
    items: CATEGORIES.map(({ paths, filter, sub, recycle, ...meta }) => {
      const row = (rows.items || []).find((x) => x.id === meta.id) || { bytes: 0, files: 0 };
      return { ...meta, bytes: row.bytes, files: row.files, browserRunning: meta.browser ? running.has(meta.browser) : false };
    }),
  };
}

/** Cleans the selected categories and reports the space actually freed. */
async function clean(ids) {
  const chosen = CATEGORIES.filter((c) => ids.includes(c.id));
  if (!chosen.length) return { ok: true, freed: 0 };
  const body = chosen
    .map((c) => `$sz = [int64]0; $cnt = 0\ntry {\n${sizeExpr(c)}\n} catch {}\n$before = $sz\ntry {\n${cleanExpr(c)}\n} catch {}\n$sz = [int64]0; $cnt = 0\ntry {\n${sizeExpr(c)}\n} catch {}\n$r += [pscustomobject]@{ id = '${c.id}'; freed = [math]::Max(0, $before - $sz) }`)
    .join('\n');
  const rows = await runJson(`$r = @()\n${body}\nConvertTo-Json -InputObject @($r) -Compress`, { timeout: 600000 });
  const freed = rows.reduce((a, r) => a + (r.freed || 0), 0);
  store.log({ action: 'clean', id: 'cleaner', name: `Limpeza: ${chosen.map((c) => c.name).join(', ')}`, ok: true, detail: `${freed} bytes` });
  return { ok: true, freed, items: rows };
}

module.exports = { CATEGORIES, scan, clean };
