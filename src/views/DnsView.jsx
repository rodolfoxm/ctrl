import { useState } from 'react';
import { Gauge, Play, Check, Trophy } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { Card, Badge, Loading, useAsync, ActionButton } from '../components/ui.jsx';
import { DnsStatus } from './NetworkView.jsx';

export default function DnsView() {
  const { toast, info } = useApp();
  const st = useAsync(() => call('net:state'), []);
  const [bench, setBench] = useState(null);
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    const res = await call('net:benchmark');
    setRunning(false);
    if (res?.ok === false) toast(res.error, { tone: 'error' });
    else setBench(res);
  };
  const use = async (id) => {
    const res = await call('net:setDns', id);
    if (res?.ok) {
      toast('DNS alterado. O original fica salvo para restaurar.', { tone: 'success' });
      st.reload();
    } else toast(res?.error || 'Falha.', { tone: 'error' });
  };
  const providers = st.data?.providers || [];
  const currentId = st.data?.changed?.provider;
  const best = bench?.results.find((r) => r.median != null);
  const max = Math.max(1, ...(bench?.results.map((r) => r.median || 0) || [1]));

  return (
    <div className="stack" style={{ gap: 14 }}>
      <Card
        title="Benchmark de DNS"
        sub="Resolve 8 domínios populares (Google, YouTube, Steam, Discord, Riot…) em cada provedor e no seu DNS atual, sem usar cache."
        icon={Gauge}
        end={<button className="btn btn-sm btn-primary" disabled={running} onClick={run}>{running ? <span className="spinner" /> : <Play />} {bench ? 'Rodar de novo' : 'Rodar benchmark'}</button>}
      >
        {running && <Loading label="Medindo provedores… (até 1 minuto)" />}
        {!running && bench && (
          <table className="table">
            <thead><tr><th>Provedor</th><th>Servidor</th><th style={{ width: '38%' }}>Mediana</th><th className="num">Falhas</th><th /></tr></thead>
            <tbody>
              {bench.results.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="row">
                      {r === best && <Trophy size={14} style={{ color: 'var(--warning)' }} />}
                      {r.name}
                      {r.current && <Badge>atual</Badge>}
                    </div>
                  </td>
                  <td className="mono dim">{r.server}</td>
                  <td>
                    <div className="row">
                      <div className="meter grow"><div style={{ width: `${r.median ? (r.median / max) * 100 : 0}%`, background: r === best ? 'var(--success)' : undefined }} /></div>
                      <span className="mono small" style={{ minWidth: 56, textAlign: 'right' }}>{r.median != null ? `${r.median} ms` : 'falhou'}</span>
                    </div>
                  </td>
                  <td className="num">{r.fails}</td>
                  <td className="num">
                    {!r.current && (currentId === r.id ? <Badge tone="success" icon={Check}>Em uso</Badge> : (
                      <ActionButton className="btn btn-xs" disabled={!info?.isAdmin} onClick={() => use(r.id)}>Usar</ActionButton>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!running && !bench && <div className="dim small">O DNS mais rápido depende do seu provedor e da sua região — por isso vale medir em vez de escolher pela fama.</div>}
      </Card>
      <div className="grid grid-2">
        <DnsStatus key={currentId || 'none'} />
        <Card title="Provedores" icon={Gauge}>
          <div className="stack" style={{ gap: 6 }}>
            {providers.map((p) => (
              <div key={p.id} className="row">
                <div className="grow">
                  <div className="small" style={{ fontWeight: 550 }}>{p.name} <span className="mono dim tiny">{p.servers.join(' · ')}</span></div>
                  <div className="tiny dim">{p.note}</div>
                </div>
                {currentId === p.id ? <Badge tone="success" icon={Check}>Em uso</Badge> : (
                  <ActionButton className="btn btn-xs" disabled={!info?.isAdmin} onClick={() => use(p.id)}>Usar</ActionButton>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
