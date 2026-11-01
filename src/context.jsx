import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { call, on } from './lib/api.js';
import { RISK } from './lib/format.js';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

let toastSeq = 0;
const TOAST_ICON = { success: CheckCircle2, warn: AlertTriangle, error: XCircle, info: Info };
const RESTART_RANK = { none: 0, explorer: 1, logoff: 2, reboot: 3 };

export function AppProvider({ children }) {
  const [info, setInfo] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [status, setStatus] = useState({});
  const [statusLoading, setStatusLoading] = useState(true);
  const [applied, setApplied] = useState({});
  const [settings, setSettings] = useState(null);
  const [onboarded, setOnboarded] = useState(true);
  const [busy, setBusy] = useState({}); // tweakId -> true while running
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [progress, setProgress] = useState(null);
  const [pendingRestart, setPendingRestart] = useState('none');
  const [update, setUpdate] = useState(null);
  const restorePointDone = useRef(false);

  const refreshState = useCallback(async () => {
    const s = await call('state:get');
    setApplied(s.applied || {});
    setSettings(s.settings);
    setOnboarded(!!s.onboarded);
    return s;
  }, []);

  const refreshStatus = useCallback(async (ids) => {
    if (!ids) setStatusLoading(true);
    const res = await call('tweaks:status', ids);
    setStatus((prev) => ({ ...prev, ...(res || {}) }));
    if (!ids) setStatusLoading(false);
  }, []);

  useEffect(() => {
    call('app:info').then(setInfo);
    call('catalog:get').then(setCatalog);
    refreshState();
    refreshStatus();
  }, [refreshState, refreshStatus]);

  // Release check on GitHub, once per launch (the main process caches it and honours the setting).
  const checkUpdate = useCallback(async (force) => {
    const res = await call('app:checkUpdate', !!force);
    if (res && res.ok !== false) setUpdate(res);
    return res;
  }, []);
  useEffect(() => {
    checkUpdate();
  }, [checkUpdate]);

  useEffect(() => on('tweaks:progress', (p) => setProgress((cur) => (cur ? { ...cur, ...p } : cur))), []);

  const tweakById = useMemo(() => new Map((catalog?.tweaks || []).map((t) => [t.id, t])), [catalog]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (message, { tone = 'info', action, duration = 5000 } = {}) => {
      const id = ++toastSeq;
      setToasts((t) => [...t.slice(-3), { id, message, tone, action }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const confirm = useCallback(
    (title, body, { confirmLabel = 'Confirmar', danger = false } = {}) =>
      new Promise((resolve) => setDialog({ title, body, confirmLabel, danger, resolve })),
    [],
  );
  const closeDialog = (value) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  const updateSettings = useCallback(async (patch) => {
    setSettings((s) => ({ ...s, ...patch }));
    const res = await call('settings:set', patch);
    if (res?.ok === false) {
      toast(res.error, { tone: 'error' });
      refreshState();
    }
  }, [toast, refreshState]);

  /** Remembers the strongest follow-up needed (Explorer restart, logoff or reboot). */
  const noteRestart = useCallback(
    (kind) => {
      if (!kind || kind === 'none') return;
      setPendingRestart((cur) => (RESTART_RANK[kind] > RESTART_RANK[cur] ? kind : cur));
      if (kind === 'explorer') {
        toast('Reinicie o Explorer para ver a mudança.', {
          action: { label: 'Reiniciar Explorer', run: () => call('actions:run', 'restart-explorer') },
        });
      }
    },
    [toast],
  );

  /** One restore point per session before the first change, when enabled. */
  const ensureRestorePoint = useCallback(async () => {
    if (!settings?.autoRestorePoint || restorePointDone.current || !info?.isAdmin) return true;
    const id = toast('Criando ponto de restauração antes da primeira alteração…', { duration: 0 });
    const res = await call('backups:create', 'ctrl - antes das otimizações');
    dismiss(id);
    if (res?.ok) {
      restorePointDone.current = true;
      toast('Ponto de restauração criado.', { tone: 'success' });
      return true;
    }
    const go = await confirm(
      'Não foi possível criar o ponto de restauração',
      `${res?.error || 'Erro desconhecido.'}\n\nContinuar mesmo assim? Cada alteração continua podendo ser desfeita pelo app, a partir do backup feito antes de aplicar.`,
      { confirmLabel: 'Continuar' },
    );
    if (go) restorePointDone.current = true;
    return go;
  }, [settings, info, toast, dismiss, confirm]);

  const confirmRisk = useCallback(
    async (tweaks) => {
      if (!settings?.confirmRisky) return true;
      const risky = tweaks.filter((t) => t.risk === 'advanced' || t.warn);
      if (!risky.length) return true;
      return confirm(
        risky.length === 1 ? `Aplicar "${risky[0].name}"?` : `Aplicar ${risky.length} tweaks com ressalvas?`,
        risky.map((t) => `• ${t.name} (${RISK[t.risk]})${t.warn ? `\n  ${t.warn}` : ''}`).join('\n'),
        { confirmLabel: 'Aplicar mesmo assim', danger: true },
      );
    },
    [settings, confirm],
  );

  const blockIfNotAdmin = useCallback(
    (tweaks) => {
      if (info?.isAdmin) return false;
      const needs = tweaks.filter((t) => t.admin);
      if (!needs.length) return false;
      toast(
        needs.length === tweaks.length
          ? 'Isso precisa de privilégios de administrador.'
          : `${needs.length} dos tweaks selecionados precisam de administrador.`,
        { tone: 'warn', action: { label: 'Reabrir como admin', run: () => call('app:relaunchAdmin') } },
      );
      return needs.length === tweaks.length;
    },
    [info, toast],
  );

  const toggleTweak = useCallback(
    async (tweak, enable) => {
      if (enable) {
        if (blockIfNotAdmin([tweak])) return;
        if (!(await confirmRisk([tweak]))) return;
        if (!(await ensureRestorePoint())) return;
      } else if (tweak.admin && !info?.isAdmin) {
        blockIfNotAdmin([tweak]);
        return;
      }
      setBusy((b) => ({ ...b, [tweak.id]: true }));
      const res = await call(enable ? 'tweaks:apply' : 'tweaks:revert', tweak.id);
      setBusy((b) => {
        const n = { ...b };
        delete n[tweak.id];
        return n;
      });
      if (res?.ok) {
        // Optimistic: show the new state now; the live read-back below confirms it.
        if (tweak.verifiable) setStatus((s) => ({ ...s, [tweak.id]: enable }));
        noteRestart(res.restart);
        await Promise.all([refreshStatus([tweak.id, ...(tweak.conflicts || [])]), refreshState()]);
      } else {
        toast(res?.error || 'Falha.', { tone: 'error', duration: 8000 });
        refreshStatus([tweak.id]);
      }
    },
    [blockIfNotAdmin, confirmRisk, ensureRestorePoint, info, noteRestart, refreshStatus, refreshState, toast],
  );

  /** Runs a batch channel with a progress overlay and a summary toast. */
  const runBatch = useCallback(
    async (title, channel, ...args) => {
      setProgress({ title, index: 0, total: 1 });
      const res = await call(channel, ...args);
      setProgress(null);
      await Promise.all([refreshStatus(), refreshState()]);
      if (res?.ok === false && !res.results) {
        toast(res.error || 'Falha.', { tone: 'error' });
        return res;
      }
      const okCount = res.results?.filter((r) => r.ok).length ?? 0;
      const failed = res.failed || [];
      if (failed.length) {
        toast(`${okCount} concluído(s), ${failed.length} com erro: ${failed.slice(0, 2).map((f) => f.name).join(', ')}${failed.length > 2 ? '…' : ''}`, { tone: 'warn', duration: 9000 });
      } else {
        toast(`${okCount} alteração(ões) concluída(s).`, { tone: 'success' });
      }
      noteRestart(res.restart);
      return res;
    },
    [refreshStatus, refreshState, toast, noteRestart],
  );

  const applyMany = useCallback(
    async (tweaks, { title = 'Aplicando tweaks', source } = {}) => {
      const allowed = info?.isAdmin ? tweaks : tweaks.filter((t) => !t.admin);
      if (blockIfNotAdmin(tweaks) || !allowed.length) return null;
      if (!(await confirmRisk(allowed))) return null;
      if (!(await ensureRestorePoint())) return null;
      return runBatch(title, 'tweaks:applyMany', allowed.map((t) => t.id), source);
    },
    [info, blockIfNotAdmin, confirmRisk, ensureRestorePoint, runBatch],
  );

  const revertMany = useCallback(
    (tweaks, { title = 'Desfazendo tweaks', source } = {}) => runBatch(title, 'tweaks:revertMany', tweaks.map((t) => t.id), source),
    [runBatch],
  );

  const value = {
    info, catalog, tweakById, status, statusLoading, applied, settings, onboarded, setOnboarded, busy, pendingRestart,
    setPendingRestart, toast, confirm, updateSettings, toggleTweak, applyMany, revertMany, runBatch, refreshStatus,
    refreshState, ensureRestorePoint, noteRestart, blockIfNotAdmin, update, checkUpdate,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="toasts" role="status">
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.tone] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.tone}`}>
              <Icon />
              <span className="grow">{t.message}</span>
              {t.action && (
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    t.action.run();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Fechar">
                ×
              </button>
            </div>
          );
        })}
      </div>
      {progress && (
        <div className="backdrop">
          <div className="modal progress-card" role="dialog" aria-modal="true">
            <div className="row">
              <span className="spinner" />
              <h3 style={{ margin: 0 }}>{progress.title}</h3>
            </div>
            <div className="meter">
              <div style={{ width: `${progress.total ? Math.round((progress.index / progress.total) * 100) : 0}%` }} />
            </div>
            <div className="row small muted">
              <span className="grow ellipsis">{progress.done ? 'Finalizando…' : progress.name || 'Preparando…'}</span>
              <span className="mono">
                {Math.min(progress.index + (progress.done ? 0 : 1), progress.total)}/{progress.total}
              </span>
            </div>
          </div>
        </div>
      )}
      {dialog && (
        <div className="backdrop" onClick={() => closeDialog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>{dialog.title}</h3>
            <p className="pre">{dialog.body}</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => closeDialog(false)}>
                Cancelar
              </button>
              <button className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => closeDialog(true)} autoFocus>
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
}
