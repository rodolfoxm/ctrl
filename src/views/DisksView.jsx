import { HeartPulse, ShieldAlert, Thermometer } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { bytes } from '../lib/format.js';
import { Card, Badge, Stat, Meter, Loading, useAsync, Callout } from '../components/ui.jsx';

const HEALTH = { Healthy: ['success', 'Saudável'], Warning: ['warning', 'Atenção'], Unhealthy: ['danger', 'Com problemas'] };

function tempTone(t) {
  if (t == null) return undefined;
  if (t >= 70) return 'var(--danger)';
  if (t >= 55) return 'var(--warning)';
  return 'var(--success)';
}

export default function DisksView() {
  const { info } = useApp();
  const disks = useAsync(() => call('health:disks'), []);
  if (disks.loading && !disks.data) return <Loading label="Lendo contadores de confiabilidade…" />;
  if (disks.error) return <Callout tone="danger">{disks.error}</Callout>;
  return (
    <div className="stack" style={{ gap: 14 }}>
      {!info?.isAdmin && (
        <Callout tone="warning" icon={ShieldAlert}>Temperatura, desgaste e horas ligadas só podem ser lidos com o app aberto como administrador.</Callout>
      )}
      {(disks.data || []).map((d) => {
        const [tone, label] = HEALTH[d.health] || ['', d.health || 'Desconhecido'];
        const lifeLeft = d.wear != null ? Math.max(0, 100 - d.wear) : null;
        return (
          <Card
            key={d.serial || d.name}
            title={d.name}
            sub={`${d.media} · ${d.bus} · ${bytes(d.size, 0)}${d.firmware ? ` · firmware ${d.firmware}` : ''}`}
            icon={HeartPulse}
            end={<Badge tone={tone}>{label}</Badge>}
          >
            <div className="grid grid-4">
              <Stat label="Temperatura" value={d.temperature ?? '—'} unit={d.temperature != null ? '°C' : ''} color={tempTone(d.temperature)} />
              <Stat label="Vida útil restante" value={lifeLeft != null ? lifeLeft : '—'} unit={lifeLeft != null ? '%' : ''} color={lifeLeft != null && lifeLeft < 20 ? 'var(--danger)' : undefined} sub={d.media === 'HDD' ? 'Não se aplica a HDs' : lifeLeft == null ? 'Não informada pelo disco' : ''} />
              <Stat label="Horas ligado" value={d.powerOnHours != null ? d.powerOnHours.toLocaleString('pt-BR') : '—'} sub={d.powerOnHours ? `≈ ${(d.powerOnHours / 24 / 365).toFixed(1)} anos` : ''} />
              <Stat label="Erros de mídia" value={d.mediaErrors ?? '—'} color={d.mediaErrors ? 'var(--warning)' : undefined} sub={d.startStop ? `${d.startStop.toLocaleString('pt-BR')} ciclos liga/desliga` : ''} />
            </div>
            {lifeLeft != null && <div style={{ marginTop: 12 }}><Meter value={lifeLeft} color={lifeLeft < 20 ? 'var(--danger)' : 'var(--success)'} /></div>}
            {!d.countersAvailable && <div className="small dim" style={{ marginTop: 10 }}><Thermometer size={13} /> O controlador deste disco não expõe contadores de confiabilidade ao Windows.</div>}
          </Card>
        );
      })}
    </div>
  );
}
