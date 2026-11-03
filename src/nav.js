import {
  BookOpen, House, History, SlidersHorizontal, ShieldCheck, Radar, Gauge, Gamepad2, Wifi, Settings2, CircuitBoard, Layers,
  CalendarClock, Settings, Cpu, MonitorCog, MemoryStick, HardDrive, Monitor, Zap, Activity, Waves,
  Timer, Mouse, Usb, Volume2, ListOrdered, Store, Network, Gauge as GaugeIcon, Shield, Wrench, Eraser, RefreshCw,
  EyeOff, Sparkles, Server, Folder, Rocket, LayoutGrid, PackageX, Info, ScanSearch, HeartPulse, BatteryMedium, Clock,
  BellOff, ShieldHalf, Power, Puzzle, Wand2,
} from 'lucide-react';

/** Sidebar, as in the brand guide. `match` lists the route prefixes that light up an item. */
export const NAV = [
  {
    title: null,
    items: [
      { id: 'overview', label: 'Visão geral', path: '/', icon: House },
      { id: 'tweaks', label: 'Ajustes', path: '/performance', icon: SlidersHorizontal, match: ['/performance', '/network', '/system', '/hardware', '/modules'] },
      { id: 'profiles', label: 'Perfis', path: '/profiles', icon: Layers },
      { id: 'games', label: 'Jogos', path: '/gaming', icon: Gamepad2, match: ['/gaming'] },
      { id: 'core', label: 'Core', path: '/core', icon: Wand2 },
      { id: 'verify', label: 'Verificação', path: '/guardian', icon: ShieldCheck },
      { id: 'history', label: 'Histórico', path: '/history', icon: History },
      { id: 'settings', label: 'Configurações', path: '/settings', icon: Settings },
    ],
  },
];

/** Smaller links at the foot of the sidebar. */
export const FOOTER_NAV = [
  { id: 'scheduler', label: 'Agendador', path: '/scheduler', icon: CalendarClock },
  { id: 'guide', label: 'Guia', path: '/guide', icon: BookOpen },
  { id: 'about', label: 'Sobre o ctrl', path: '/about', icon: Info },
];

/** The areas reachable from 'Ajustes', in the order of the switcher above each area. */
export const TWEAK_AREAS = ['performance', 'network', 'system', 'hardware'];

/**
 * Area pages and their sub-views. `module` renders that catalog module's tweak list;
 * `view` names a dedicated tool view (see pages/AreaPage.jsx).
 */
export const AREAS = {
  performance: {
    label: 'Desempenho', icon: Gauge, badge: 'Desempenho',
    title: 'Ajuste fino de CPU, GPU, memória e energia',
    description: 'Tweaks que mudam como o Windows agenda, alimenta e acorda o hardware — mais o monitor ao vivo e a medição de latência de drivers.',
    subs: [
      { id: 'cpu', label: 'CPU', icon: Cpu, group: 'núcleo', module: 'cpu' },
      { id: 'gpu', label: 'GPU', icon: MonitorCog, group: 'núcleo', module: 'gpu' },
      { id: 'memory', label: 'Memória', icon: MemoryStick, group: 'núcleo', module: 'memory' },
      { id: 'storage', label: 'Armazenamento', icon: HardDrive, group: 'núcleo', module: 'storage' },
      { id: 'display', label: 'Tela', icon: Monitor, group: 'núcleo', module: 'display' },
      { id: 'power', label: 'Energia', icon: Zap, group: 'núcleo', module: 'power' },
      { id: 'monitor', label: 'Monitor', icon: Activity, group: 'ferramentas', view: 'monitor' },
      { id: 'dpc', label: 'DPC e interrupções', icon: Waves, group: 'ferramentas', view: 'dpc' },
    ],
  },
  gaming: {
    label: 'Jogos', icon: Gamepad2, badge: 'Jogos',
    title: 'Menos latência, frametime mais estável',
    description: 'Biblioteca de jogos com perfis por executável, ajustes de agendador, input, USB, áudio e prioridade de processos.',
    subs: [
      { id: 'games', label: 'Biblioteca', icon: Gamepad2, group: 'jogar', view: 'games' },
      { id: 'live', label: 'Modo ao vivo', icon: Radar, group: 'jogar', view: 'live' },
      { id: 'gaming', label: 'Otimizador', icon: Rocket, group: 'jogar', module: 'gaming' },
      { id: 'latency', label: 'Latência', icon: Timer, group: 'jogar', module: 'latency' },
      { id: 'input', label: 'Input lag', icon: Mouse, group: 'jogar', module: 'input' },
      { id: 'timer', label: 'Resolução do timer', icon: Clock, group: 'jogar', view: 'timer' },
      { id: 'usb', label: 'USB', icon: Usb, group: 'ajustes', module: 'usb' },
      { id: 'audio', label: 'Áudio', icon: Volume2, group: 'ajustes', module: 'audio' },
      { id: 'priority', label: 'Prioridade', icon: ListOrdered, group: 'ajustes', module: 'priority' },
      { id: 'platforms', label: 'Plataformas', icon: Store, group: 'ajustes', module: 'platforms' },
    ],
  },
  network: {
    label: 'Rede', icon: Wifi, badge: 'Rede',
    title: 'Conexão rápida, estável e discreta',
    description: 'Teste de latência e jitter, benchmark e troca de DNS com reversão exata, ajustes de TCP e da placa de rede.',
    subs: [
      { id: 'overview', label: 'Rede', icon: Wifi, view: 'network' },
      { id: 'advanced', label: 'Otimizador avançado', icon: Network, module: 'network-adv' },
      { id: 'dns', label: 'Benchmark de DNS', icon: GaugeIcon, view: 'dns' },
      { id: 'privacy', label: 'Privacidade de rede', icon: Shield, module: 'net-privacy' },
    ],
  },
  system: {
    label: 'Sistema', icon: Settings2, badge: 'Sistema',
    title: 'Reparos, limpeza, privacidade e o Windows do seu jeito',
    description: 'Ferramentas de reparo, limpeza de disco, controle do Windows Update, telemetria, serviços e ajustes do Explorer.',
    subs: [
      { id: 'fixes', label: 'Correções', icon: Wrench, group: 'reparo', view: 'fixes' },
      { id: 'cleaner', label: 'Limpeza', icon: Eraser, group: 'reparo', view: 'cleaner' },
      { id: 'updates', label: 'Windows Update', icon: RefreshCw, group: 'reparo', view: 'updates' },
      { id: 'privacy', label: 'Privacidade', icon: EyeOff, group: 'privacidade', module: 'privacy' },
      { id: 'w11', label: 'Windows 11', icon: LayoutGrid, group: 'privacidade', module: 'w11' },
      { id: 'notifications', label: 'Notificações', icon: BellOff, group: 'privacidade', module: 'notifications' },
      { id: 'security', label: 'Segurança', icon: ShieldCheck, group: 'segurança', module: 'security' },
      { id: 'defender', label: 'Defender', icon: ShieldHalf, group: 'segurança', module: 'defender' },
      { id: 'visual', label: 'Visual', icon: Sparkles, group: 'ajustes', module: 'visual' },
      { id: 'services', label: 'Serviços', icon: Server, group: 'ajustes', module: 'services' },
      { id: 'explorer', label: 'Explorer', icon: Folder, group: 'ajustes', module: 'explorer' },
      { id: 'startup', label: 'Inicialização', icon: Rocket, group: 'ajustes', view: 'startup' },
      { id: 'boot', label: 'Boot', icon: Power, group: 'ajustes', module: 'boot' },
      { id: 'features', label: 'Recursos', icon: Puzzle, group: 'ajustes', module: 'features' },
      { id: 'apps', label: 'Apps', icon: PackageX, group: 'ajustes', view: 'apps' },
    ],
  },
  hardware: {
    label: 'Hardware', icon: CircuitBoard, badge: 'Hardware',
    title: 'O que tem dentro do seu PC — e como está a saúde dele',
    description: 'Especificações, o perfil que o app detectou (e por que alguns tweaks ficam ocultos), saúde de discos e bateria e histórico de boot.',
    subs: [
      { id: 'info', label: 'Hardware', icon: Info, view: 'hardware' },
      { id: 'machine', label: 'Sua máquina', icon: ScanSearch, view: 'machine' },
      { id: 'disks', label: 'Saúde dos discos', icon: HeartPulse, view: 'disks' },
      { id: 'battery', label: 'Bateria', icon: BatteryMedium, view: 'battery' },
      { id: 'boot', label: 'Tempo de boot', icon: Clock, view: 'boot' },
    ],
  },
};

/** Where each catalog module lives in the UI. */
export function modulePath(moduleId) {
  for (const [area, cfg] of Object.entries(AREAS)) {
    const sub = cfg.subs.find((s) => s.module === moduleId);
    if (sub) return `/${area}/${sub.id}`;
  }
  // Modules rendered inside a tool view rather than as their own tab.
  const embedded = { network: '/network/overview', startup: '/system/startup', updates: '/system/updates' };
  return embedded[moduleId] || '/modules';
}
