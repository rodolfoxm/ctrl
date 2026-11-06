// Turns the raw NVMe health log and ATA SMART attributes into what the Disks page shows.
// The health rules follow CheckDiskStatus in CrystalDiskInfo (MIT, see THIRD-PARTY-NOTICES.md), with its default
// caution levels. Its per-model tables are much larger: here only the models whose life reading differs are listed.

const CAUTION_LIFE = 10; // percent left, CrystalDiskInfo's default
const VIRTUAL = /^(Parallels|VMware|QEMU)/;

// Attributes that count as a failure on an HDD when the value drops below the maker's threshold.
const HDD_CRITICAL = [[0x01, 0x0d], [0x16, 0x16], [0xbb, 0xbd], [0xbf, 0xc1], [0xc3, 0xd1], [0xd3, 0xd4], [0xdc, 0xe4], [0xe6, 0xe7], [0xf0, 0xf0], [0xfa, 0xfa], [0xfe, 0xfe]];
const TEMPERATURE = 0xc2; // thresholds on it are unreliable, so it never fails a drive
const BAD_SECTORS = [0x05, 0xc5, 0xc6];

// `read`: normalized value (default), raw value, raw counting up from 0, or the second raw byte counting up (WD/SanDisk).
const LIFE_RULES = [
  { model: /KINGSTON.*SA400/i, id: 0xe7, read: 'raw' },
  { model: /KINGSTON/i, id: 0xe7 },
  { model: /SAMSUNG/i, id: 0xb1 },
  { model: /KIOXIA|TOSHIBA/i, id: 0xad },
  { model: /PLEXTOR/i, id: 0xe8 },
  { model: /INTEL|OCZ/i, id: 0xe9 },
  { model: /MICRON|CRUCIAL|^MTFD|^CT\d/i, id: 0xca },
  { model: /SANDISK|SD ULTRA|SDLF1|^WDC? /i, id: 0xe6, read: 'byte1' },
  { model: /HFS.*(TND|MND)/, id: 0xe9, read: 'rawUp' },
  { model: /HFS.*TNF|SC311|SC401/, id: 0xe7, read: 'raw' },
  { model: /^(Apacer|ZADAK)/, id: 0xe7, read: 'raw' },
  { model: /^(Seagate|ZA)/, id: 0xe7, read: 'raw' },
];
const LIFE_FALLBACK = [0xe7, 0xa9, 0xe9, 0xb1, 0xca, 0xad, 0xe8];

const ATA_NAMES = {
  1: 'Taxa de erros de leitura', 2: 'Desempenho de transferência', 3: 'Tempo de partida', 4: 'Partidas e paradas', 5: 'Setores realocados',
  7: 'Taxa de erros de busca', 8: 'Desempenho de busca', 9: 'Horas ligado', 10: 'Novas tentativas de partida', 11: 'Recalibração',
  12: 'Ciclos de energia', 169: 'Vida útil restante', 171: 'Falhas de programação', 172: 'Falhas de apagamento', 173: 'Desgaste médio',
  174: 'Desligamentos inesperados', 177: 'Nivelamento de desgaste', 183: 'Quedas de velocidade SATA', 184: 'Erros de ponta a ponta',
  187: 'Erros incorrigíveis informados', 188: 'Tempo limite de comando', 189: 'Gravações em altura elevada', 190: 'Temperatura do ar',
  191: 'Sensor de impacto', 192: 'Desligamentos de emergência', 193: 'Ciclos de carga da cabeça', 194: 'Temperatura',
  195: 'Correções por ECC', 196: 'Eventos de realocação', 197: 'Setores pendentes', 198: 'Setores incorrigíveis', 199: 'Erros de CRC',
  200: 'Erros de gravação', 202: 'Vida útil usada', 231: 'Vida útil restante', 232: 'Reserva disponível', 233: 'Indicador de desgaste',
  240: 'Horas de voo da cabeça', 241: 'Total gravado', 242: 'Total lido',
};

const inRange = (id) => HDD_CRITICAL.some(([a, b]) => id >= a && id <= b);
const unsetRaw = (raw) => raw % 2 ** 32 === 0xffffffff; // all ones: the drive doesn't report it

/** Percent of life left on a SATA SSD, or null when the drive doesn't report it. */
function ataLife(model, attrs) {
  const byId = new Map(attrs.map((a) => [a.id, a]));
  const rule = LIFE_RULES.find((r) => r.model.test(model) && byId.has(r.id));
  const attr = rule ? byId.get(rule.id) : LIFE_FALLBACK.map((id) => byId.get(id)).find((a) => a && a.cur <= 100);
  if (!attr) return null;
  const byte1 = Math.floor(attr.raw / 256) % 256;
  const left = { raw: attr.raw % 256, rawUp: 100 - (attr.raw % 256), byte1: 100 - byte1 }[rule?.read] ?? attr.cur;
  return { id: attr.id, life: Math.max(0, Math.min(100, left)) };
}

function nvmeStatus(n) {
  if (n.crit > 0) return 'Unhealthy';
  // A threshold of 0 or above 100 means the drive doesn't report one.
  if (n.spareThr > 0 && n.spareThr <= 100) {
    if (n.spare < n.spareThr) return 'Unhealthy';
    if (n.spare === n.spareThr && n.spareThr !== 100) return 'Warning';
  }
  return 100 - n.used <= CAUTION_LIFE ? 'Warning' : 'Healthy';
}

/** Whether one attribute is below the maker's limit, in the sense that fails the drive. */
function belowLimit(a, hdd) {
  if (a.id === TEMPERATURE || !a.thr || a.cur >= a.thr) return false;
  return !hdd || inRange(a.id);
}

function ataStatus(attrs, hdd, life, thresholdsRead) {
  if (!attrs.length || (hdd && !thresholdsRead)) return 'Unknown';
  const sectors = attrs.filter((a) => BAD_SECTORS.includes(a.id));
  const known = hdd ? sectors.length > 0 : life != null || attrs.some((a) => a.thr);
  if (attrs.some((a) => belowLimit(a, hdd)) || life?.life === 0) return 'Unhealthy';
  if (!known) return 'Unknown';
  const badSectors = hdd && sectors.some((a) => !unsetRaw(a.raw) && a.raw % 65536 >= 1);
  return badSectors || (life && life.life <= CAUTION_LIFE) ? 'Warning' : 'Healthy';
}

// NVMe counts data in units of 512,000 bytes.
const tb = (units) => `${(units * 512000 / 1e12).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} TB`;

const nvmeRows = (n) => [
  ['Aviso crítico', n.crit],
  ['Temperatura', `${n.temp} °C`],
  ['Reserva disponível', `${n.spare}%`],
  ['Limite da reserva', `${n.spareThr}%`],
  ['Vida útil usada', `${n.used}%`],
  ['Total lido', tb(n.unitsRead)],
  ['Total gravado', tb(n.unitsWritten)],
  ['Comandos de leitura', n.hostReads],
  ['Comandos de gravação', n.hostWrites],
  ['Minutos ocupado', n.busy],
  ['Ciclos de energia', n.cycles],
  ['Horas ligado', n.hours],
  ['Desligamentos inesperados', n.unsafe],
  ['Erros de mídia', n.media],
  ['Entradas no registro de erros', n.errLog],
].map(([name, value]) => ({ name, value: typeof value === 'number' ? value.toLocaleString('pt-BR') : value }));

const hex = (id) => id.toString(16).toUpperCase().padStart(2, '0');
// Above 32 bits the raw value usually packs several fields, so a decimal number would mean nothing.
const rawText = (raw) => (raw <= 0xffffffff ? raw.toLocaleString('pt-BR') : `0x${raw.toString(16).toUpperCase()}`);

/** One disk as read by health.cjs → what the renderer shows. `windows` is Windows' own health verdict. */
function summarize(d) {
  const attrs = (d.ata || []).filter(Boolean); // PowerShell turns a missing list into [null]
  const hdd = d.media === 'HDD';
  const life = !hdd && attrs.length ? ataLife(d.name, attrs) : null;
  const virtual = VIRTUAL.test(d.name);
  let status = 'Unknown';
  if (!virtual && d.nvme) status = nvmeStatus(d.nvme);
  else if (!virtual) status = ataStatus(attrs, hdd, life, d.thresholdsRead);

  const windowsBad = d.windows && d.windows !== 'Healthy';
  let health = status === 'Unknown' ? d.windows : status;
  if (d.predictFailure) health = 'Unhealthy';
  else if (windowsBad && health === 'Healthy') health = d.windows;

  const sectors = attrs.filter((a) => BAD_SECTORS.includes(a.id) && !unsetRaw(a.raw));
  const byId = (id) => attrs.find((a) => a.id === id);
  const wear = d.nvme ? d.nvme.used : life ? 100 - life.life : null;
  return {
    name: d.name, serial: d.serial, media: d.media, bus: d.bus, size: d.size, firmware: d.firmware, status: d.status, health,
    temperature: d.nvme?.temp ?? d.temperature ?? (byId(0xc2) ? byId(0xc2).raw % 256 : null),
    wear,
    powerOnHours: d.nvme?.hours ?? d.powerOnHours,
    mediaErrors: d.nvme ? d.nvme.media : attrs.length ? sectors.reduce((n, a) => n + a.raw % 65536, 0) : null,
    startStop: d.nvme?.cycles ?? d.startStop ?? byId(12)?.raw ?? null,
    countersAvailable: !!(d.counters || d.nvme || attrs.length),
    nvmeRows: d.nvme ? nvmeRows(d.nvme) : null,
    attributes: attrs.map((a) => ({
      id: hex(a.id), name: ATA_NAMES[a.id] || 'Específico do fabricante', cur: a.cur, worst: a.worst, thr: a.thr, raw: rawText(a.raw),
      bad: belowLimit(a, hdd),
    })),
  };
}

module.exports = { summarize };
