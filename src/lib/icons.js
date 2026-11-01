import {
  Cpu, MonitorCog, MemoryStick, HardDrive, Monitor, Zap, Gamepad2, Timer, Mouse, Usb, Volume2, ListOrdered, Store,
  Wifi, Network, Shield, EyeOff, Sparkles, Server, Folder, Rocket, LayoutGrid, RefreshCw, Crosshair, Scale, Laptop,
  Feather, User, Box, ShieldCheck, ShieldHalf, BellOff, Power, Puzzle,
} from 'lucide-react';

const MAP = {
  cpu: Cpu, 'monitor-cog': MonitorCog, 'memory-stick': MemoryStick, 'hard-drive': HardDrive, monitor: Monitor, zap: Zap,
  'gamepad-2': Gamepad2, timer: Timer, mouse: Mouse, usb: Usb, 'volume-2': Volume2, 'list-ordered': ListOrdered, store: Store,
  wifi: Wifi, network: Network, shield: Shield, 'eye-off': EyeOff, sparkles: Sparkles, server: Server, folder: Folder,
  rocket: Rocket, 'layout-grid': LayoutGrid, 'refresh-cw': RefreshCw, crosshair: Crosshair, scale: Scale, laptop: Laptop,
  feather: Feather, user: User, 'shield-check': ShieldCheck, 'shield-half': ShieldHalf, 'bell-off': BellOff, power: Power,
  puzzle: Puzzle,
};

export function iconFor(name) {
  return MAP[name] || Box;
}
