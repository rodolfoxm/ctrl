import { Clock, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { call } from '../lib/api.js';
import { date, ago, ms } from '../lib/format.js';
import { Card, Stat, Loading, useAsync, Callout, Empty } from '../components/ui.jsx';

export default function BootView() {
  const b = useAsync(() => call('health:boot'), []);
  if (b.loading && !b.data) return <Loading />;
  const d = b.data || {};
  const events = [...(d.events || [])].reverse();
  const max = Math.max(1, ...events.map((e) => e.total));
  const avg = events.length ? events.reduce((a, e) => a + e.total, 0) / events.length : null;
  const last = d.events?.[0];
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Card title="Tempo de inicialização" sub="Medido pelo próprio Windows (Diagnostics-Performance) a cada boot completo." icon={Clock}>
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <Stat label="Último boot" value={last ? ms(last.total) : '—'} sub={d.lastBoot ? ago(d.lastBoot) : ''} />
          <Stat label="Média" value={avg ? ms(avg) : '—'} sub={events.length ? `${events.length} boots` : ''} />
          <Stat label="Até a área de trabalho" value={last ? ms(last.main) : '—'} sub="Caminho principal" />
          <Stat label="Pós-boot" value={last ? ms(last.post) : '—'} sub="Apps e serviços depois do logon" />
        </div>
        {events.length ? (
          <>
            <div className="bars">
              {events.map((e) => (
                <div key={e.at} className="bar" style={{ height: `${(e.total / max) * 100}%` }} title={`${date(e.at)} — ${ms(e.total)} (principal ${ms(e.main)}, pós-boot ${ms(e.post)})`} />
              ))}
            </div>
            <div className="row tiny dim" style={{ marginTop: 6 }}><span>{date(events[0].at, { dateStyle: 'short' })}</span><span className="grow" /><span>{date(events[events.length - 1].at, { dateStyle: 'short' })}</span></div>
          </>
        ) : d.error ? (
          <Callout tone="warning" icon={ShieldAlert}>O histórico de boot só pode ser lido como administrador (log Diagnostics-Performance).</Callout>
        ) : (
          <Empty title="Sem medições ainda">O Windows registra o tempo de boot depois de desligamentos completos (sem Inicialização Rápida).</Empty>
        )}
      </Card>
      <div className="small dim">Um pós-boot alto costuma ser culpa de apps de inicialização — revise em <Link to="/system/startup">Sistema › Inicialização</Link>.</div>
    </div>
  );
}
