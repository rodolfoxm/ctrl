import { useState } from 'react';
import { Wrench, Network, MonitorSmartphone, Lock, Play, CheckCircle2, XCircle } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { Card, Badge, Loading } from '../components/ui.jsx';
import TweakList from '../components/TweakList.jsx';

const GROUPS = [
  { id: 'repair', label: 'Reparo do Windows', icon: Wrench },
  { id: 'network', label: 'Rede', icon: Network },
  { id: 'shell', label: 'Explorer e interface', icon: MonitorSmartphone },
];

export default function FixesView() {
  const { catalog, info, confirm, toast, noteRestart } = useApp();
  const [running, setRunning] = useState(null);
  const [results, setResults] = useState({});
  if (!catalog) return <Loading />;
  const fixTweaks = catalog.tweaks.filter((t) => t.tags?.includes('fix'));

  const run = async (a) => {
    if (a.confirm && !(await confirm(a.name, a.confirm, { confirmLabel: 'Continuar', danger: true }))) return;
    setRunning(a.id);
    const res = await call('actions:run', a.id);
    setRunning(null);
    setResults((r) => ({ ...r, [a.id]: res }));
    if (res?.ok) {
      toast(res.output || `${a.name}: concluído.`, { tone: 'success' });
      noteRestart(res.restart);
    } else toast(res?.error || 'Falha.', { tone: 'error', duration: 9000 });
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      {GROUPS.map((g) => (
        <div key={g.id}>
          <div className="section-title" style={{ marginTop: 0 }}>
            <g.icon size={16} className="dim" />
            <h2>{g.label}</h2>
          </div>
          <div className="grid grid-2">
            {catalog.actions.filter((a) => a.group === g.id).map((a) => {
              const res = results[a.id];
              return (
                <Card key={a.id} className="hover">
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div className="grow">
                      <div className="row" style={{ fontWeight: 600, marginBottom: 4 }}>
                        {a.name}
                        {a.admin && <Badge icon={Lock}>Admin</Badge>}
                        {a.restart === 'reboot' && <Badge tone="warning">Requer reinício</Badge>}
                      </div>
                      <div className="small muted">{a.description}</div>
                      {res && (
                        <div className="small row" style={{ marginTop: 8, color: res.ok ? 'var(--success)' : 'var(--danger)' }}>
                          {res.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                          <span className="selectable">{res.ok ? res.output || 'Concluído' : res.error}</span>
                        </div>
                      )}
                    </div>
                    <button className="btn btn-sm" disabled={!!running || (a.admin && !info?.isAdmin)} onClick={() => run(a)}>
                      {running === a.id ? <span className="spinner" /> : <Play />} Executar
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
      <div>
        <div className="section-title"><Wrench size={16} className="dim" /><h2>Configurações que outras ferramentas costumam quebrar</h2></div>
        <TweakList tweaks={fixTweaks} />
      </div>
    </div>
  );
}
