import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ScanSearch, ArrowRight, Check } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { Wordmark, Spinner, Switch } from './ui.jsx';

/** First-run wizard: welcome → machine profile → safety choices. */
export default function Onboarding() {
  const { setOnboarded, settings, updateSettings, info } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [machine, setMachine] = useState(null);
  useEffect(() => {
    if (step === 1 && !machine) call('machine:get').then(setMachine);
  }, [step, machine]);
  const finish = async (goProfiles) => {
    await call('onboarding:done');
    setOnboarded(true);
    navigate(goProfiles ? '/profiles' : '/');
  };
  return (
    <div className="backdrop">
      <div className="modal onboarding" role="dialog" aria-modal="true">
        <div className="onboarding-art"><Wordmark /></div>
        <div className="onboarding-body">
          <div className="steps" style={{ marginBottom: 16 }}>{[0, 1, 2].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
          {step === 0 && (
            <>
              <h3>Bem-vindo ao ctrl</h3>
              <p>Um otimizador de Windows que guarda o valor original de tudo que muda, verifica se o Windows desfez alguma coisa e deixa você reverter qualquer alteração, uma por uma ou em lote. Sem conta, sem telemetria.</p>
              {!info?.isAdmin && <p className="small" style={{ color: 'var(--warning)' }}>Dica: abra como administrador para liberar todos os ajustes.</p>}
            </>
          )}
          {step === 1 && (
            <>
              <h3><ScanSearch size={18} /> Conhecendo seu PC</h3>
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
          {step === 2 && (
            <>
              <h3><ShieldCheck size={18} /> Rede de segurança</h3>
              <div className="stack" style={{ margin: '10px 0 16px' }}>
                <div className="row"><div className="grow"><div>Ponto de restauração antes da primeira alteração</div><div className="tiny dim">Recomendado.</div></div><Switch on={settings?.autoRestorePoint} onChange={(v) => updateSettings({ autoRestorePoint: v })} label="Ponto de restauração" /></div>
                <div className="row"><div className="grow"><div>Sentinela: verificar tweaks a cada 30 minutos</div><div className="tiny dim">Avisa quando o Windows desfizer algo.</div></div><Switch on={settings?.sentinel} onChange={(v) => updateSettings({ sentinel: v })} label="Sentinela" /></div>
              </div>
            </>
          )}
          <div className="modal-actions">
            {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>Voltar</button>}
            {step < 2 ? (
              <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Continuar <ArrowRight /></button>
            ) : (
              <>
                <button className="btn" onClick={() => finish(true)}>Ver perfis</button>
                <button className="btn btn-primary" onClick={() => finish(false)}>Ir para a Visão geral <ArrowRight /></button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
