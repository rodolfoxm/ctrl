import { Cpu, MemoryStick, MonitorCog, HardDrive, CircuitBoard, Laptop, Wifi, RefreshCw } from 'lucide-react';
import { call } from '../lib/api.js';
import { bytes, date, ago } from '../lib/format.js';
import { Card, Meter, Loading, useAsync, Callout } from '../components/ui.jsx';

export default function HardwareView() {
  const hw = useAsync(() => call('hw:static'), []);
  if (hw.loading && !hw.data) return <Loading label="Lendo o hardware…" />;
  if (hw.error) return <Callout tone="danger">{hw.error}</Callout>;
  const d = hw.data;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row">
        <div className="grow muted small">Dados lidos do Windows (CIM/WMI). Nada é enviado para fora do PC.</div>
        <button className="btn btn-sm btn-ghost" onClick={() => call('hw:static', true).then(hw.setData)}><RefreshCw /> Atualizar</button>
      </div>
      <div className="grid grid-2">
        <Card title="Processador" icon={Cpu}>
          <div style={{ fontWeight: 600, marginBottom: 8 }} className="selectable">{d.cpu.name}</div>
          <dl className="kv">
            <dt>Núcleos / threads</dt><dd>{d.cpu.cores} / {d.cpu.threads}</dd>
            <dt>Clock máximo</dt><dd>{(d.cpu.maxMhz / 1000).toFixed(2)} GHz</dd>
            <dt>Soquete</dt><dd>{d.cpu.socket || '—'}</dd>
          </dl>
        </Card>
        <Card title="Placa-mãe e BIOS" icon={CircuitBoard}>
          <div style={{ fontWeight: 600, marginBottom: 8 }} className="selectable">{d.board.manufacturer} {d.board.product}</div>
          <dl className="kv">
            <dt>BIOS</dt><dd>{d.board.bios}</dd>
            <dt>Data da BIOS</dt><dd>{d.board.biosDate || '—'}</dd>
            <dt>Sistema</dt><dd>{d.computer.manufacturer} {d.computer.model}</dd>
          </dl>
        </Card>
        <Card title="Memória" icon={MemoryStick}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{bytes(d.memory.total, 0)} instalados</div>
          <table className="table">
            <tbody>
              {d.memory.modules.map((m, i) => (
                <tr key={i}><td>Pente {i + 1}</td><td>{bytes(m.size, 0)}</td><td>{m.speed ? `${m.speed} MT/s` : '—'}</td><td className="dim">{m.maker} {m.part}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Placa de vídeo" icon={MonitorCog}>
          {d.gpus.map((g) => (
            <div key={g.name} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600 }} className="selectable">{g.name}</div>
              <div className="small muted">
                {g.vram ? `${bytes(g.vram, 0)} VRAM · ` : ''}{g.resolution !== 'x' ? `${g.resolution} @ ${g.refresh} Hz · ` : ''}driver {g.driver}
              </div>
            </div>
          ))}
        </Card>
        <Card title="Armazenamento" icon={HardDrive}>
          {d.disks.map((k) => (
            <div key={k.name} className="row" style={{ padding: '4px 0' }}>
              <span className="grow">{k.name}</span>
              <span className="dim small">{k.media} · {k.bus}</span>
              <span style={{ minWidth: 70, textAlign: 'right' }}>{bytes(k.size, 0)}</span>
            </div>
          ))}
          <div style={{ marginTop: 10 }} className="stack">
            {d.volumes.map((v) => (
              <div key={v.letter}>
                <div className="row small"><strong>{v.letter}</strong><span className="grow" /><span className="muted">{bytes(v.free)} livres de {bytes(v.size)}</span></div>
                <Meter value={((v.size - v.free) / v.size) * 100} color={v.free / v.size < 0.1 ? 'var(--danger)' : undefined} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="Sistema operacional e rede" icon={Laptop}>
          <dl className="kv">
            <dt>Windows</dt><dd>{d.os.name} {d.os.version}</dd>
            <dt>Build</dt><dd>{d.os.build}</dd>
            <dt>Instalado em</dt><dd>{d.os.installed}</dd>
            <dt>Ligado desde</dt><dd>{date(d.os.bootTime)} ({ago(d.os.bootTime)})</dd>
          </dl>
          <div style={{ marginTop: 12 }}>
            {d.network.map((n) => (
              <div key={n.name} className="row small" style={{ padding: '3px 0' }}><Wifi size={14} className="dim" /><span className="grow">{n.description}</span><span className="muted">{n.speed}</span></div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
