import { useState } from 'react';
import { Waves, Play, Cpu, AlertTriangle } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { Card, Stat, Sparkline, Switch, Badge, Callout, Loading, useAsync, ActionButton } from '../components/ui.jsx';

const CLASS_LABEL = { Display: 'Vídeo', Net: 'Rede', USB: 'USB', SCSIAdapter: 'Armazenamento', HDC: 'Armazenamento', MEDIA: 'Áudio', System: 'Sistema' };

function verdict(avg, peak) {
  if (peak < 1 && avg < 0.3) return { tone: 'success', text: 'Excelente — carga de drivers muito baixa.' };
  if (peak < 3 && avg < 1) return { tone: 'accent', text: 'Boa — nada que deva causar stutter.' };
  if (peak < 8) return { tone: 'warning', text: 'Elevada — algum driver ocupa a CPU em picos. Pode causar estalos de áudio ou microtravadas.' };
  return { tone: 'danger', text: 'Alta — um driver está monopolizando a CPU. Verifique placa de rede, Wi-Fi, áudio e GPU.' };
}

export default function DpcView() {
  const { info, toast, noteRestart } = useApp();
  const [sample, setSample] = useState(null);
  const msi = useAsync(() => call('msi:list'), []);

  const run = async () => {
    setSample(null);
    const res = await call('dpc:sample', 10);
    if (res?.ok === false) toast(res.error, { tone: 'error' });
    else setSample(res);
  };
  const s = sample?.series || [];
  const total = s.map((x) => x.dpc + x.isr);
  const avg = total.length ? total.reduce((a, b) => a + b, 0) / total.length : 0;
  const peak = total.length ? Math.max(...total) : 0;
  const v = sample && verdict(avg, peak);

  const setMsi = async (dev, enabled) => {
    const res = await call('msi:set', dev.id, enabled);
    if (res?.ok) {
      noteRestart('reboot');
      msi.setData(msi.data.map((d) => (d.id === dev.id ? { ...d, msi: enabled ? 1 : 0 } : d)));
    } else toast(res?.error || 'Falha.', { tone: 'error' });
  };

  return (
    <div className="stack" style={{ gap: 14 }}>
      <Card
        title="Carga de DPC e interrupções"
        sub="Mede, por 10 segundos, quanto tempo de CPU os drivers gastam em rotinas de interrupção (ISR) e chamadas adiadas (DPC)."
        icon={Waves}
        end={<ActionButton className="btn btn-primary btn-sm" icon={Play} onClick={run}>{sample ? 'Medir de novo' : 'Medir agora'}</ActionButton>}
      >
        {sample ? (
          <>
            <div className="grid grid-4" style={{ marginBottom: 14 }}>
              <Stat label="Média DPC + ISR" value={avg.toFixed(2)} unit="%" />
              <Stat label="Pico" value={peak.toFixed(2)} unit="%" />
              <Stat label="DPCs/s (média)" value={Math.round(s.reduce((a, b) => a + b.dpcRate, 0) / s.length).toLocaleString('pt-BR')} />
              <Stat label="Interrupções/s" value={Math.round(s.reduce((a, b) => a + b.isrRate, 0) / s.length).toLocaleString('pt-BR')} />
            </div>
            <Sparkline data={total} max={Math.max(2, peak * 1.2)} height={80} />
            <div style={{ marginTop: 12 }}><Badge tone={v.tone}>{v.text}</Badge></div>
          </>
        ) : (
          <div className="dim small">Deixe o PC no uso normal (ou com o jogo aberto) e clique em “Medir agora”. Valores somados acima de ~3% em picos costumam indicar um driver problemático.</div>
        )}
      </Card>

      <Card title="Modo MSI por dispositivo" sub="Interrupções sinalizadas por mensagem (MSI) evitam compartilhar linhas de IRQ e reduzem latência. GPUs e controladores NVMe modernos já usam." icon={Cpu}>
        <Callout tone="warning" icon={AlertTriangle}>
          Só ative MSI em dispositivos cujo driver suporta — se o PC não iniciar depois, entre no Modo de Segurança e desative. Todas as mudanças exigem reinício.
        </Callout>
        {msi.loading ? <Loading /> : (
          <table className="table" style={{ marginTop: 12 }}>
            <thead><tr><th>Dispositivo</th><th>Tipo</th><th>Estado</th><th className="num">MSI</th></tr></thead>
            <tbody>
              {(msi.data || []).map((d) => (
                <tr key={d.id}>
                  <td>{d.name || <span className="dim">(sem nome)</span>}</td>
                  <td className="dim">{CLASS_LABEL[d.class] || d.class || '—'}</td>
                  <td>{d.msi === 1 ? <Badge tone="success">MSI ativo</Badge> : d.msi === 0 ? <Badge>Desativado</Badge> : <Badge>Padrão do driver</Badge>}</td>
                  <td className="num"><Switch on={d.msi === 1} onChange={(on) => setMsi(d, on)} disabled={!info?.isAdmin} label={`MSI ${d.name}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
