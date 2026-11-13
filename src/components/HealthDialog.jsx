import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, RotateCw, Undo2, XCircle, Zap } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { ActionButton, Badge } from './ui.jsx';

// What fixes each factor of the score. Only "quick" can be fixed by the app alone.
const FIX = {
  quick: { auto: true },
  restore: { label: 'Criar ponto de restauração', path: '/history?tab=backups' },
  drift: { label: 'Abrir a Verificação', path: '/guardian' },
  disk: { label: 'Abrir a Limpeza', path: '/system/cleaner' },
  maintenance: { label: 'Abrir as Correções', path: '/system/fixes' },
};
const lost = (f) => Math.round(f.weight - f.weight * f.score);

/**
 * The health score explained, and the one-click optimization: diagnosis → summary of what changes →
 * apply (with the app's usual backup, restore point and progress) → the score read again from the system.
 */
export default function HealthDialog({ summary, missing, runnable, start = 'diagnosis', onClose, onSummary }) {
  const navigate = useNavigate();
  const { applyMany, revertMany, catalog, tweakById } = useApp();
  const [step, setStep] = useState(start);
  const [result, setResult] = useState(null);
  const moduleLabel = (id) => catalog?.modules.find((m) => m.id === id)?.label || id;
  const losing = summary.factors.filter((f) => lost(f) > 0).sort((a, b) => lost(b) - lost(a));
  const fine = summary.factors.filter((f) => lost(f) === 0);
  const needAdmin = missing.filter((t) => !runnable.includes(t));
  const go = (path) => (onClose(), navigate(path));

  const optimize = async () => {
    const before = summary.score;
    const res = await applyMany(runnable, { title: 'Otimização recomendada', source: 'otimização recomendada' });
    if (!res) return; // cancelled at the risk or restore point prompt: nothing changed
    const after = await call('dashboard:summary'); // read again from the system, never estimated
    onSummary(after);
    const changed = (res.results || []).filter((r) => r.ok && !r.unchanged);
    const still = changed.filter((r) => after.quickWinsMissing.includes(r.id));
    // Which of the changed tweaks only take effect after a restart (MMCSS, Power Throttling...): measured before
    // it, the gain looks smaller than it is.
    const reboot = changed.filter((r) => ['reboot', 'logoff'].includes(r.restart));
    setResult({ before, after: after.score, changed, still, reboot, restart: res.restart, failed: res.failed || [] });
    setStep('result');
  };

  const undo = async () => {
    // By id from the catalog: once applied, these tweaks are no longer in `runnable`.
    await revertMany(result.changed.map((r) => tweakById.get(r.id)).filter(Boolean), { title: 'Desfazendo a otimização', source: 'otimização recomendada' });
    onSummary(await call('dashboard:summary'));
    onClose();
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal wide health-dialog" role="dialog" aria-modal="true" aria-labelledby="health-title" onClick={(e) => e.stopPropagation()}>
        {step === 'diagnosis' && (
          <>
            <h3 id="health-title">Saúde do sistema: {summary.score} de 100</h3>
            <p>A nota soma cinco itens lidos agora do seu PC. Cada um vale um número de pontos; o que não está em dia desconta uma parte.</p>
            {losing.length > 0 && <h4>O que está tirando pontos</h4>}
            {losing.map((f) => (
              <div key={f.id} className="health-row">
                <div className="grow">
                  <strong>{f.label}</strong>
                  <div className="small muted">{f.value} · vale {f.weight} pontos</div>
                </div>
                <Badge tone="warning">−{lost(f)} {lost(f) === 1 ? 'ponto' : 'pontos'}</Badge>
                {FIX[f.id]?.auto
                  ? runnable.length > 0 && <Badge tone="accent" icon={Zap}>Otimizar agora resolve</Badge>
                  : FIX[f.id] && <button className="btn btn-sm" title="Precisa de uma ação sua" onClick={() => go(FIX[f.id].path)}>{FIX[f.id].label} <ArrowRight /></button>}
              </div>
            ))}
            {fine.length > 0 && <h4>Já está em dia</h4>}
            {fine.map((f) => (
              <div key={f.id} className="health-row">
                <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                <div className="grow">{f.label}<span className="small muted"> · {f.value}</span></div>
                <span className="small muted">{f.weight}/{f.weight}</span>
              </div>
            ))}
            {needAdmin.length > 0 && <p className="small" style={{ color: 'var(--warning)', marginTop: 12 }}>{needAdmin.length} ajuste(s) essenciais precisam do ctrl aberto como administrador.</p>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
              {runnable.length > 0 && <button className="btn btn-primary" onClick={() => setStep('confirm')}><Zap /> Otimizar agora</button>}
            </div>
          </>
        )}
        {step === 'confirm' && (
          <>
            <h3 id="health-title">{runnable.length} ajuste{runnable.length > 1 ? 's' : ''} para aplicar</h3>
            <p>
              São os ajustes essenciais que servem para o seu hardware e a sua versão do Windows e ainda não estão ativos. O valor original de cada um
              é guardado antes, e dá para desfazer depois. Nenhum deles desliga recursos de segurança do Windows.
            </p>
            <div className="health-list">
              {runnable.map((t) => (
                <div key={t.id} className="health-row">
                  <div className="grow">
                    <strong>{t.name}</strong>
                    <div className="small muted">{t.description}</div>
                  </div>
                  <span className="small muted">{moduleLabel(t.module)}</span>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => (start === 'confirm' ? onClose() : setStep('diagnosis'))}>{start === 'confirm' ? 'Cancelar' : 'Voltar'}</button>
              <ActionButton className="btn btn-primary" icon={Check} onClick={optimize}>Aplicar {runnable.length} ajuste{runnable.length > 1 ? 's' : ''}</ActionButton>
            </div>
          </>
        )}
        {step === 'result' && (
          <>
            <h3 id="health-title">Otimização concluída</h3>
            <div className="health-delta" aria-label={`Antes ${result.before} de 100, depois ${result.after} de 100`}>
              <div><span>Antes</span><b>{result.before}</b></div>
              <ArrowRight />
              <div className={result.after > result.before ? 'up' : ''}><span>Depois</span><b>{result.after}</b></div>
            </div>
            <p>
              {result.changed.length} ajuste(s) aplicado(s) e conferido(s) de novo no sistema.
              {result.after === result.before && ' A nota não mudou: o que desconta pontos agora depende dos outros itens do diagnóstico.'}
            </p>
            {result.reboot.length > 0 && (
              <div className="callout warning row" style={{ margin: '0 0 14px', gap: 12 }}>
                <RotateCw size={18} />
                <div className="grow">
                  <strong>{result.reboot.length} ajuste{result.reboot.length > 1 ? 's' : ''} só {result.reboot.length > 1 ? 'valem' : 'vale'} depois de {result.restart === 'logoff' ? 'sair e entrar de novo no Windows' : 'reiniciar o PC'}.</strong>
                  <div className="small">{result.reboot.map((r) => tweakById.get(r.id)?.name || r.name).join(', ')}. Para medir o ganho num jogo, reinicie antes.</div>
                </div>
                <button className="btn btn-sm" onClick={() => call(result.restart === 'logoff' ? 'system:logoff' : 'system:restart')}>{result.restart === 'logoff' ? 'Sair agora' : 'Reiniciar agora'}</button>
              </div>
            )}
            {result.still.length > 0 && <p style={{ color: 'var(--warning)' }}>Aplicados, mas o Windows ainda não mostra como ativos (podem pedir reinício): {result.still.map((r) => r.name).join(', ')}.</p>}
            {result.failed.map((f) => (
              <div key={f.id} className="health-row"><XCircle size={18} style={{ color: 'var(--danger)' }} /><div className="grow"><strong>{f.name}</strong><div className="small muted">{f.error || 'Falhou sem mensagem do Windows.'}</div></div></div>
            ))}
            <div className="modal-actions">
              {result.changed.length > 0 && <ActionButton className="btn btn-ghost" icon={Undo2} onClick={undo}>Desfazer esta otimização</ActionButton>}
              <button className="btn" onClick={() => setStep('diagnosis')}>Ver diagnóstico</button>
              <button className="btn btn-primary" onClick={onClose}>Concluir</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
