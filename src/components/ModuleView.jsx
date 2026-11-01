import { useMemo } from 'react';
import { Zap, Undo2 } from 'lucide-react';
import { useApp } from '../context.jsx';
import TweakList from './TweakList.jsx';
import { Loading } from './ui.jsx';

/** Header with module-level bulk actions plus the module's tweak list. */
export default function ModuleView({ moduleId, compact }) {
  const { catalog, applyMany, revertMany, status, applied, info } = useApp();
  const mod = catalog?.modules.find((m) => m.id === moduleId);
  const tweaks = useMemo(() => (catalog?.tweaks || []).filter((t) => t.module === moduleId), [catalog, moduleId]);
  if (!catalog) return <Loading />;
  const eligible = tweaks.filter((t) => !t.hiddenReason && (info?.isAdmin || !t.admin));
  const safe = eligible.filter((t) => t.risk === 'safe' && status[t.id] !== true);
  const mine = tweaks.filter((t) => applied[t.id]);
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row wrap">
        <div className="grow">
          <h2 style={{ margin: 0, fontSize: compact ? 15 : 17 }}>{compact ? `Tweaks: ${mod?.label}` : mod?.label}</h2>
          <div className="muted small">{mod?.description}</div>
        </div>
        <button className="btn btn-sm" disabled={!mine.length} onClick={() => revertMany(mine, { title: `Desfazendo ${mod?.label}` })}>
          <Undo2 /> Desfazer módulo
        </button>
        <button
          className="btn btn-sm btn-primary"
          disabled={!safe.length}
          onClick={() => applyMany(safe, { title: `Aplicando ${mod?.label}`, source: `módulo ${mod?.label}` })}
          title="Aplica todos os tweaks seguros deste módulo que ainda não estão ativos"
        >
          <Zap /> Aplicar seguros ({safe.length})
        </button>
      </div>
      <TweakList tweaks={tweaks} />
    </div>
  );
}
