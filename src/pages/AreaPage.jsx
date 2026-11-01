import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Boxes } from 'lucide-react';
import { useApp } from '../context.jsx';
import { AREAS, TWEAK_AREAS } from '../nav.js';
import { Page, Hero, SubNav } from '../components/Page.jsx';
import ModuleView from '../components/ModuleView.jsx';
import MonitorView from '../views/MonitorView.jsx';
import DpcView from '../views/DpcView.jsx';
import GamesView from '../views/GamesView.jsx';
import TimerView from '../views/TimerView.jsx';
import NetworkView from '../views/NetworkView.jsx';
import DnsView from '../views/DnsView.jsx';
import FixesView from '../views/FixesView.jsx';
import CleanerView from '../views/CleanerView.jsx';
import UpdatesView from '../views/UpdatesView.jsx';
import StartupView from '../views/StartupView.jsx';
import AppsView from '../views/AppsView.jsx';
import HardwareView from '../views/HardwareView.jsx';
import MachineView from '../views/MachineView.jsx';
import DisksView from '../views/DisksView.jsx';
import BatteryView from '../views/BatteryView.jsx';
import BootView from '../views/BootView.jsx';
import LiveGameView from '../views/LiveGameView.jsx';

/** Tabs above every area reached from "Ajustes", plus the whole catalogue. */
export function AreaSwitch({ active }) {
  return (
    <nav className="area-switch" aria-label="Áreas de ajustes">
      {TWEAK_AREAS.map((id) => {
        const Icon = AREAS[id].icon;
        return <Link key={id} to={`/${id}`} className={active === id ? 'active' : ''}><Icon /> {AREAS[id].label}</Link>;
      })}
      <Link to="/modules" className={active === 'modules' ? 'active' : ''}><Boxes /> Catálogo completo</Link>
    </nav>
  );
}

const VIEWS = {
  monitor: MonitorView, dpc: DpcView, games: GamesView, timer: TimerView, network: NetworkView, dns: DnsView,
  fixes: FixesView, cleaner: CleanerView, updates: UpdatesView, startup: StartupView, apps: AppsView,
  hardware: HardwareView, machine: MachineView, disks: DisksView, battery: BatteryView, boot: BootView, live: LiveGameView,
};

export default function AreaPage() {
  const { area, sub } = useParams();
  const navigate = useNavigate();
  const { catalog } = useApp();
  const cfg = AREAS[area];
  if (!cfg) return <Navigate to="/" replace />;
  const current = cfg.subs.find((s) => s.id === sub) || cfg.subs[0];
  if (!sub) return <Navigate to={`/${area}/${current.id}`} replace />;
  const items = cfg.subs.map((s) => ({
    ...s,
    count: s.module ? catalog?.tweaks.filter((t) => t.module === s.module && !t.hiddenReason).length : undefined,
  }));
  const View = current.view ? VIEWS[current.view] : null;
  return (
    <Page title={`${cfg.label} · ${current.label}`}>
      {TWEAK_AREAS.includes(area) && <AreaSwitch active={area} />}
      <Hero title={cfg.title}>{cfg.description}</Hero>
      <SubNav items={items} active={current.id} onChange={(id) => navigate(`/${area}/${id}`)} />
      {View ? <View /> : <ModuleView key={current.module} moduleId={current.module} />}
    </Page>
  );
}
