import { useEffect, useRef, useState } from 'react';
import { Cpu, MemoryStick, MonitorCog, HardDrive, Wifi, Thermometer, ListOrdered } from 'lucide-react';
import { call, on } from '../lib/api.js';
import { bytes, rate, duration } from '../lib/format.js';
import { Card, Sparkline, Stat, useAsync } from '../components/ui.jsx';

const HISTORY = 60;

/** Subscribes to the live sampler while mounted; returns the latest sample and history. */
export function useLiveStats() {
  const [latest, setLatest] = useState(null);
  const hist = useRef({ cpu: [], mem: [], gpu: [], disk: [], down: [], up: [] });
  useEffect(() => {
    call('hw:subscribe');
    const off = on('hw:update', (d) => {
      const h = hist.current;
      const push = (k, v) => {
        h[k] = [...h[k], v ?? 0].slice(-HISTORY);
      };
      push('cpu', d.cpu);
      push('mem', (d.memUsed / d.memTotal) * 100);
      push('gpu', d.gpu);
      push('disk', d.disk);
      push('down', d.netDown);
      push('up', d.netUp);
      setLatest(d);
    });
    return () => {
      off();
      call('hw:unsubscribe');
    };
  }, []);
  return { latest, hist: hist.current };
}

function Metric({ icon, title, value, unit, sub, data, color, max = 100 }) {
  return (
    <Card title={title} icon={icon} end={<span className="stat-value" style={{ fontSize: 20, color }}>{value}<small>{unit}</small></span>}>
      <Sparkline data={data} max={max} color={color} height={70} />
      {sub && <div className="small dim" style={{ marginTop: 8 }}>{sub}</div>}
    </Card>
  );
}

export default function MonitorView() {
  const { latest: d, hist } = useLiveStats();
  const procs = useAsync(() => call('hw:processes'), []);
  useEffect(() => {
    const t = setInterval(procs.reload, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const netMax = Math.max(1024 * 64, ...hist.down, ...hist.up);
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="grid grid-3">
        <Metric icon={Cpu} title="CPU" value={d ? d.cpu : '—'} unit="%" data={hist.cpu} color="var(--c-cpu)" sub={d ? `${d.perCore?.length} threads · ativo há ${duration(d.uptime)}` : 'Conectando ao monitor…'} />
        <Metric icon={MemoryStick} title="Memória" value={d ? Math.round((d.memUsed / d.memTotal) * 100) : '—'} unit="%" data={hist.mem} color="var(--c-ram)" sub={d ? `${bytes(d.memUsed)} de ${bytes(d.memTotal)}` : ''} />
        <Metric icon={MonitorCog} title="GPU (3D)" value={d?.gpu ?? '—'} unit="%" data={hist.gpu} color="var(--c-gpu)" sub={d?.gpuMem != null ? `${bytes(d.gpuMem)} de VRAM dedicada em uso` : 'Contador de GPU indisponível'} />
        <Metric icon={HardDrive} title="Disco" value={d?.disk ?? '—'} unit="%" data={hist.disk} color="var(--c-disk)" sub="Tempo ativo de todos os discos físicos" />
        <Card title="Rede" icon={Wifi} end={<span className="small muted">↓ {rate(d?.netDown)} · ↑ {rate(d?.netUp)}</span>}>
          <div style={{ position: 'relative' }}>
            <Sparkline data={hist.down} max={netMax} color="var(--c-net)" height={70} />
            <div style={{ position: 'absolute', inset: 0 }}>
              <Sparkline data={hist.up} max={netMax} color="var(--accent)" height={70} fill={false} />
            </div>
          </div>
          <div className="chart-legend" style={{ marginTop: 8 }}>
            <span style={{ '--c': 'var(--c-net)' }}>Download</span>
            <span style={{ '--c': 'var(--accent)' }}>Upload</span>
          </div>
        </Card>
        <Card title="Temperatura" icon={Thermometer}>
          <Stat label="Zona térmica ACPI" value={d?.temp != null ? d.temp : '—'} unit={d?.temp != null ? '°C' : ''} sub={d?.temp == null ? 'A placa-mãe não expõe a temperatura via ACPI (comum em desktops).' : 'Leitura do firmware, não do sensor do núcleo.'} />
        </Card>
      </div>
      <Card title="Uso por núcleo" icon={Cpu}>
        <div className="cores">
          {(d?.perCore || Array.from({ length: 16 }, () => 0)).map((v, i) => (
            <div key={i} title={`Thread ${i}: ${v}%`}>
              <i style={{ height: `${v}%` }} />
            </div>
          ))}
        </div>
      </Card>
      <Card title="Processos que mais usam memória" icon={ListOrdered}>
        <table className="table">
          <thead>
            <tr><th>Processo</th><th className="num">PID</th><th className="num">Memória</th><th className="num">Tempo de CPU</th></tr>
          </thead>
          <tbody>
            {(procs.data || []).map((p) => (
              <tr key={p.id}><td>{p.name}</td><td className="num dim">{p.id}</td><td className="num">{bytes(p.mem)}</td><td className="num dim">{p.cpu != null ? `${p.cpu}s` : '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
