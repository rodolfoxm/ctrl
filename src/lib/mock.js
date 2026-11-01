// Browser-only stand-in for the Electron main process (npm run web). It keeps
// state in memory and never touches the system. The catalog is the real one,
// exported by scripts/export-catalog.cjs.
import snapshot from './catalog.snapshot.json';

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const listeners = new Map();
const emit = (ch, data) => (listeners.get(ch) || new Set()).forEach((cb) => cb(data));

const status = Object.fromEntries(snapshot.tweaks.map((t, i) => [t.id, t.verifiable ? i % 5 === 0 : null]));
const state = {
  applied: {},
  history: [],
  sweeps: [],
  settings: {
    autoRestorePoint: true, confirmRisky: true, showHidden: false, liveGameMode: false, liveGameModeAsk: true,
    liveGamePlan: true, liveGameTimer: true, sentinel: true, sentinelRepair: false, startWithWindows: false, checkUpdates: true,
  },
  onboarded: (() => {
    try {
      // ?demo skips the first-run wizard (used for the README screenshots).
      return location.search.includes('demo') || sessionStorage.getItem('ctrl.mock.onboarded') === '1';
    } catch {
      return false;
    }
  })(),
  dns: null,
  customProfiles: [],
  activeProfile: null,
  games: [
    { id: 'a1', name: 'Counter-Strike 2', exe: 'C:\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\cs2.exe', source: 'Steam' },
    { id: 'b2', name: 'Fortnite', exe: 'C:\\Epic\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe', source: 'Epic' },
    { id: 'c3', name: 'Valorant', exe: 'C:\\Riot Games\\VALORANT\\live\\VALORANT.exe', source: 'Manual' },
  ],
  tasks: new Set(),
  timer: null,
};
// Pretend a few tweaks were applied earlier so Guardian has something to show.
for (const t of snapshot.tweaks.filter((x) => status[x.id]).slice(0, 6)) {
  state.applied[t.id] = { name: t.name, module: t.module, at: new Date(Date.now() - 864e5 * 2).toISOString(), source: 'manual' };
}
// ?demo: an already-optimised machine with some recent activity (README screenshots).
if (typeof location !== 'undefined' && location.search.includes('demo')) {
  const minutes = (m) => new Date(Date.now() - m * 6e4).toISOString();
  for (const id of snapshot.quickWins) {
    const t = snapshot.tweaks.find((x) => x.id === id);
    if (!t) continue;
    status[id] = t.verifiable ? true : null;
    state.applied[id] = { name: t.name, module: t.module, at: minutes(40), source: 'otimização recomendada' };
  }
  state.history.push(
    { at: minutes(12), action: 'apply', name: 'Otimização recomendada aplicada', source: `${snapshot.quickWins.length} ajustes`, ok: true },
    { at: minutes(15), action: 'run', name: 'Verificação de integridade concluída', source: 'nenhum problema encontrado', ok: true },
    { at: minutes(41), action: 'apply', name: 'Perfil “Competitivo” ativado', source: 'perfil', ok: true },
    { at: minutes(42), action: 'restore-point', name: 'Ponto de restauração criado', source: 'antes das otimizações', ok: true },
  );
}

const log = (entry) => state.history.unshift({ at: now(), ok: true, ...entry });
const find = (id) => snapshot.tweaks.find((t) => t.id === id);

async function applyOne(id, source = 'manual') {
  await wait(120);
  const t = find(id);
  if (!t) return { ok: false, error: 'Tweak desconhecido.' };
  for (const c of t.conflicts || []) {
    if (state.applied[c]) {
      delete state.applied[c];
      status[c] = false;
    }
  }
  status[id] = t.verifiable ? true : null;
  state.applied[id] = { name: t.name, module: t.module, at: state.applied[id]?.at || now(), source };
  log({ action: 'apply', id, name: t.name, module: t.module, source });
  return { ok: true, restart: t.restart };
}
async function revertOne(id, source = 'manual') {
  await wait(120);
  const t = find(id);
  if (!t) return { ok: false, error: 'Tweak desconhecido.' };
  status[id] = t.verifiable ? false : null;
  delete state.applied[id];
  log({ action: 'revert', id, name: t.name, module: t.module, source });
  return { ok: true, restart: t.restart };
}
const RANK = { none: 0, explorer: 1, logoff: 2, reboot: 3 };
async function many(ids, fn, source) {
  const results = [];
  let restart = 'none';
  for (let i = 0; i < ids.length; i++) {
    emit('tweaks:progress', { index: i, total: ids.length, id: ids[i], name: find(ids[i])?.name });
    const r = await fn(ids[i], source);
    results.push({ id: ids[i], ...r });
    if (r.ok && RANK[r.restart] > RANK[restart]) restart = r.restart;
  }
  emit('tweaks:progress', { index: ids.length, total: ids.length, done: true });
  return { ok: true, results, failed: [], restart };
}

const machine = {
  osName: 'Microsoft Windows 11 Pro', build: 26100, win11: true, cpuName: 'AMD Ryzen 7 7800X3D 8-Core Processor', cpuVendor: 'amd',
  cores: 8, threads: 16, hybrid: false, defender: true, gpus: [{ name: 'NVIDIA GeForce RTX 4070', vendor: 'nvidia', refresh: 165 }], gpuVendors: ['nvidia'], refresh: 165,
  laptop: false, battery: false, ramGb: 32, manufacturer: 'ASUS', model: 'System Product Name', wifi: false, ethernet: true,
  activeLink: { name: 'Ethernet', desc: 'Intel(R) Ethernet Controller I226-V', speed: '2.5 Gbps' }, ssd: true,
  disks: [{ name: 'Samsung SSD 990 PRO 2TB', media: 'SSD', bus: 'NVMe' }],
};
const hwStatic = {
  os: { name: 'Microsoft Windows 11 Pro', version: '24H2', build: '26100.2314', installed: '2024-11-02', bootTime: new Date(Date.now() - 9e6).toISOString() },
  computer: { manufacturer: 'ASUS', model: 'System Product Name', chassis: 3 },
  cpu: { name: 'AMD Ryzen 7 7800X3D 8-Core Processor', cores: 8, threads: 16, maxMhz: 4201, socket: 'AM5' },
  board: { manufacturer: 'ASUSTeK COMPUTER INC.', product: 'ROG STRIX B650-A GAMING WIFI', bios: 'American Megatrends 2611', biosDate: '2024-08-01' },
  memory: { total: 34359738368, modules: [{ size: 17179869184, speed: 6000, maker: 'Kingston', part: 'KF560C30-16' }, { size: 17179869184, speed: 6000, maker: 'Kingston', part: 'KF560C30-16' }] },
  gpus: [{ name: 'NVIDIA GeForce RTX 4070', driver: '32.0.15.6614', vram: 12884901888, resolution: '2560x1440', refresh: 165 }],
  disks: [{ name: 'Samsung SSD 990 PRO 2TB', media: 'SSD', bus: 'NVMe', size: 2000398934016 }],
  volumes: [{ letter: 'C:', size: 1999000000000, free: 812000000000 }],
  network: [{ name: 'Ethernet', description: 'Intel(R) Ethernet Controller I226-V', speed: '2.5 Gbps' }],
};
let hwTimer = null;

const handlers = {
  'app:info': async () => ({ version: '1.0.0', isAdmin: true, dataPath: '(navegador)', dev: true, electron: '—' }),
  'app:relaunchAdmin': async () => ({ ok: true }),
  'win:minimize': async () => {}, 'win:toggleMaximize': async () => {}, 'win:close': async () => {},
  'system:restart': async () => ({ ok: true }), 'system:logoff': async () => ({ ok: true }),
  // Add ?update to the URL to preview the "new version" card.
  'app:checkUpdate': async () => ({ enabled: true, current: '1.0.0', version: '1.1.0', available: location.search.includes('update'), url: 'https://github.com/rodolfoxm/ctrl/releases/latest', checkedAt: new Date().toISOString() }),
  'app:openRelease': async () => (window.open('https://github.com/rodolfoxm/ctrl/releases/latest', '_blank'), { ok: true }),
  'app:openRepo': async () => (window.open('https://github.com/rodolfoxm/ctrl', '_blank'), { ok: true }),
  'shell:open': async (url) => (window.open(url, '_blank'), { ok: true }),
  'machine:get': async () => (await wait(200), machine),
  'catalog:get': async () => snapshot,
  'tweaks:status': async (ids) => (await wait(500), ids ? Object.fromEntries(ids.map((id) => [id, status[id] ?? null])) : { ...status }),
  'tweaks:apply': (id) => applyOne(id),
  'tweaks:revert': (id) => revertOne(id),
  'tweaks:applyMany': (ids, source) => many(ids, applyOne, source),
  'tweaks:revertMany': (ids, source) => many(ids, revertOne, source),
  'actions:run': async (id) => (await wait(900), log({ action: 'run', id, name: snapshot.actions.find((a) => a.id === id)?.name }), { ok: true, output: 'Concluído (simulado)' }),
  'guardian:verify': async () => {
    await wait(900);
    const ids = Object.keys(state.applied);
    const items = ids.map((id, i) => ({ id, name: state.applied[id].name, module: state.applied[id].module, state: status[id] == null ? 'unverifiable' : i === 1 ? 'drifted' : 'verified' }));
    state.sweeps.unshift({ at: now(), verified: items.filter((i) => i.state === 'verified').length, drifted: items.filter((i) => i.state === 'drifted').map((i) => i.id), unverifiable: items.filter((i) => i.state === 'unverifiable').length });
    return { at: now(), items };
  },
  'guardian:repair': (ids) => many(ids, (id) => applyOne(id, 'reparo')),
  'guardian:undoSince': (iso) => many(Object.keys(state.applied).filter((id) => state.applied[id].at >= iso), revertOne, 'desfazer em lote'),
  'guardian:undoAll': () => many(Object.keys(state.applied), revertOne, 'desfazer tudo'),
  'guardian:clearHistory': async () => ((state.history = []), { ok: true }),
  'dashboard:summary': async () => {
    await wait(600);
    const quick = snapshot.quickWins;
    const active = quick.filter((id) => status[id]);
    return {
      score: Math.round(40 + 45 * (active.length / quick.length)),
      factors: [
        { id: 'quick', label: 'Otimizações essenciais ativas', value: `${active.length}/${quick.length}`, weight: 45, score: active.length / quick.length },
        { id: 'restore', label: 'Ponto de restauração recente', value: 'ontem', weight: 15, score: 1 },
        { id: 'drift', label: 'Tweaks sem drift', value: state.sweeps[0] ? `${state.sweeps[0].drifted.length} desfeitos` : 'não verificado', weight: 15, score: 0.6 },
        { id: 'disk', label: 'Espaço livre no disco do sistema', value: '41%', weight: 15, score: 1 },
        { id: 'memory', label: 'Memória disponível agora', value: '58% livre', weight: 10, score: 1 },
      ],
      appliedCount: Object.keys(state.applied).length,
      quickWinsMissing: quick.filter((id) => !status[id]),
      restorePoint: { seq: 12, description: 'ctrl - antes das otimizações', created: new Date(Date.now() - 864e5).toISOString() },
      restoreEnabled: true,
      lastSweep: state.sweeps[0] || null,
      recent: state.history.slice(0, 8),
      uptime: 9000,
    };
  },
  'profiles:list': async () => ({
    active: state.activeProfile,
    profiles: [...snapshot.profiles.map((p) => ({ ...p, builtin: true })), ...state.customProfiles.map((p) => ({ ...p, builtin: false }))].map((p) => ({
      ...p, eligible: p.tweaks.filter((id) => !find(id)?.hiddenReason), appliedCount: p.tweaks.filter((id) => state.applied[id]).length,
    })),
  }),
  'profiles:apply': async (id) => {
    const p = [...snapshot.profiles, ...state.customProfiles].find((x) => x.id === id);
    const r = await many(p.tweaks.filter((t) => !find(t)?.hiddenReason), applyOne, `perfil ${p.name}`);
    state.activeProfile = id;
    return r;
  },
  'profiles:revert': async (id) => {
    const p = [...snapshot.profiles, ...state.customProfiles].find((x) => x.id === id);
    const r = await many(p.tweaks.filter((t) => state.applied[t]), revertOne, `perfil ${p.name}`);
    if (state.activeProfile === id) state.activeProfile = null;
    return r;
  },
  'profiles:save': async (p) => {
    const profile = { id: p.id || `custom-${Date.now()}`, icon: 'user', accent: 'accent', ...p };
    state.customProfiles = [...state.customProfiles.filter((x) => x.id !== profile.id), profile];
    return { ok: true, profile };
  },
  'profiles:delete': async (id) => ((state.customProfiles = state.customProfiles.filter((x) => x.id !== id)), { ok: true }),
  'profiles:export': async () => ({ ok: true, path: 'C:\\perfil.ctrl-profile.json' }),
  'profiles:import': async () => ({ ok: false, canceled: true }),
  'games:list': async () => ({
    games: state.games,
    options: [
      { key: 'priority', label: 'Prioridade alta de CPU', description: 'O Windows inicia o processo com prioridade Alta.' },
      { key: 'gpu', label: 'GPU de alto desempenho', description: 'Força a GPU dedicada em notebooks com gráficos híbridos.' },
      { key: 'fso', label: 'Sem otimizações de tela cheia', description: 'Usa tela cheia exclusiva real para este executável.' },
    ],
  }),
  'games:scan': async () => (await wait(900), state.games),
  'games:add': async () => state.games,
  'games:remove': async (id) => (state.games = state.games.filter((g) => g.id !== id)),
  'games:status': async () => (await wait(300), { priority: true, gpu: false, fso: false }),
  'games:set': async () => (await wait(300), { ok: true }),
  'games:launch': async () => ({ ok: true }),
  'livegame:status': async () => ({
    enabled: state.settings.liveGameMode, session: null,
    sessions: [{ game: 'Counter-Strike 2', exe: 'cs2.exe', start: new Date(Date.now() - 7.2e6).toISOString(), end: new Date(Date.now() - 3.6e6).toISOString(), actions: ['Prioridade Alta para o processo do jogo', 'Plano de energia de alto desempenho', 'Resolução de timer em 0,5 ms'] }],
  }),
  'livegame:setEnabled': async (v) => ((state.settings.liveGameMode = v), handlers['livegame:status']()),
  'livegame:confirm': async () => ({ ok: true }),
  'livegame:end': async () => handlers['livegame:status'](),
  'hw:static': async () => (await wait(500), hwStatic),
  'hw:subscribe': async () => {
    clearInterval(hwTimer);
    hwTimer = setInterval(() => {
      const cpu = 8 + Math.round(Math.random() * 30);
      emit('hw:update', {
        at: Date.now(), cpu, perCore: Array.from({ length: 16 }, () => Math.round(Math.random() * 60)),
        memUsed: 13e9 + Math.random() * 2e9, memTotal: 34359738368, uptime: 9000,
        gpu: 4 + Math.round(Math.random() * 25), gpuMem: 2.1e9, temp: null, disk: Math.round(Math.random() * 10),
        netDown: Math.random() * 4e5, netUp: Math.random() * 7e4,
      });
    }, 1000);
    return { ok: true };
  },
  'hw:unsubscribe': async () => clearInterval(hwTimer),
  'hw:processes': async () => [
    { name: 'chrome', id: 1234, mem: 1.2e9, cpu: 300.2 }, { name: 'Discord', id: 2234, mem: 4.1e8, cpu: 80.4 },
    { name: 'explorer', id: 3234, mem: 2.2e8, cpu: 40.1 }, { name: 'steamwebhelper', id: 4234, mem: 1.9e8, cpu: 22.7 },
  ],
  'health:disks': async () => (await wait(500), [
    { name: 'Samsung SSD 990 PRO 2TB', serial: 'S6Z2NJ0W123456', media: 'SSD', bus: 'NVMe', size: 2000398934016, health: 'Healthy', status: 'OK', firmware: '4B2QJXD7', temperature: 41, temperatureMax: 82, wear: 3, powerOnHours: 5821, readErrors: 0, writeErrors: 0, startStop: 812, countersAvailable: true },
    { name: 'ST2000DM008-2FR102', serial: 'ZFL1ABCD', media: 'HDD', bus: 'SATA', size: 2000398934016, health: 'Healthy', status: 'OK', firmware: '0001', temperature: 34, temperatureMax: 50, wear: null, powerOnHours: 14210, readErrors: 0, writeErrors: 0, startStop: 2210, countersAvailable: true },
  ]),
  'health:battery': async () => ({ present: false }),
  'health:boot': async () => (await wait(400), {
    lastBoot: new Date(Date.now() - 9e6).toISOString(),
    events: Array.from({ length: 14 }, (_, i) => ({ at: new Date(Date.now() - i * 864e5).toISOString(), total: 14000 + Math.round(Math.random() * 9000), main: 9000 + Math.round(Math.random() * 3000), post: 4000 + Math.round(Math.random() * 5000) })),
    error: null,
  }),
  'net:state': async () => ({
    interfaces: [{ alias: 'Ethernet', index: 12, servers: state.dns ? ['1.1.1.1', '1.0.0.1'] : ['192.168.0.1'] }],
    changed: state.dns,
    providers: [
      { id: 'cloudflare', name: 'Cloudflare', servers: ['1.1.1.1', '1.0.0.1'], note: 'Rápido e focado em privacidade.' },
      { id: 'google', name: 'Google', servers: ['8.8.8.8', '8.8.4.4'], note: 'Muito estável no mundo todo.' },
      { id: 'quad9', name: 'Quad9', servers: ['9.9.9.9', '149.112.112.112'], note: 'Bloqueia domínios maliciosos conhecidos.' },
      { id: 'opendns', name: 'OpenDNS', servers: ['208.67.222.222', '208.67.220.220'], note: 'Cisco, com filtros opcionais.' },
      { id: 'adguard', name: 'AdGuard', servers: ['94.140.14.14', '94.140.15.15'], note: 'Bloqueia anúncios e rastreadores.' },
      { id: 'cloudflare-family', name: 'Cloudflare Família', servers: ['1.1.1.3', '1.0.0.3'], note: 'Bloqueia malware e conteúdo adulto.' },
    ],
  }),
  'net:benchmark': async () => {
    await wait(2500);
    const rows = [['cloudflare', 'Cloudflare', '1.1.1.1', 9], ['google', 'Google', '8.8.8.8', 14], ['quad9', 'Quad9', '9.9.9.9', 21], ['current', 'DNS atual', '192.168.0.1', 27], ['adguard', 'AdGuard', '94.140.14.14', 33], ['opendns', 'OpenDNS', '208.67.222.222', 38], ['cloudflare-family', 'Cloudflare Família', '1.1.1.3', 12]];
    return { at: now(), domains: 8, results: rows.map(([id, name, server, m]) => ({ id, name, server, median: m, avg: m + 3, ok: 8, fails: 0, current: id === 'current' })).sort((a, b) => a.median - b.median) };
  },
  'net:setDns': async (id) => ((state.dns = { provider: id, name: id, at: now() }), log({ action: 'apply', id: `dns:${id}`, name: `DNS ${id}` }), { ok: true }),
  'net:revertDns': async () => ((state.dns = null), { ok: true }),
  'net:latency': async () => {
    await wait(1800);
    const mk = (host, base) => {
      const samples = Array.from({ length: 20 }, () => base + Math.round(Math.random() * 6));
      return { host, sent: 20, lost: 0, samples, avg: samples.reduce((a, b) => a + b) / 20, min: Math.min(...samples), p95: Math.max(...samples) - 1, jitter: 1.8 };
    };
    return { at: now(), results: [mk('1.1.1.1', 9), mk('8.8.8.8', 14)] };
  },
  'cleaner:scan': async () => {
    await wait(1200);
    const sizes = { 'user-temp': 1.4e9, 'win-temp': 3.2e8, 'wu-cache': 2.1e9, 'delivery-opt': 6.4e8, thumbnails: 1.2e8, 'dx-shader': 4.1e8, 'gpu-shader': 1.1e9, 'crash-dumps': 9.6e7, wer: 3.3e7, logs: 2.2e8, 'browser-chrome': 7.7e8, 'browser-edge': 3.1e8, 'browser-brave': 0, 'browser-firefox': 0, 'recycle-bin': 5.4e8 };
    const meta = [
      ['user-temp', 'Temporários do usuário', 'Pasta %TEMP% da sua conta.', true], ['win-temp', 'Temporários do Windows', 'C:\\Windows\\Temp.', true],
      ['wu-cache', 'Cache do Windows Update', 'Pacotes já instalados em SoftwareDistribution\\Download.', true], ['delivery-opt', 'Cache de Otimização de Entrega', 'Arquivos de atualização compartilhados via P2P.', true],
      ['thumbnails', 'Cache de miniaturas', 'Miniaturas do Explorer (recriadas automaticamente).', true], ['dx-shader', 'Cache de shaders DirectX', 'Shaders compilados pelo Windows.', true],
      ['gpu-shader', 'Cache de shaders da GPU', 'NVIDIA/AMD. Jogos podem demorar mais a abrir na primeira vez.', false], ['crash-dumps', 'Despejos de falhas', 'Arquivos .dmp de travamentos.', true],
      ['wer', 'Relatórios de erro', 'Relatórios do Windows Error Reporting.', true], ['logs', 'Logs antigos do Windows', 'Logs de CBS e DISM.', true],
      ['browser-chrome', 'Cache do Google Chrome', 'Cache de páginas e código.', true], ['browser-edge', 'Cache do Microsoft Edge', 'Cache de páginas e código.', true],
      ['browser-brave', 'Cache do Brave', 'Cache de páginas e código.', true], ['browser-firefox', 'Cache do Firefox', 'cache2 de todos os perfis.', true],
      ['recycle-bin', 'Lixeira', 'Itens apagados que ainda estão na Lixeira.', false],
    ];
    return { at: now(), items: meta.map(([id, name, description, safe]) => ({ id, name, description, safe, bytes: sizes[id], files: Math.round(sizes[id] / 9e4), browserRunning: id === 'browser-chrome' })) };
  },
  'cleaner:clean': async (ids) => (await wait(1500), { ok: true, freed: ids.length * 3.1e8 }),
  'wu:status': async () => ({ pausedUntil: state.wuPaused || '', service: 'Running', startType: 'Manual', lastHotfix: { id: 'KB5044284', at: new Date(Date.now() - 6 * 864e5).toISOString(), description: 'Security Update' }, rebootPending: false }),
  'wu:pause': async (d) => ((state.wuPaused = new Date(Date.now() + d * 864e5).toISOString()), { ok: true }),
  'wu:resume': async () => ((state.wuPaused = ''), { ok: true }),
  'startup:list': async () => (await wait(300), [
    { name: 'Discord', command: '"C:\\Users\\voce\\AppData\\Local\\Discord\\Update.exe" --processStart Discord.exe', scope: 'Usuário', approvedKey: 'k1', enabled: true, kind: 'registry' },
    { name: 'Steam', command: '"C:\\Program Files (x86)\\Steam\\steam.exe" -silent', scope: 'Usuário', approvedKey: 'k1', enabled: true, kind: 'registry' },
    { name: 'SecurityHealth', command: '%windir%\\system32\\SecurityHealthSystray.exe', scope: 'Todos os usuários', approvedKey: 'k2', enabled: true, kind: 'registry' },
    { name: 'OneDrive', command: '"C:\\Program Files\\Microsoft OneDrive\\OneDrive.exe" /background', scope: 'Usuário', approvedKey: 'k1', enabled: false, kind: 'registry' },
    { name: 'Spotify.lnk', command: 'C:\\Users\\voce\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\Spotify.lnk', scope: 'Usuário', approvedKey: 'k3', enabled: true, kind: 'folder' },
  ]),
  'startup:set': async () => (await wait(200), { ok: true }),
  'timer:status': async () => ({ coarsest: 15.625, finest: 0.5, current: state.timer || 15.625, holding: state.timer }),
  'timer:set': async (ms) => ((state.timer = ms), { ok: true, holding: ms }),
  'timer:reset': async () => ((state.timer = null), { ok: true }),
  'msi:list': async () => (await wait(300), [
    { id: 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\PCI\\VEN_10DE&DEV_2786\\4&1', name: 'NVIDIA GeForce RTX 4070', class: 'Display', msi: 1, priority: null },
    { id: 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\PCI\\VEN_8086&DEV_125C\\4&2', name: 'Intel(R) Ethernet Controller I226-V', class: 'Net', msi: 1, priority: null },
    { id: 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\PCI\\VEN_1022&DEV_15B6\\4&3', name: 'Controlador de host compatível com USB xHCI', class: 'USB', msi: null, priority: null },
    { id: 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\PCI\\VEN_144D&DEV_A80C\\4&4', name: 'Controlador de Memória Expressa NVM Padrão', class: 'SCSIAdapter', msi: 1, priority: null },
    { id: 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\PCI\\VEN_10DE&DEV_22BC\\4&5', name: 'Controlador de Áudio de Alta Definição', class: 'MEDIA', msi: 0, priority: null },
  ]),
  'msi:set': async () => (await wait(200), { ok: true, restart: 'reboot' }),
  'dpc:sample': async (s = 10) => (await wait(s * 200), { series: Array.from({ length: s }, () => ({ dpc: +(Math.random() * 1.2).toFixed(3), isr: +(Math.random() * 0.4).toFixed(3), dpcRate: 800 + Math.round(Math.random() * 900), isrRate: 9000 + Math.round(Math.random() * 6000) })) }),
  'debloat:scan': async () => (await wait(700), [
    { name: 'Microsoft.BingNews', label: 'Notícias', level: 'recommended', installed: true, version: '4.1' },
    { name: 'Clipchamp.Clipchamp', label: 'Clipchamp', level: 'recommended', installed: true, version: '3.0' },
    { name: 'Microsoft.WindowsMaps', label: 'Mapas', level: 'recommended', installed: false, removedByApp: true, familyName: 'Microsoft.WindowsMaps_8wekyb3d8bbwe' },
    { name: 'Microsoft.YourPhone', label: 'Vincular ao Celular', level: 'optional', installed: true, version: '1.24' },
    { name: 'Microsoft.WindowsCalculator', label: 'Calculadora', level: 'keep', installed: true, version: '11.2' },
  ]),
  'debloat:remove': async () => (await wait(600), { ok: true }),
  'debloat:reinstall': async () => (await wait(600), { ok: true }),
  'sched:list': async () => [
    { id: 'clean-daily', name: 'Limpeza diária', description: 'Limpa temporários, caches do Windows Update e miniaturas todos os dias às 12h.', trigger: 'daily', at: '12:00', task: 'clean' },
    { id: 'clean-weekly', name: 'Limpeza semanal', description: 'Mesma limpeza segura, todo domingo às 12h.', trigger: 'weekly', at: '12:00', task: 'clean' },
    { id: 'verify-logon', name: 'Verificar tweaks ao entrar', description: 'Ao fazer logon, confere se os tweaks aplicados continuam ativos e reaplica os que o Windows desfez.', trigger: 'logon', task: 'repair' },
    { id: 'restore-weekly', name: 'Ponto de restauração semanal', description: 'Cria um ponto de restauração do sistema toda segunda-feira às 10h.', trigger: 'weekly-monday', at: '10:00', task: 'restore-point' },
  ].map((t) => ({ ...t, installed: state.tasks.has(t.id), state: state.tasks.has(t.id) ? 'Ready' : undefined, next: state.tasks.has(t.id) ? new Date(Date.now() + 36e5 * 5).toISOString() : null })),
  'sched:create': async (id) => (state.tasks.add(id), { ok: true }),
  'sched:remove': async (id) => (state.tasks.delete(id), { ok: true }),
  'sched:run': async () => ({ ok: true }),
  'backups:status': async () => (await wait(400), { enabled: true, points: [{ seq: 12, description: 'ctrl - antes das otimizações', type: 12, created: new Date(Date.now() - 864e5).toISOString() }, { seq: 11, description: 'Windows Update', type: 0, created: new Date(Date.now() - 6 * 864e5).toISOString() }] }),
  'backups:create': async () => (await wait(1500), { ok: true }),
  'backups:enable': async () => ({ ok: true }),
  'backups:openRestore': async () => ({ ok: true }),
  'state:get': async () => ({ applied: state.applied, history: state.history, sweeps: state.sweeps, settings: state.settings, onboarded: state.onboarded, dns: state.dns }),
  'settings:set': async (patch) => Object.assign(state.settings, patch),
  'onboarding:done': async () => {
    state.onboarded = true;
    try {
      sessionStorage.setItem('ctrl.mock.onboarded', '1');
    } catch {}
    return { ok: true };
  },
  'state:export': async () => ({ ok: true, path: 'C:\\ctrl.json' }),
  'state:import': async () => ({ ok: false, canceled: true }),
  'state:reset': async () => ({ ok: true }),
  'state:openFolder': async () => ({ ok: true }),
};

export const mockBackend = {
  invoke: async (channel, ...args) => {
    const h = handlers[channel];
    if (!h) throw new Error(`Canal sem mock: ${channel}`);
    return h(...args);
  },
  on: (channel, cb) => {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel).add(cb);
    return () => listeners.get(channel).delete(cb);
  },
};
