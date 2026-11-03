// Batuta's assistant: what it knows about each game and how it turns "what do you play" into rules,
// memory cleaner thresholds and power behaviour. Pure functions; batuta.cjs applies the result.
const os = require('os');

const PLAN_BALANCED = '381b4222-f694-41f0-9685-ff5bb260df2e';

// What the assistant knows about each game. ram: how much it leans on memory (sets the cleaner);
// cores: 'p' keeps it on performance cores (lightly threaded games), 'all' for games that use every core.
const GAMES = [
  { id: 'cs2', name: 'Counter-Strike 2', exe: 'cs2', cores: 'p', ram: 'light' },
  { id: 'valorant', name: 'VALORANT', exe: 'VALORANT-Win64-Shipping', cores: 'p', ram: 'light' },
  { id: 'lol', name: 'League of Legends', exe: 'League of Legends', cores: 'p', ram: 'light' },
  { id: 'warzone', name: 'Call of Duty / Warzone', exe: 'cod', cores: 'all', ram: 'heavy' },
  { id: 'fortnite', name: 'Fortnite', exe: 'FortniteClient-Win64-Shipping', cores: 'all', ram: 'medium' },
  { id: 'apex', name: 'Apex Legends', exe: 'r5apex_dx12', cores: 'all', ram: 'medium' },
  { id: 'r6', name: 'Rainbow Six Siege', exe: 'RainbowSix', cores: 'all', ram: 'medium' },
  { id: 'pubg', name: 'PUBG', exe: 'TslGame', cores: 'all', ram: 'heavy' },
  { id: 'tarkov', name: 'Escape from Tarkov', exe: 'EscapeFromTarkov', cores: 'all', ram: 'heavy' },
  { id: 'gta', name: 'GTA V', exe: 'GTA5', cores: 'all', ram: 'heavy' },
  { id: 'minecraft', name: 'Minecraft (Java)', exe: 'javaw', cores: 'all', ram: 'medium', priority: 'above' },
];

// Background apps that keep running while you play; on hybrid CPUs they go to the E-cores.
const BACKGROUND = [
  { exe: 'Discord', name: 'Discord' },
  { exe: 'Spotify', name: 'Spotify' },
  { exe: 'SignalRgb', name: 'SignalRGB' },
  { exe: 'iCUE', name: 'Corsair iCUE' },
  { exe: 'wallpaper64', name: 'Wallpaper Engine' },
  { exe: 'steamwebhelper', name: 'Steam (navegador interno)' },
];

function ramGb() {
  return Math.round(os.totalmem() / 1073741824);
}

/** Builds the config for the games the user plays. Nothing is applied until `save`. */
function suggest(gameIds, { hybrid = false, laptop = false, background = true } = {}) {
  const chosen = GAMES.filter((g) => gameIds.includes(g.id));
  const rules = chosen.map((g) => ({
    exe: `${g.exe}.exe`, name: g.name, game: true,
    priority: g.priority || 'high', cores: hybrid ? g.cores : 'all', io: 'normal', gpu: 'high', efficiency: 'never',
  }));
  if (hybrid && background) {
    for (const a of BACKGROUND) rules.push({ exe: `${a.exe}.exe`, name: a.name, game: false, priority: 'normal', cores: 'e', io: 'normal', gpu: 'low', efficiency: 'default' });
  }
  // Memory cleaner: purge the standby list only while one of the games runs, when free memory drops
  // below a share of the RAM that depends on how memory-hungry the heaviest chosen game is.
  const weight = chosen.reduce((w, g) => Math.max(w, { light: 1, medium: 2, heavy: 3 }[g.ram]), 0);
  const ram = ramGb() * 1024;
  const share = { 1: 0.25, 2: 1 / 3, 3: 0.5 }[weight] || 0.25;
  const memory = {
    enabled: weight >= 2 || ram <= 16384,
    onlyGaming: true,
    listMB: weight >= 3 ? 1024 : 2048,
    freeMB: Math.max(1024, Math.min(ram - 2048, Math.round((ram * share) / 256) * 256)),
    exclusions: [],
  };
  const boost = laptop
    ? { enabled: true, activePlan: null, idlePlan: PLAN_BALANCED, idleMin: 5 }
    : { enabled: false, activePlan: null, idlePlan: PLAN_BALANCED, idleMin: 5 };
  const why = [];
  for (const g of chosen) {
    why.push(`${g.name}: prioridade ${g.priority === 'above' ? 'acima do normal' : 'alta'}, GPU em prioridade alta e nunca em modo de eficiência${hybrid ? (g.cores === 'p' ? ', só nos P-cores (usa poucos núcleos e ganha com os mais rápidos)' : ', em todos os núcleos (usa muitos ao mesmo tempo)') : ''}.`);
  }
  if (hybrid && background) why.push('Discord, Spotify, RGB e afins vão para os E-cores e deixam os P-cores livres para o jogo.');
  why.push(memory.enabled
    ? `Memória: limpa a lista de espera durante os jogos quando ela passa de ${memory.listMB} MB e a memória livre cai abaixo de ${memory.freeMB} MB (${ramGb()} GB de RAM${weight >= 3 ? ', jogo pesado em memória' : ''}).`
    : `Memória: limpeza desligada. Com ${ramGb()} GB de RAM e ${chosen.length > 1 ? 'esses jogos' : 'esse jogo'}, a lista de espera não costuma causar travadas.`);
  why.push(laptop ? 'Notebook: plano de desempenho quando você está usando e equilibrado depois de 5 minutos parado.' : 'Desktop: o plano fica com o Modo ao vivo e com os ajustes de energia que você já usa.');
  return { rules, memory, boost, profile: { games: gameIds }, why };
}

module.exports = { GAMES, BACKGROUND, suggest, ramGb, PLAN_BALANCED };
