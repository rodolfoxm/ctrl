import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wand2, Cpu, MemoryStick, ShieldHalf, ListOrdered, Activity, Check, Gamepad2, Eye } from 'lucide-react';
import { call, on } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { Page, Hero, SubNav } from '../components/Page.jsx';
import { Card, Switch, Stat, Callout, Loading, ActionButton } from '../components/ui.jsx';
import { RulesTab, ContainmentTab, MemoryTab, CoresTab, ActivityTab } from '../views/BatutaTabs.jsx';
import { AutoDetectCard, WatchdogTab } from '../views/CoreWatch.jsx';

const TABS = [
  { id: 'rules', label: 'Regras', icon: ListOrdered },
  { id: 'containment', label: 'Contenção', icon: ShieldHalf },
  { id: 'watch', label: 'Vigia', icon: Eye },
  { id: 'memory', label: 'Memória', icon: MemoryStick },
  { id: 'cores', label: 'Núcleos', icon: Cpu },
  { id: 'activity', label: 'Atividade', icon: Activity },
];

/** Game chips and the E-core choice, shared by the Core wizard and the first-run walkthrough. */
export function GamePicker({ st, games, setGames, background, setBackground }) {
  const toggle = (id) => setGames((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
  return (
    <>
      <div className="wizard-games">
        {st.games.map((g) => (
          <button key={g.id} type="button" className={`wizard-game ${games.includes(g.id) ? 'on' : ''}`} aria-pressed={games.includes(g.id)} onClick={() => toggle(g.id)}>
            <Gamepad2 size={16} /> {g.name}
          </button>
        ))}
      </div>
      {st.hybrid && (
        <label className="row" style={{ marginTop: 14, gap: 10 }}>
          <input type="checkbox" checked={background} onChange={(e) => setBackground(e.target.checked)} />
          <span>Mandar Discord, Spotify, RGB e afins para os E-cores</span>
        </label>
      )}
    </>
  );
}

/** Turns a suggested plan into a Core config patch, keeping rules made for other programs. */
export function planPatch(plan, rules) {
  const keep = rules.filter((r) => !plan.rules.some((n) => n.exe.toLowerCase() === r.exe.toLowerCase()));
  return { rules: [...plan.rules, ...keep], memory: plan.memory, boost: plan.boost, profile: plan.profile, enabled: true };
}

function Wizard({ st, onClose, onDone }) {
  const [games, setGames] = useState(st.config.profile.games || []);
  const [background, setBackground] = useState(true);
  const [plan, setPlan] = useState(null);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal batuta-wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title" onClick={(e) => e.stopPropagation()}>
        {!plan ? (
          <>
            <h3 id="wizard-title">O que você joga?</h3>
            <p>Marque todos. A configuração muda conforme o jogo: CS2 pede uma coisa, Warzone pede outra, e quem joga os dois recebe o melhor dos dois.</p>
            <GamePicker st={st} games={games} setGames={setGames} background={background} setBackground={setBackground} />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <ActionButton className="btn btn-primary" disabled={!games.length} onClick={async () => setPlan(await call('batuta:suggest', games, { background }))}>Ver a configuração</ActionButton>
            </div>
          </>
        ) : (
          <>
            <h3 id="wizard-title">Sua configuração</h3>
            <ul className="wizard-why">{plan.why.map((w) => <li key={w}>{w}</li>)}</ul>
            <p className="small muted">Regras que você já criou para outros programas continuam. Dá para ajustar tudo depois nas abas.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setPlan(null)}>Voltar</button>
              <ActionButton className="btn btn-primary" icon={Check} onClick={async () => {
                await onDone(planPatch(plan, st.config.rules));
              }}>Aplicar e ligar o Core</ActionButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Batuta() {
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const [st, setSt] = useState(null);
  const [live, setLive] = useState(null);
  const [events, setEvents] = useState([]);
  const [wizard, setWizard] = useState(false);
  const tab = TABS.find((t) => t.id === params.get('tab'))?.id || 'rules';

  useEffect(() => {
    call('batuta:state').then((s) => {
      setSt(s);
      setLive(s.status);
      setEvents(s.events || []);
    });
    return on('batuta:event', (e) => {
      if (e.type === 'status') setLive(e);
      else if (!['ready', 'stopped'].includes(e.type)) setEvents((ev) => [{ ...e, at: new Date().toISOString() }, ...ev].slice(0, 60));
    });
  }, []);

  const save = async (patch) => {
    const next = await call('batuta:save', patch);
    if (next?.ok === false) toast(next.error, { tone: 'error' });
    else setSt((s) => ({ ...s, ...next }));
    return next;
  };
  const counts = useMemo(() => ({ managed: live?.managed?.length || 0, held: live?.held?.length || 0 }), [live]);

  if (!st) return <Page title="Core"><Loading label="Carregando o Core…" /></Page>;
  const cfg = st.config;
  return (
    <Page title="Core">
      <Hero
        title="Core"
        actions={(
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-sm" onClick={() => setWizard(true)}><Wand2 /> Configurar para meus jogos</button>
            <span className="row small" style={{ gap: 8 }}>{cfg.enabled ? 'Ligado' : 'Desligado'}<Switch on={cfg.enabled} onChange={(v) => save({ enabled: v })} label="Core ligado" /></span>
          </div>
        )}
      >
        Rege o que roda no seu PC: quem tem prioridade, em quais núcleos, quanto de memória fica em espera e quando o processador descansa.
        Só usa as ferramentas do próprio Windows (agendador e energia), sem tocar na memória dos jogos.
      </Hero>

      {st.rivals?.length > 0 && (
        <Callout tone="warning">
          {st.rivals.join(' e ')} {st.rivals.length > 1 ? 'estão abertos' : 'está aberto'}. Eles mexem nas mesmas coisas que o Core e um
          desfaz o que o outro faz: use só um. Se for usar o Core, feche {st.rivals.length > 1 ? 'os outros' : 'o outro'} e tire da inicialização.
        </Callout>
      )}
      {!cfg.enabled && <Callout tone="info">O Core está desligado. As regras ficam salvas e passam a valer quando você ligar.</Callout>}

      <div className="grid grid-4" style={{ margin: '14px 0' }}>
        <Card><Stat label="CPU agora" value={live ? Math.round(live.cpu) : '—'} unit="%" /></Card>
        <Card><Stat label="Programas regidos" value={counts.managed} sub={live?.gaming ? 'jogo aberto' : 'nenhum jogo aberto'} /></Card>
        <Card><Stat label="Contidos agora" value={counts.held} /></Card>
        <Card><Stat label="Limpezas de memória" value={st.purges || 0} sub={st.freedMB ? `${Math.round(st.freedMB / 1024 * 10) / 10} GB liberados` : 'nesta sessão'} /></Card>
      </div>

      <SubNav items={TABS} active={tab} onChange={(id) => setParams({ tab: id })} />
      <div style={{ marginTop: 14 }}>
        {tab === 'rules' && (
          <>
            <AutoDetectCard key={JSON.stringify(cfg.autoDetect)} cfg={cfg} status={live} save={save} />
            <RulesTab key={JSON.stringify(cfg.rules)} cfg={cfg} hybrid={st.hybrid} save={save} />
          </>
        )}
        {tab === 'watch' && <WatchdogTab key={JSON.stringify(cfg.watchdog)} cfg={cfg} hybrid={st.hybrid} save={save} />}
        {tab === 'containment' && <ContainmentTab key={JSON.stringify(cfg.containment)} cfg={cfg} save={save} />}
        {tab === 'memory' && <MemoryTab key={JSON.stringify(cfg.memory)} cfg={cfg} ramGb={st.ramGb} status={live} save={save} toast={toast} />}
        {tab === 'cores' && <CoresTab key={JSON.stringify(cfg.boost)} cfg={cfg} laptop={st.laptop} save={save} toast={toast} />}
        {tab === 'activity' && <ActivityTab events={events} />}
      </div>

      {wizard && (
        <Wizard
          st={st}
          onClose={() => setWizard(false)}
          onDone={async (patch) => {
            await save(patch);
            setWizard(false);
            toast('Core configurado e ligado.', { tone: 'success' });
          }}
        />
      )}
    </Page>
  );
}
