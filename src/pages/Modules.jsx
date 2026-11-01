import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useApp } from '../context.jsx';
import { AREAS, modulePath } from '../nav.js';
import { iconFor } from '../lib/icons.js';
import { Page, Hero } from '../components/Page.jsx';
import { Meter, Loading } from '../components/ui.jsx';
import { AreaSwitch } from './AreaPage.jsx';

export default function Modules() {
  const { catalog, status } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  if (!catalog) return <Page title="Módulos"><Loading /></Page>;
  const q = query.toLowerCase();
  const total = catalog.tweaks.filter((t) => !t.hiddenReason);
  const active = total.filter((t) => status[t.id] === true);
  return (
    <Page title="Catálogo completo">
      <AreaSwitch active="modules" />
      <Hero title="Todo o catálogo, organizado por módulo" aside={
        <div style={{ textAlign: 'right' }}>
          <div className="stat-value">{active.length}<small>/ {total.length}</small></div>
          <div className="small dim">ajustes ativos nesta máquina</div>
        </div>
      }>
        {catalog.modules.length} módulos com {catalog.tweaks.length} ajustes. Cada um mostra quantos já estão ativos nesta máquina.
      </Hero>
      <div className="toolbar">
        <div className="search-box"><Search /><input className="input" placeholder="Filtrar módulos…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      </div>
      {Object.entries(AREAS).filter(([key]) => key !== 'hardware').map(([key, area]) => {
        const mods = catalog.modules.filter((m) => m.area === key && `${m.label} ${m.description}`.toLowerCase().includes(q));
        if (!mods.length) return null;
        return (
          <div key={key}>
            <div className="section-title"><area.icon size={16} className="dim" /><h2>{area.label}</h2></div>
            <div className="grid grid-auto">
              {mods.map((m) => {
                const Icon = iconFor(m.icon);
                const tw = catalog.tweaks.filter((t) => t.module === m.id && !t.hiddenReason);
                const on = tw.filter((t) => status[t.id] === true).length;
                return (
                  <button key={m.id} className="card module-card" onClick={() => navigate(modulePath(m.id))}>
                    <div className="row">
                      <div className="card-icon"><Icon /></div>
                      <div className="grow">
                        <div style={{ fontWeight: 600 }}>{m.label}</div>
                        <div className="tiny dim">{on}/{tw.length} ativos</div>
                      </div>
                    </div>
                    <div className="small muted">{m.description}</div>
                    <Meter value={tw.length ? (on / tw.length) * 100 : 0} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </Page>
  );
}
