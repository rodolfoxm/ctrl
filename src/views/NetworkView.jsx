import { useState } from 'react';
import { Activity, Globe, Undo2, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { ago } from '../lib/format.js';
import { Card, Stat, Badge, Sparkline, Loading, useAsync, ActionButton } from '../components/ui.jsx';
import ModuleView from '../components/ModuleView.jsx';

function quality(r) {
  if (!r || r.avg == null) return { tone: 'danger', label: 'Sem resposta' };
  if (r.lost > 0) return { tone: 'warning', label: `${Math.round((r.lost / r.sent) * 100)}% de perda` };
  if (r.jitter > 8 || r.avg > 80) return { tone: 'warning', label: 'Instável' };
  if (r.avg < 30 && r.jitter < 3) return { tone: 'success', label: 'Excelente' };
  return { tone: 'accent', label: 'Boa' };
}

export function DnsStatus() {
  const { toast } = useApp();
  const st = useAsync(() => call('net:state'), []);
  if (st.loading && !st.data) return <Loading />;
  const d = st.data;
  return (
    <Card
      title="DNS em uso"
      icon={Globe}
      end={d?.changed && (
        <ActionButton className="btn btn-sm" icon={Undo2} onClick={async () => {
          const r = await call('net:revertDns');
          if (r?.ok) toast('DNS original restaurado.', { tone: 'success' }); else toast(r?.error, { tone: 'error' });
          st.reload();
        }}>Restaurar original</ActionButton>
      )}
    >
      {d?.interfaces?.length ? d.interfaces.map((i) => (
        <div key={i.alias} className="row" style={{ padding: '6px 0' }}>
          <span className="dot success" />
          <span className="grow">{i.alias}</span>
          <span className="mono muted">{i.servers.join(', ') || 'automático (DHCP)'}</span>
        </div>
      )) : <div className="dim small">Nenhum adaptador conectado.</div>}
      {d?.changed ? (
        <div className="small muted" style={{ marginTop: 8 }}>Alterado pelo app para <strong>{d.changed.name}</strong> {ago(d.changed.at)}. Ao restaurar, cada adaptador volta exatamente ao que estava antes.</div>
      ) : (
        <div className="small dim" style={{ marginTop: 8 }}>Compare provedores em <Link to="/network/dns">Benchmark de DNS</Link>.</div>
      )}
    </Card>
  );
}

export default function NetworkView() {
  const [lat, setLat] = useState(null);
  const run = async () => setLat(await call('net:latency', ['1.1.1.1', '8.8.8.8']));
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="grid grid-2">
        <Card title="Latência, jitter e perda" sub="20 pings para Cloudflare e Google." icon={Activity} end={<ActionButton className="btn btn-sm btn-primary" icon={Play} onClick={run}>{lat ? 'Testar de novo' : 'Testar'}</ActionButton>}>
          {lat ? (
            <div className="stack">
              {lat.results.map((r) => {
                const q = quality(r);
                return (
                  <div key={r.host}>
                    <div className="row" style={{ marginBottom: 6 }}>
                      <span className="mono">{r.host}</span>
                      <Badge tone={q.tone}>{q.label}</Badge>
                    </div>
                    <div className="grid grid-4">
                      <Stat label="Média" value={r.avg != null ? Math.round(r.avg) : '—'} unit="ms" />
                      <Stat label="p95" value={r.p95 ?? '—'} unit="ms" />
                      <Stat label="Jitter" value={r.jitter ?? '—'} unit="ms" />
                      <Stat label="Perda" value={r.lost} unit={`/${r.sent}`} />
                    </div>
                    <Sparkline data={r.samples} height={40} color="var(--c-net)" />
                  </div>
                );
              })}
            </div>
          ) : <div className="dim small">Mede o tempo de resposta e a variação entre pings — o que mais pesa em jogos online.</div>}
        </Card>
        <DnsStatus />
      </div>
      <ModuleView moduleId="network" />
    </div>
  );
}
