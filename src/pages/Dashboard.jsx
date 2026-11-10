import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Zap, Cpu, MemoryStick, MonitorCog, Wifi, HardDrive, ChevronRight, ArrowRight, CheckCircle2, AlertTriangle, XCircle, Undo2, BadgeCheck,
  ShieldCheck, Layers, Wrench, Stethoscope,
} from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { ago, rate, bytes, when } from '../lib/format.js';
import { Page } from '../components/Page.jsx';
import { Card, Meter, Badge, Loading, Empty, CountUp, useAsync, Sparkline, ActionButton } from '../components/ui.jsx';
import HealthDialog from '../components/HealthDialog.jsx';
import { useLiveStats } from '../views/MonitorView.jsx';
import { modulePath } from '../nav.js';

const ACTION_LABEL = { apply: 'Aplicado', revert: 'Desfeito', repair: 'Reparado', run: 'Executado', clean: 'Limpeza', 'restore-point': 'Ponto de restauração', 'remove-app': 'App removido', 'reinstall-app': 'App reinstalado' };

/** Compact log used on the overview and in Histórico. */
export function ActivityList({ items, empty = 'Nenhuma atividade ainda.' }) {
  if (!items?.length) return <div className="dim small">{empty}</div>;
  return (
    <div>
      {items.map((h, i) => {
        const Icon = h.ok === false ? XCircle : h.action === 'revert' ? Undo2 : CheckCircle2;
        const tone = h.ok === false ? 'bad' : h.action === 'revert' ? 'neutral' : 'ok';
        return (
          <div key={`${h.at}-${i}`} className="activity-row">
            <Icon size={20} className={tone} />
            <div className="grow">
              <strong className="ellipsis">{h.name || h.id}</strong>
              <div className="small dim ellipsis">
                {ACTION_LABEL[h.action] || h.action}
                {h.source && h.source !== 'manual' ? ` · ${h.source}` : ''}
                {h.error ? ` · ${h.error}` : ''}
              </div>
            </div>
            <span className="small dim">{when(h.at)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub, data, online }) {
  return (
    <Card className="metric">
      <div className="metric-head"><Icon /> {label}</div>
      <div className="metric-body">
        <div>
          {online != null ? (
            <div className="metric-value online"><span className={`dot ${online ? 'accent' : ''}`} /> {online ? 'Online' : 'Offline'}</div>
          ) : (
            <div className="metric-value">{value ?? '—'}{value != null && '%'}</div>
          )}
          <div className="metric-sub">{sub}</div>
        </div>
        {data && <Sparkline data={data} max={100} height={30} fill={false} />}
      </div>
    </Card>
  );
}

function LiveRow({ volume }) {
  const { latest: d, hist } = useLiveStats();
  const ram = d ? Math.round((d.memUsed / d.memTotal) * 100) : null;
  const used = volume ? Math.round(((volume.size - volume.free) / volume.size) * 100) : null;
  return (
    <div className="grid grid-5" style={{ marginTop: 14 }}>
      <Metric icon={Cpu} label="CPU" value={d?.cpu} sub="Em uso" data={hist.cpu} />
      <Metric icon={MonitorCog} label="GPU" value={d?.gpu} sub="Em uso" data={hist.gpu} />
      <Metric icon={MemoryStick} label="RAM" value={ram} sub="Em uso" data={hist.mem} />
      <Metric icon={Wifi} label="Rede" online={d ? d.netDown != null : null} sub={d ? `↓ ${rate(d.netDown)}` : '—'} />
      <Metric icon={HardDrive} label="Disco" value={used} sub={volume ? `${bytes(volume.free, 0)} livres` : 'Em uso'} data={hist.disk} />
    </div>
  );
}

function headline(s, missing) {
  const drifted = s.lastSweep?.drifted.length || 0;
  if (!s.appliedCount) return { title: 'Vamos otimizar seu Windows.', line: 'Comece pela otimização recomendada: segura e reversível.', warn: true };
  if (drifted) return { title: `O Windows desfez ${drifted} ajuste${drifted > 1 ? 's' : ''}.`, line: 'Dá para conferir e reaplicar daqui mesmo.', warn: true, drifted: true };
  if (missing) return { title: 'Seu sistema pode render mais.', line: `${missing} ajuste${missing > 1 ? 's' : ''} essencia${missing > 1 ? 'is' : 'l'} ainda não aplicado${missing > 1 ? 's' : ''}.`, warn: true };
  return { title: 'Seu sistema está protegido.', line: 'O Windows está otimizado, estável e pronto para uso.' };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { key } = useLocation();
  const { tweakById, runBatch, toast, info } = useApp();
  // Keyed on the navigation, so returning here after the first-run setup shows the new score.
  const sum = useAsync(() => call('dashboard:summary'), [key]);
  const machine = useAsync(() => call('machine:get'), []);
  const hw = useAsync(() => call('hw:static'), []);
  const s = sum.data;
  const m = machine.data;
  const h = hw.data;
  const missing = (s?.quickWinsMissing || []).map((id) => tweakById.get(id)).filter(Boolean);
  const runnable = missing.filter((t) => info?.isAdmin || !t.admin);
  const volume = h?.volumes?.find((v) => /^C:/i.test(v.letter)) || h?.volumes?.[0];

  const [health, setHealth] = useState(null); // which step of the health dialog is open

  // The alert comes from the last sweep, so re-read first: only what is still undone gets re-applied.
  const verifyAndRepair = async () => {
    const res = await call('guardian:verify');
    if (res?.ok === false) return toast(res.error, { tone: 'error' });
    const drifted = res.items.filter((i) => i.state === 'drifted').map((i) => i.id);
    if (drifted.length) {
      await runBatch('Reaplicando tweaks desfeitos', 'guardian:repair', drifted);
      await call('guardian:verify');
    } else toast('Conferido: nada está desfeito.', { tone: 'success' });
    sum.reload();
  };

  if (sum.loading && !s) return <Page title="Visão geral"><Loading label="Calculando a saúde do sistema…" /></Page>;
  if (!s) return <Page title="Visão geral"><Empty title="Não foi possível ler o sistema" action={<button className="btn btn-sm" onClick={sum.reload}>Tentar de novo</button>}>{sum.error || 'O Windows não respondeu à leitura.'}</Empty></Page>;

  const head = headline(s, missing.length);
  const cpu = m?.cpuName?.replace(/\s+\d+-Core Processor/i, '').replace(/\(R\)|\(TM\)/g, '').trim();
  // Physical disks (not volumes), SSDs first and the largest on top; the card shows two and links to the rest.
  const isSsd = (x) => /ssd|nvme/i.test(`${x.media} ${x.bus}`);
  const disks = [...(h?.disks || [])].sort((a, b) => isSsd(b) - isSsd(a) || b.size - a.size);
  const ramSpeed = h?.memory?.modules?.[0]?.speed;

  return (
    <Page title="Visão geral">
      <p className="greeting">{s.appliedCount ? 'Bom te ver de volta.' : 'Bem-vindo ao ctrl.'}</p>
      <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-0.03em' }}>{head.title}</h1>
      <div className={`status-line ${head.warn ? 'warn' : ''}`}>
        {head.warn ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />} {head.line}
      </div>
      {head.drifted && (
        <div className="row" style={{ marginTop: 12 }}>
          <ActionButton className="btn btn-sm btn-primary" icon={Wrench} onClick={verifyAndRepair}>Verificar e reparar</ActionButton>
          <button className="btn btn-sm btn-ghost" onClick={() => navigate('/guardian')}>Ver detalhes <ArrowRight /></button>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.6fr)', marginTop: 28 }}>
        <Card>
          <div className="stat-label" style={{ fontSize: 15, color: 'var(--text-1)' }}>Saúde do sistema</div>
          <button className="score-value score-button" onClick={() => setHealth('diagnosis')} title="Ver o que compõe a nota"><b><CountUp value={s.score} /></b><span>/ 100</span></button>
          <div className="health-bar" role="meter" aria-valuenow={s.score} aria-valuemin={0} aria-valuemax={100} aria-label="Saúde do sistema">
            <div style={{ width: `${Math.max(0, Math.min(100, s.score))}%` }} />
          </div>
          <div className="row wrap" style={{ marginTop: 16 }}>
            {runnable.length > 0 && <button className="btn btn-sm btn-primary" onClick={() => setHealth('confirm')}><Zap /> Otimizar agora</button>}
            <button className="btn btn-sm" onClick={() => setHealth('diagnosis')}><Stethoscope /> Ver diagnóstico</button>
          </div>
        </Card>
        <Card style={{ display: 'flex', alignItems: 'center' }}>
          <div className="reco grow">
            <div className="reco-icon"><Zap /></div>
            <div className="grow">
              <div className="reco-kicker">Otimização recomendada</div>
              {runnable.length ? (
                <>
                  <h3>Aplicar {runnable.length} ajuste{runnable.length > 1 ? 's' : ''} essencia{runnable.length > 1 ? 'is' : 'l'}</h3>
                  <p>Seguros, reversíveis e com ganho claro. Um ponto de restauração é criado antes, e tudo pode ser desfeito depois.</p>
                </>
              ) : (
                <>
                  <h3>{missing.length ? 'Abra como administrador' : 'Tudo em dia'}</h3>
                  <p>{missing.length ? 'Os essenciais que faltam precisam de privilégios de administrador.' : 'Os ajustes essenciais já estão aplicados. Escolha um perfil para ir além.'}</p>
                </>
              )}
            </div>
            {runnable.length ? (
              <button className="btn" onClick={() => setHealth('confirm')}>Ver os ajustes <ArrowRight /></button>
            ) : (
              <button className="btn" onClick={() => navigate('/profiles')}><Layers /> Ver perfis</button>
            )}
          </div>
        </Card>
      </div>

      <LiveRow volume={volume} />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)', marginTop: 14 }}>
        <Card title="Atividade recente" end={<Link to="/history" className="link-more">Ver histórico <ArrowRight size={14} /></Link>}>
          <ActivityList items={s.recent.slice(0, 4)} empty="Nenhuma alteração feita ainda. Comece pela otimização recomendada." />
        </Card>
        <Card title="Sua máquina" end={<Link to="/hardware/machine" className="link-more">Detalhes <ArrowRight size={14} /></Link>}>
          {m ? (
            <>
              <div className="machine-os">
                <WindowsMark />
                <div>
                  <strong>{m.osName.replace('Microsoft ', '')} <BadgeCheck /></strong>
                  <div className="small dim">Build {m.build}{m.laptop ? ' · notebook' : ''}</div>
                </div>
              </div>
              <div className="machine-row"><Cpu /> {cpu}</div>
              <div className="machine-row"><MonitorCog /> {m.gpus.map((g) => g.name).join(' + ')}</div>
              <div className="machine-row"><MemoryStick /> {m.ramGb} GB{ramSpeed ? ` · ${ramSpeed} MT/s` : ''}</div>
              {disks.slice(0, 2).map((d, i) => <div key={`${d.name}${i}`} className="machine-row"><HardDrive /> <span className="ellipsis">{d.name}</span> <span className="muted">{bytes(d.size, 0)} · {d.media}{d.bus ? ` ${d.bus}` : ''}</span></div>)}
              {!disks.length && <div className="machine-row"><HardDrive /> {m.ssd ? 'SSD' : '—'}</div>}
              {disks.length > 2 && (
                <Link to="/hardware/disks" className="machine-row link-more" title="Visualize todos os dispositivos em Detalhes">
                  <span style={{ width: 18 }} /> +{disks.length - 2} dispositivo{disks.length > 3 ? 's' : ''} · ver todos <ArrowRight size={14} />
                </Link>
              )}
            </>
          ) : <Loading label="Detectando hardware…" />}
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <Card title="Como a pontuação é calculada" icon={ShieldCheck}>
          <div className="stack" style={{ gap: 12 }}>
            {s.factors.map((f) => (
              <div key={f.id}>
                <div className="row small" style={{ marginBottom: 6 }}>
                  <span className="grow" title={`Vale ${f.weight} pontos da nota`}>{f.label}</span>
                  <span className="muted">{f.value}</span>
                  <span className="dim tiny" style={{ width: 44, textAlign: 'right' }}>{Math.round(f.weight * f.score)}/{f.weight}</span>
                </div>
                <Meter value={f.score * 100} color={f.score < 0.5 ? 'var(--warning)' : undefined} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="Proteção" icon={ShieldCheck}>
          <div className="stack" style={{ gap: 0 }}>
            <div className="machine-row"><span className="grow muted">Ajustes aplicados pelo ctrl</span><strong>{s.appliedCount}</strong></div>
            <div className="machine-row"><span className="grow muted">Última verificação</span><strong>{s.lastSweep ? ago(s.lastSweep.at) : 'nunca'}</strong></div>
            <div className="machine-row"><span className="grow muted">Ponto de restauração</span><strong style={{ color: s.restorePoint ? undefined : 'var(--warning)' }}>{s.restorePoint ? ago(s.restorePoint.created) : 'nenhum'}</strong></div>
            <div className="machine-row"><span className="grow muted">Proteção do sistema (C:)</span><strong>{s.restoreEnabled ? 'ativa' : 'desligada'}</strong></div>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn btn-sm" onClick={() => navigate('/guardian')}><ShieldCheck /> Verificar agora</button>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate('/history?tab=undo')}><Undo2 /> Desfazer alterações</button>
          </div>
        </Card>
      </div>

      {missing.length > 0 && (
        <>
          <div className="section-title">
            <h2>Essenciais ainda não aplicados</h2>
            <div className="end"><span className="small dim">Seguros, reversíveis e com ganho claro.</span></div>
          </div>
          <div className="grid grid-2">
            {missing.slice(0, 8).map((t) => (
              <Card key={t.id} className="hover" style={{ padding: 14 }}>
                <div className="row">
                  <div className="grow">
                    <div style={{ fontWeight: 650 }}>{t.name}</div>
                    <div className="small dim ellipsis">{t.description}</div>
                  </div>
                  {t.admin && !info?.isAdmin && <Badge>Admin</Badge>}
                  <button className="btn btn-sm btn-ghost" onClick={() => navigate(`${modulePath(t.module)}?tweak=${t.id}`)}>Ver <ChevronRight /></button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
      {health && <HealthDialog summary={s} missing={missing} runnable={runnable} start={health} onClose={() => setHealth(null)} onSummary={sum.setData} />}
    </Page>
  );
}

/** The four-pane Windows mark, drawn flat in the ink colour. */
function WindowsMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <rect x="1" y="1" width="15" height="15" fill="#fff" />
      <rect x="18" y="1" width="15" height="15" fill="#fff" />
      <rect x="1" y="18" width="15" height="15" fill="#fff" />
      <rect x="18" y="18" width="15" height="15" fill="#fff" />
    </svg>
  );
}
