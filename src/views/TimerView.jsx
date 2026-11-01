import { Clock, Info } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { modulePath } from '../nav.js';
import { Card, Stat, Callout, Loading, useAsync, ActionButton } from '../components/ui.jsx';
import { Link } from 'react-router-dom';

const PRESETS = [0.5, 1, 2];

export default function TimerView() {
  const { toast, settings } = useApp();
  const st = useAsync(() => call('timer:status'), []);
  if (st.loading && !st.data) return <Loading />;
  const d = st.data || {};
  const set = async (ms) => {
    const res = await call('timer:set', ms);
    if (res?.ok === false) toast(res.error, { tone: 'error' });
    else toast(`Resolução de ${ms} ms mantida enquanto o app estiver aberto.`, { tone: 'success' });
    setTimeout(st.reload, 800);
  };
  const reset = async () => {
    await call('timer:reset');
    setTimeout(st.reload, 800);
  };
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Card title="Resolução do timer do sistema" sub="Define de quanto em quanto tempo o agendador do Windows “acorda”. Valores menores deixam Sleep() e o pacing de frames mais precisos." icon={Clock}>
        <div className="grid grid-3" style={{ marginBottom: 16 }}>
          <Stat label="Atual" value={d.current?.toFixed(3) ?? '—'} unit="ms" sub={d.holding ? `Mantida pelo app em ${d.holding} ms` : 'Definida pelo Windows ou por outro app'} color={d.current <= 1 ? 'var(--success)' : undefined} />
          <Stat label="Mais fina suportada" value={d.finest?.toFixed(3) ?? '—'} unit="ms" />
          <Stat label="Mais grossa (padrão)" value={d.coarsest?.toFixed(3) ?? '—'} unit="ms" />
        </div>
        <div className="row wrap">
          {PRESETS.map((ms) => (
            <ActionButton key={ms} className={`btn ${d.holding === ms ? 'btn-primary' : ''}`} onClick={() => set(ms)}>{ms} ms</ActionButton>
          ))}
          <ActionButton className="btn btn-ghost" disabled={!d.holding} onClick={reset}>Liberar</ActionButton>
        </div>
      </Card>
      <Callout tone="info" icon={Info}>
        A resolução só vale enquanto o ctrl estiver aberto (é assim que o Windows funciona: o pedido é do processo).
        No Windows 11, ela só afeta outros processos com o tweak{' '}
        <Link to={`${modulePath('latency')}?tweak=latency-global-timer`}>Resolução de timer global</Link>.
        {settings?.liveGameTimer && ' O Modo Jogo ao Vivo também aplica 0,5 ms automaticamente durante as sessões de jogo.'}
      </Callout>
    </div>
  );
}
