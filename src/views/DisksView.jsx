import { HeartPulse, ShieldAlert, Thermometer } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { bytes } from '../lib/format.js';
import { Card, Badge, Stat, Meter, Loading, useAsync, Callout, Empty } from '../components/ui.jsx';

const HEALTH = { Healthy: ['success', 'Saudável'], Warning: ['warning', 'Atenção'], Unhealthy: ['danger', 'Com problemas'], Unknown: ['', 'Desconhecido'] };

/** Everything the drive reports: its health log on NVMe, its SMART attributes and the maker's limits on SATA. */
function Attributes({ disk }) {
  const count = disk.nvmeRows?.length || disk.attributes?.length;
  if (!count) return null;
  return (
    <details style={{ marginTop: 12 }}>
      <summary className="small muted">Todos os atributos ({count})</summary>
      <table className="table small" style={{ marginTop: 8 }}>
        {disk.nvmeRows ? (
          <tbody>{disk.nvmeRows.map((r) => <tr key={r.name}><td>{r.name}</td><td className="num">{r.value}</td></tr>)}</tbody>
        ) : (
          <>
            <thead><tr><th>ID</th><th>Atributo</th><th className="num">Atual</th><th className="num">Pior</th><th className="num">Limite</th><th className="num">Bruto</th></tr></thead>
            <tbody>
              {disk.attributes.map((a) => (
                <tr key={a.id} style={a.bad ? { color: 'var(--danger)' } : undefined}>
                  <td className="mono">{a.id}</td><td>{a.name}</td><td className="num">{a.cur}</td><td className="num">{a.worst}</td><td className="num">{a.thr}</td><td className="num mono">{a.raw}</td>
                </tr>
              ))}
            </tbody>
          </>
        )}
      </table>
    </details>
  );
}

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
  if (disks.error) return <Callout tone="danger">{disks.error} <button className="btn btn-sm" style={{ marginLeft: 10 }} onClick={disks.reload}>Tentar de novo</button></Callout>;
  return (
    <div className="stack" style={{ gap: 14 }}>
      {!info?.isAdmin && (
        <Callout tone="warning" icon={ShieldAlert}>Temperatura, desgaste e horas ligadas só podem ser lidos com o app aberto como administrador.</Callout>
      )}
      {disks.data?.length === 0 && <Empty title="Nenhum disco encontrado">O Windows não informou discos físicos. Abra o ctrl como administrador e tente de novo.</Empty>}
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
            {d.used != null && (
              <div style={{ marginBottom: 14 }}>
                <div className="row small" style={{ marginBottom: 6 }}>
                  <span className="grow">{bytes(d.used, 0)} usados de {bytes(d.used + d.free, 0)}{d.letters?.length ? ` · ${d.letters.join(' ')}` : ''}</span>
                  <span className="muted">{bytes(d.free, 0)} livres</span>
                </div>
                <Meter value={(d.used / (d.used + d.free)) * 100} color={d.free / (d.used + d.free) < 0.1 ? 'var(--warning)' : undefined} />
              </div>
            )}
            <div className="grid grid-4">
              <Stat label="Temperatura" value={d.temperature ?? '—'} unit={d.temperature != null ? '°C' : ''} color={tempTone(d.temperature)} />
              <Stat label="Vida útil restante" value={lifeLeft != null ? lifeLeft : '—'} unit={lifeLeft != null ? '%' : ''} color={lifeLeft != null && lifeLeft < 20 ? 'var(--danger)' : undefined} sub={d.media === 'HDD' ? 'Não se aplica a HDs' : lifeLeft == null ? 'Não informada pelo disco' : ''} />
              <Stat label="Horas ligado" value={d.powerOnHours != null ? d.powerOnHours.toLocaleString('pt-BR') : '—'} sub={d.powerOnHours ? `≈ ${(d.powerOnHours / 24 / 365).toFixed(1)} anos` : ''} />
              <Stat label="Erros de mídia" value={d.mediaErrors ?? '—'} color={d.mediaErrors ? 'var(--warning)' : undefined} sub={d.startStop ? `${d.startStop.toLocaleString('pt-BR')} ciclos liga/desliga` : ''} />
            </div>
            {lifeLeft != null && <div style={{ marginTop: 12 }}><Meter value={lifeLeft} color={lifeLeft < 20 ? 'var(--danger)' : 'var(--success)'} /></div>}
            {!d.countersAvailable && <div className="small dim" style={{ marginTop: 10 }}><Thermometer size={13} /> O controlador deste disco não expõe contadores de confiabilidade ao Windows.</div>}
            <Attributes disk={d} />
          </Card>
        );
      })}
    </div>
  );
}
