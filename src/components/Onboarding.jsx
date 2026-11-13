import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ScanSearch, ArrowRight, Check, Gamepad2, AlertTriangle, RefreshCw, ClipboardCheck } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { GamePicker, planPatch } from '../pages/Batuta.jsx';
import { Wordmark, Spinner, Switch, ActionButton } from './ui.jsx';

/** First-run setup: welcome → machine → games → conflicting tools → safety → review and apply. */
export default function Onboarding() {
  const { setOnboarded, settings, updateSettings, info, tweakById, applyMany, toast, setTour } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [machine, setMachine] = useState(null);
  const [core, setCore] = useState(null);
  const [games, setGames] = useState([]);
  const [background, setBackground] = useState(true);
  const [plan, setPlan] = useState(null);
  const [essentials, setEssentials] = useState(null);
  const [useCore, setUseCore] = useState(true);
  const [useEssentials, setUseEssentials] = useState(true);

  // The conflict check only matters when the Core is going to be set up.
  const steps = ['welcome', 'machine', 'games', ...(games.length ? ['rivals'] : []), 'safety', 'review'];
  const id = steps[step];
  const last = step === steps.length - 1;
  const rivals = core?.rivals || [];
  const checkRivals = () => call('batuta:state').then(setCore);

  useEffect(() => {
    if (id === 'machine' && !machine) call('machine:get').then(setMachine);
    if (id === 'games' && !core) checkRivals();
    if (id === 'rivals') checkRivals();
    if (id === 'review') {
      // A failed read drops that item from the review: first run must never get stuck here.
      if (games.length) call('batuta:suggest', games, { background }).then((p) => setPlan(p?.why ? p : false), () => setPlan(false));
      call('dashboard:summary').then((s) => setEssentials((s?.quickWinsMissing || []).map((t) => tweakById.get(t)).filter((t) => t && (info?.isAdmin || !t.admin))), () => setEssentials([]));
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reviewing = !essentials || (games.length > 0 && plan === null);
  const setsCore = useCore && !!plan;
  const appliesEssentials = useEssentials && essentials?.length > 0;

  const back = () => {
    setStep(step - 1);
    if (last) {
      setPlan(null);
      setEssentials(null);
    }
  };

  const finish = async () => {
    await call('onboarding:done');
    setOnboarded(true);
    if (setsCore) {
      // With a rival open both would undo each other, so the rules are saved and the Core stays off.
      const res = await call('batuta:save', { ...planPatch(plan, core.config.rules), enabled: !rivals.length });
      if (res?.ok === false) toast(res.error, { tone: 'error' });
    }
    if (appliesEssentials) await applyMany(essentials, { title: 'Otimização recomendada', source: 'primeira configuração' });
    navigate('/');
    setTour(true);
  };

  return (
    <div className="backdrop">
      <div className="modal onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div className="onboarding-art"><Wordmark /></div>
        <div className="onboarding-body">
          <div className="steps" style={{ marginBottom: 16 }}>{steps.map((s, i) => <i key={s} className={i <= step ? 'on' : ''} />)}</div>
          {id === 'welcome' && (
            <>
              <h3 id="onboarding-title">Bem-vindo ao ctrl</h3>
              <p>Um otimizador de Windows que guarda o valor original de tudo que muda, verifica se o Windows desfez alguma coisa e deixa você reverter qualquer alteração, uma por uma ou em lote. Sem conta, sem telemetria.</p>
              <p>Vamos fazer a primeira configuração juntos. Nada muda no seu PC até a última etapa, onde você vê tudo antes de aplicar.</p>
              {!info?.isAdmin && <p className="small" style={{ color: 'var(--warning)' }}>Dica: abra como administrador para liberar todos os ajustes.</p>}
            </>
          )}
          {id === 'machine' && (
            <>
              <h3 id="onboarding-title"><ScanSearch size={18} /> Conhecendo seu PC</h3>
              {machine ? (
                <div className="stack small" style={{ margin: '10px 0 16px' }}>
                  {[
                    machine.cpuName,
                    machine.gpus.map((g) => g.name).join(' + '),
                    `${machine.ramGb} GB de RAM · ${machine.laptop ? 'notebook' : 'desktop'} · ${machine.win11 ? 'Windows 11' : 'Windows 10'}`,
                  ].map((l) => <div key={l} className="row"><Check size={14} style={{ color: 'var(--success)' }} />{l}</div>)}
                  <div className="muted">O catálogo foi ajustado para este hardware: tweaks que não se aplicam ficam ocultos.</div>
                </div>
              ) : <div className="row" style={{ margin: '16px 0' }}><Spinner /> Detectando hardware…</div>}
            </>
          )}
          {id === 'games' && (
            <>
              <h3 id="onboarding-title"><Gamepad2 size={18} /> O que você joga?</h3>
              <p>Marque todos. A configuração do Core muda conforme o jogo. Se não joga nenhum destes, é só continuar.</p>
              {core ? <GamePicker st={core} games={games} setGames={setGames} background={background} setBackground={setBackground} /> : <div className="row" style={{ margin: '16px 0' }}><Spinner /> Carregando…</div>}
            </>
          )}
          {id === 'rivals' && (
            <>
              <h3 id="onboarding-title"><ScanSearch size={18} /> Outros programas</h3>
              {rivals.length ? (
                <>
                  <p className="row" style={{ color: 'var(--warning)' }}><AlertTriangle size={16} /> {rivals.join(' e ')} {rivals.length > 1 ? 'estão abertos' : 'está aberto'}.</p>
                  <p>Eles mexem nas mesmas coisas que o Core, e um desfaz o que o outro faz. Feche e tire da inicialização do Windows. Se continuar sem fechar, as regras ficam salvas e o Core fica desligado.</p>
                  <ActionButton className="btn btn-sm" icon={RefreshCw} onClick={checkRivals}>Verificar de novo</ActionButton>
                </>
              ) : (
                <p className="row"><Check size={16} style={{ color: 'var(--success)' }} /> Process Lasso, ParkControl e ISLC estão fechados. Nada vai brigar com o Core.</p>
              )}
            </>
          )}
          {id === 'safety' && (
            <>
              <h3 id="onboarding-title"><ShieldCheck size={18} /> Rede de segurança</h3>
              <div className="stack" style={{ margin: '10px 0 16px' }}>
                <div className="row"><div className="grow"><div>Ponto de restauração antes da primeira alteração</div><div className="tiny dim">Recomendado.</div></div><Switch on={settings?.autoRestorePoint} onChange={(v) => updateSettings({ autoRestorePoint: v })} label="Ponto de restauração" /></div>
                <div className="row"><div className="grow"><div>Sentinela: verificar tweaks a cada 30 minutos</div><div className="tiny dim">Avisa quando o Windows desfizer algo.</div></div><Switch on={settings?.sentinel} onChange={(v) => updateSettings({ sentinel: v })} label="Sentinela" /></div>
                <div className="row"><div className="grow"><div>Uso WSL, Docker, máquinas virtuais ou dual boot</div><div className="tiny dim">O ctrl esconde os ajustes que atrapalham isso. Os essenciais já são seguros para esses casos.</div></div><Switch on={settings?.virtUse} onChange={(v) => updateSettings({ virtUse: v })} label="Uso WSL, Docker, máquinas virtuais ou dual boot" /></div>
              </div>
            </>
          )}
          {id === 'review' && (
            <>
              <h3 id="onboarding-title"><ClipboardCheck size={18} /> Sua configuração</h3>
              {reviewing ? <div className="row" style={{ margin: '16px 0' }}><Spinner /> Montando a configuração…</div> : (
                <div className="stack" style={{ margin: '10px 0 16px' }}>
                  {plan && (
                    <div>
                      <div className="row"><div className="grow">Configurar o Core para seus jogos</div><Switch on={useCore} onChange={setUseCore} label="Configurar o Core" /></div>
                      {useCore && <ul className="wizard-why" style={{ marginTop: 8 }}>{plan.why.map((w) => <li key={w}>{w}</li>)}</ul>}
                      {useCore && rivals.length > 0 && <div className="small" style={{ color: 'var(--warning)' }}>Com {rivals.join(' e ')} {rivals.length > 1 ? 'abertos' : 'aberto'}, o Core fica desligado. Depois de fechar, ligue na página Core.</div>}
                    </div>
                  )}
                  {essentials.length > 0 ? (
                    <div className="row"><div className="grow"><div>Aplicar {essentials.length} ajuste{essentials.length > 1 ? 's' : ''} essencia{essentials.length > 1 ? 'is' : 'l'}</div><div className="tiny dim">Seguros, reversíveis e com ganho claro.</div></div><Switch on={useEssentials} onChange={setUseEssentials} label="Aplicar ajustes essenciais" /></div>
                  ) : <div className="row small muted"><Check size={14} style={{ color: 'var(--success)' }} /> Os ajustes essenciais já estão aplicados.</div>}
                </div>
              )}
            </>
          )}
          <div className="modal-actions">
            {step > 0 && <button className="btn btn-ghost" onClick={back}>Voltar</button>}
            {!last ? (
              <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Continuar <ArrowRight /></button>
            ) : (
              <ActionButton className="btn btn-primary" disabled={reviewing} onClick={finish}>{setsCore || appliesEssentials ? 'Aplicar e começar' : 'Ir para a Visão geral'} <ArrowRight /></ActionButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
