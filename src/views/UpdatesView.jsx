import { RefreshCw, PauseCircle, PlayCircle, AlertTriangle } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { date, ago } from '../lib/format.js';
import { Card, Stat, Badge, Loading, useAsync, ActionButton } from '../components/ui.jsx';
import ModuleView from '../components/ModuleView.jsx';

export default function UpdatesView() {
  const { info, toast } = useApp();
  const st = useAsync(() => call('wu:status'), []);
  const d = st.data;
  const paused = d?.pausedUntil && new Date(d.pausedUntil) > new Date();
  const pause = async (days) => {
    const res = await call('wu:pause', days);
    if (res?.ok) toast(`Atualizações pausadas por ${days} dias.`, { tone: 'success' }); else toast(res?.error, { tone: 'error' });
    st.reload();
  };
  const resume = async () => {
    const res = await call('wu:resume');
    if (res?.ok) toast('Atualizações retomadas.', { tone: 'success' }); else toast(res?.error, { tone: 'error' });
    st.reload();
  };
  return (
    <div className="stack" style={{ gap: 18 }}>
      <Card title="Windows Update" icon={RefreshCw} end={<button className="btn btn-sm btn-ghost" onClick={() => call('shell:open', 'ms-settings:windowsupdate')}>Abrir configurações</button>}>
        {st.loading && !d ? <Loading /> : (
          <>
            <div className="grid grid-4" style={{ marginBottom: 16 }}>
              <Stat label="Estado" value={paused ? 'Pausado' : 'Ativo'} color={paused ? 'var(--warning)' : 'var(--success)'} sub={paused ? `até ${date(d.pausedUntil, { dateStyle: 'medium' })}` : 'Recebendo atualizações'} />
              <Stat label="Serviço" value={d?.service === 'Running' ? 'Em execução' : d?.service === 'Stopped' ? 'Parado' : d?.service || '—'} sub={d?.startType ? `Início: ${d.startType}` : ''} />
              <Stat label="Última atualização" value={d?.lastHotfix?.id || '—'} sub={d?.lastHotfix ? ago(d.lastHotfix.at) : ''} />
              <Stat label="Reinício pendente" value={d?.rebootPending ? 'Sim' : 'Não'} color={d?.rebootPending ? 'var(--warning)' : undefined} />
            </div>
            <div className="row wrap">
              {paused ? (
                <ActionButton className="btn btn-primary" icon={PlayCircle} disabled={!info?.isAdmin} onClick={resume}>Retomar atualizações</ActionButton>
              ) : (
                [7, 14, 35].map((days) => (
                  <ActionButton key={days} className="btn" icon={PauseCircle} disabled={!info?.isAdmin} onClick={() => pause(days)}>Pausar {days} dias</ActionButton>
                ))
              )}
              {d?.rebootPending && <Badge tone="warning" icon={AlertTriangle}>Há uma atualização esperando reinício</Badge>}
            </div>
            <div className="small dim" style={{ marginTop: 10 }}>Pausar usa o mesmo mecanismo do botão “Pausar atualizações” do Windows (limite de 35 dias). Atualizações de definições do Defender continuam chegando.</div>
          </>
        )}
      </Card>
      <ModuleView moduleId="updates" compact />
    </div>
  );
}
