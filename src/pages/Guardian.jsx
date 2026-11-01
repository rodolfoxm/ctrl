import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ScanSearch, Wrench, CheckCircle2, AlertTriangle, HelpCircle, Repeat } from 'lucide-react';
import { call, on } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { ago, date } from '../lib/format.js';
import { modulePath } from '../nav.js';
import { Page, Hero } from '../components/Page.jsx';
import { Card, Stat, Badge, Empty, Switch, ActionButton } from '../components/ui.jsx';

const STATE = {
  verified: { tone: 'success', label: 'Verificado', icon: CheckCircle2 },
  drifted: { tone: 'warning', label: 'Desfeito pelo Windows', icon: AlertTriangle },
  unverifiable: { tone: '', label: 'Sem leitura', icon: HelpCircle },
};

function VerifyTab() {
  const { runBatch, settings, updateSettings, toast, catalog } = useApp();
  const moduleLabel = (id) => catalog?.modules.find((m) => m.id === id)?.label || id;
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [sweeps, setSweeps] = useState([]);
  const loadSweeps = () => call('state:get').then((s) => setSweeps(s.sweeps || []));
  useEffect(() => {
    loadSweeps();
    return on('guardian:sweep', (r) => {
      setResult(r);
      loadSweeps();
    });
  }, []);
  const verify = async () => {
    setRunning(true);
    const res = await call('guardian:verify');
    setRunning(false);
    if (res?.ok === false) return toast(res.error, { tone: 'error' });
    setResult(res);
    loadSweeps();
  };
  const drifted = result?.items.filter((i) => i.state === 'drifted') || [];
  const repair = async (ids) => {
    await runBatch('Reaplicando tweaks desfeitos', 'guardian:repair', ids);
    verify();
  };
  const offenders = useMemo(() => {
    const count = {};
    for (const s of sweeps) for (const id of s.drifted) count[id] = (count[id] || 0) + 1;
    return Object.entries(count).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
  }, [sweeps]);
  const names = Object.fromEntries((result?.items || []).map((i) => [i.id, i.name]));

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="grid grid-3">
        <Card><Stat label="Verificados" value={result ? result.items.filter((i) => i.state === 'verified').length : '—'} color="var(--success)" sub="Lidos do sistema e iguais ao aplicado" /></Card>
        <Card><Stat label="Desfeitos" value={result ? drifted.length : '—'} color={drifted.length ? 'var(--warning)' : undefined} sub="Windows Update ou outro programa reverteu" /></Card>
        <Card><Stat label="Sem leitura" value={result ? result.items.filter((i) => i.state === 'unverifiable').length : '—'} sub="Tweaks cujo estado não pode ser lido de volta" /></Card>
      </div>
      <Card
        title="Verificar e reparar"
        sub={result ? `Última verificação ${ago(result.at)}` : 'Relê cada tweak aplicado diretamente do registro e das configurações do sistema.'}
        icon={ShieldCheck}
        end={
          <>
            {drifted.length > 0 && <ActionButton className="btn btn-sm" icon={Wrench} onClick={() => repair(drifted.map((i) => i.id))}>Reaplicar {drifted.length}</ActionButton>}
            <button className="btn btn-sm btn-primary" disabled={running} onClick={verify}>{running ? <span className="spinner" /> : <ScanSearch />} Verificar agora</button>
          </>
        }
      >
        {result ? (
          result.items.length ? (
            <table className="table">
              <tbody>
                {result.items.map((i) => {
                  const st = STATE[i.state];
                  return (
                    <tr key={i.id}>
                      <td><Link to={`${modulePath(i.module)}?tweak=${i.id}`} style={{ color: 'inherit' }}>{i.name}</Link></td>
                      <td className="dim small">{moduleLabel(i.module)}</td>
                      <td className="num"><Badge tone={st.tone} icon={st.icon}>{st.label}</Badge></td>
                      <td className="num" style={{ width: 110 }}>{i.state === 'drifted' && <ActionButton className="btn btn-xs" onClick={() => repair([i.id])}>Reaplicar</ActionButton>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <Empty title="Nenhum tweak aplicado pelo app">Quando você aplicar tweaks, eles aparecem aqui para verificação.</Empty>
        ) : <div className="dim small">Clique em “Verificar agora”. Nada é alterado durante a verificação.</div>}
      </Card>
      <div className="grid grid-2">
        <Card title="Sentinela" sub="Verificação automática a cada 30 minutos enquanto o app estiver aberto." icon={ShieldCheck}>
          <div className="stack">
            <div className="row"><span className="grow">Verificar automaticamente</span><Switch on={settings?.sentinel} onChange={(v) => updateSettings({ sentinel: v })} label="Sentinela" /></div>
            <div className="row"><span className="grow">Reaplicar sozinho o que o Windows desfizer</span><Switch on={settings?.sentinelRepair} disabled={!settings?.sentinel} onChange={(v) => updateSettings({ sentinelRepair: v })} label="Reparo automático" /></div>
            <div className="tiny dim">Para verificar também ao ligar o PC, crie a tarefa “Verificar tweaks ao entrar” no <Link to="/scheduler">Agendador</Link>.</div>
          </div>
        </Card>
        <Card title="Reincidentes" sub="Tweaks desfeitos em duas ou mais verificações." icon={Repeat}>
          {offenders.length ? offenders.map(([id, n]) => (
            <div key={id} className="row small" style={{ padding: '5px 0' }}><span className="grow">{names[id] || id}</span><Badge tone="warning">{n} vezes</Badge></div>
          )) : <div className="dim small">Nenhum reincidente — nada foi desfeito em mais de uma verificação.</div>}
          {sweeps.length > 0 && <div className="tiny dim" style={{ marginTop: 10 }}>{sweeps.length} verificação(ões) registradas desde {date(sweeps[sweeps.length - 1].at, { dateStyle: 'short' })}.</div>}
        </Card>
      </div>
    </div>
  );
}

export default function Guardian() {
  return (
    <Page title="Verificação">
      <Hero title="Seu sistema continua do jeito que você escolheu?">
        O Windows Update e outros programas desfazem ajustes sem avisar. A verificação relê cada alteração direto do sistema, mostra o que
        foi desfeito e reaplica com um clique. Nada é alterado enquanto ela roda.
      </Hero>
      <VerifyTab />
    </Page>
  );
}
