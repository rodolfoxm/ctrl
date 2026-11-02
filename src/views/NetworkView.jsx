import { useEffect, useState } from 'react';
import { Activity, Globe, Undo2, Play, Gauge } from 'lucide-react';
import { Link } from 'react-router-dom';
import { call, on } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { ago } from '../lib/format.js';
import { Card, Stat, Badge, Sparkline, Loading, useAsync, ActionButton, Meter } from '../components/ui.jsx';
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

const PHASE = { idle: 'Medindo a latência em repouso', download: 'Medindo durante o download', upload: 'Medindo durante o upload' };
const GRADE_TONE = { 'A+': 'success', A: 'success', B: 'warning', C: 'warning', D: 'danger', F: 'danger' };

function bloatAdvice(g) {
  if (g === 'A+' || g === 'A') return 'A conexão segura bem a carga: dá para jogar enquanto alguém baixa arquivos ou assiste a vídeos na mesma rede.';
  const strong = g === 'D' || g === 'F' ? ' Downloads, streams e backups em outros aparelhos vão causar lag nos jogos.' : '';
  return `A latência sobe quando a internet está cheia.${strong} O que resolve é ligar o SQM/QoS no roteador (aparece como "Smart Queue", "QoS adaptativo" ou "fq_codel/CAKE") limitando a banda a uns 90% do contratado. Ajustes no Windows não corrigem bufferbloat: ele acontece no roteador ou no provedor.`;
}

export function BufferbloatCard() {
  const { toast } = useApp();
  const [res, setRes] = useState(null);
  const [prog, setProg] = useState(null);
  useEffect(() => on('net:bloat', setProg), []);
  const run = async () => {
    setProg({ phase: 'idle', elapsed: 0, total: 1 });
    const r = await call('net:bufferbloat');
    setProg(null);
    if (r?.ok) setRes(r);
    else toast(r?.error || 'Falha no teste.', { tone: 'error' });
  };
  const phaseStat = (label, p) => (
    <Stat label={label} value={p.added != null ? `+${Math.round(p.added)}` : '—'} unit="ms" sub={`${p.mbps} Mbps · mediana ${p.median ?? '—'} ms`} />
  );
  return (
    <Card
      title="Bufferbloat"
      sub="Quanto a latência sobe quando a internet está cheia."
      icon={Gauge}
      end={<ActionButton className="btn btn-sm btn-primary" icon={Play} onClick={run} disabled={!!prog}>{res ? 'Testar de novo' : 'Testar'}</ActionButton>}
    >
      {prog ? (
        <div>
          <div className="row small" style={{ marginBottom: 8 }}>
            <span className="grow">{PHASE[prog.phase]}…</span>
            {prog.phase !== 'idle' && <span className="mono muted">{Math.round((prog.bytes || 0) / 1e6)} MB</span>}
          </div>
          <Meter value={((['idle', 'download', 'upload'].indexOf(prog.phase) + Math.min(1, prog.elapsed / prog.total)) / 3) * 100} />
        </div>
      ) : res ? (
        <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
          <div className="bloat-grade">
            <Badge tone={GRADE_TONE[res.grade]}>Nota</Badge>
            <strong>{res.grade}</strong>
          </div>
          <div className="grow stack" style={{ gap: 12 }}>
            <div className="grid grid-3">
              <Stat label="Em repouso" value={res.idle.median} unit="ms" sub="latência base" />
              {phaseStat('No download', res.download)}
              {phaseStat('No upload', res.upload)}
            </div>
            <div className="small muted">{bloatAdvice(res.grade)}</div>
          </div>
        </div>
      ) : (
        <div className="dim small">
          Mede a latência em repouso e depois com o download e o upload no máximo, como acontece quando alguém baixa um jogo ou sobe um vídeo
          enquanto você joga. Usa os servidores de teste da Cloudflare, leva uns 20 segundos e pode consumir até 370 MB.
        </div>
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
      <BufferbloatCard />
      <ModuleView moduleId="network" />
    </div>
  );
}
