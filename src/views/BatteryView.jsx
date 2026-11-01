import { BatteryMedium, BatteryCharging, PlugZap } from 'lucide-react';
import { call } from '../lib/api.js';
import { Card, Stat, Meter, Empty, Loading, useAsync, Callout } from '../components/ui.jsx';

const STATUS = { 1: 'Descarregando', 2: 'Na tomada', 3: 'Carregada', 4: 'Baixa', 5: 'Crítica', 6: 'Carregando', 7: 'Carregando', 8: 'Carregando', 9: 'Carregando', 11: 'Parcialmente carregada' };

export default function BatteryView() {
  const b = useAsync(() => call('health:battery'), []);
  if (b.loading && !b.data) return <Loading label="Gerando relatório de bateria…" />;
  if (b.error) return <Callout tone="danger">{b.error}</Callout>;
  if (!b.data?.present) {
    return (
      <Card>
        <Empty icon={PlugZap} title="Nenhuma bateria encontrada">Este PC funciona ligado na tomada — nada para medir aqui.</Empty>
      </Card>
    );
  }
  const d = b.data;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Card title="Agora" icon={BatteryCharging}>
        <div className="grid grid-3">
          <Stat label="Carga" value={d.charge} unit="%" />
          <Stat label="Estado" value={STATUS[d.status] || '—'} />
          <Stat label="Autonomia estimada" value={d.runtimeMin ? `${Math.floor(d.runtimeMin / 60)}h ${d.runtimeMin % 60}min` : '—'} />
        </div>
      </Card>
      {d.batteries.map((bat) => {
        const health = bat.design ? Math.round((bat.full / bat.design) * 100) : null;
        return (
          <Card key={bat.name} title={bat.name || 'Bateria'} sub={`${bat.maker || ''} ${bat.chemistry || ''}`} icon={BatteryMedium}>
            <div className="grid grid-4" style={{ marginBottom: 12 }}>
              <Stat label="Saúde" value={health ?? '—'} unit="%" color={health != null && health < 70 ? 'var(--warning)' : 'var(--success)'} />
              <Stat label="Capacidade atual" value={(bat.full / 1000).toFixed(1)} unit="Wh" />
              <Stat label="Capacidade de fábrica" value={(bat.design / 1000).toFixed(1)} unit="Wh" />
              <Stat label="Ciclos" value={bat.cycles ?? '—'} />
            </div>
            {health != null && <Meter value={health} color={health < 70 ? 'var(--warning)' : 'var(--success)'} />}
            <div className="small dim" style={{ marginTop: 8 }}>Saúde = capacidade de carga completa atual ÷ capacidade original. Abaixo de ~80% a perda de autonomia começa a ser perceptível.</div>
          </Card>
        );
      })}
    </div>
  );
}
