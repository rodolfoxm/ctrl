import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ChevronDown, ChevronUp, ShieldAlert, RotateCw, Zap, AlertTriangle, EyeOff, Wand2, Undo2, Lock, HelpCircle } from 'lucide-react';
import { useApp } from '../context.jsx';
import { IMPACT, RISK, RISK_TONE, RESTART } from '../lib/format.js';
import { Switch, Checkbox, Badge, Empty } from './ui.jsx';

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'on', label: 'Ativos' },
  { id: 'off', label: 'Inativos' },
  { id: 'quick', label: 'Essenciais' },
];

function TweakRow({ t, selected, onSelect, expanded, onExpand, highlight }) {
  const { status, busy, toggleTweak, statusLoading, applied } = useApp();
  const live = status[t.id];
  const isOn = live === true || (live == null && !!applied[t.id]);
  const hidden = !!t.hiddenReason;
  return (
    <div id={`tweak-${t.id}`} className={`tweak ${isOn ? 'on' : ''} ${hidden ? 'hidden-tweak' : ''}`} style={highlight ? { borderColor: 'var(--accent)', boxShadow: 'var(--glow)' } : undefined}>
      <Checkbox checked={selected} onChange={onSelect} label={`Selecionar ${t.name}`} />
      <div className="grow">
        <div className="tweak-title">
          {t.name}
          {t.tags?.includes('quick-win') && <Badge tone="accent" icon={Zap}>Essencial</Badge>}
          {t.tags?.includes('fix') && <Badge tone="info" icon={Wand2}>Correção</Badge>}
        </div>
        <div className="tweak-desc">{t.description}</div>
        <div className="tweak-meta">
          <Badge>{IMPACT[t.impact]}</Badge>
          <Badge tone={RISK_TONE[t.risk]}>{RISK[t.risk]}</Badge>
          {t.admin && <Badge icon={Lock}>Admin</Badge>}
          {t.restart && t.restart !== 'none' && <Badge tone={t.restart === 'reboot' ? 'warning' : ''} icon={RotateCw}>{RESTART[t.restart]}</Badge>}
          {hidden && <Badge tone="danger" icon={EyeOff}>{t.hiddenReason}</Badge>}
          {!t.verifiable && <Badge icon={HelpCircle} title="O estado deste tweak não pode ser lido de volta do sistema">Sem verificação</Badge>}
          <button className="btn btn-xs btn-ghost" onClick={onExpand}>
            {expanded ? <ChevronUp /> : <ChevronDown />} Detalhes
          </button>
        </div>
      </div>
      <div className="tweak-actions">
        <span className={`state-label ${live === true ? 'on' : live === false ? 'off' : 'unknown'}`}>
          {statusLoading && live === undefined ? '…' : live === true ? 'Ativo' : live === false ? 'Inativo' : applied[t.id] ? 'Aplicado' : '—'}
        </span>
        <Switch on={isOn} busy={busy[t.id]} onChange={(v) => toggleTweak(t, v)} label={t.name} disabled={hidden && !isOn} />
      </div>
      {expanded && (
        <div className="tweak-details">
          {t.warn && (
            <div className="row" style={{ color: 'var(--warning)', marginBottom: 8 }}>
              <AlertTriangle size={14} /> {t.warn}
            </div>
          )}
          {t.changes?.length ? (
            <>
              <div className="dim tiny" style={{ marginBottom: 4 }}>Valores de registro alterados (o valor anterior é salvo e restaurado ao desfazer):</div>
              {t.changes.map((c) => <code key={c}>{c}</code>)}
            </>
          ) : (
            <div className="dim">Aplicado por script PowerShell; o estado anterior é capturado antes e restaurado ao desfazer.</div>
          )}
          {applied[t.id] && (
            <div className="dim tiny" style={{ marginTop: 6 }}>
              Aplicado em {new Date(applied[t.id].at).toLocaleString('pt-BR')} ({applied[t.id].source || 'manual'})
            </div>
          )}
          <div className="dim tiny" style={{ marginTop: 6 }}>ID: <span className="mono selectable">{t.id}</span></div>
        </div>
      )}
    </div>
  );
}

export default function TweakList({ tweaks, emptyText = 'Nenhum tweak neste módulo.' }) {
  const { status, settings, updateSettings, applyMany, revertMany, applied, info } = useApp();
  const [params] = useSearchParams();
  const focusId = params.get('tweak');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(() => new Set(focusId ? [focusId] : []));

  useEffect(() => {
    if (!focusId) return;
    setExpanded((e) => new Set([...e, focusId]));
    setTimeout(() => document.getElementById(`tweak-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  }, [focusId]);

  const isOn = (t) => status[t.id] === true || (status[t.id] == null && !!applied[t.id]);
  const showHidden = settings?.showHidden;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tweaks.filter((t) => {
      if (t.hiddenReason && !showHidden && t.id !== focusId) return false;
      if (q && !`${t.name} ${t.description} ${t.id}`.toLowerCase().includes(q)) return false;
      if (filter === 'on' && !isOn(t)) return false;
      if (filter === 'off' && isOn(t)) return false;
      if (filter === 'quick' && !t.tags?.includes('quick-win')) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tweaks, query, filter, status, applied, showHidden, focusId]);

  const hiddenCount = tweaks.filter((t) => t.hiddenReason).length;
  const activeCount = tweaks.filter(isOn).length;
  const chosen = tweaks.filter((t) => selected.has(t.id));
  const toggleSel = (id) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const eligibleOff = visible.filter((t) => !t.hiddenReason && !isOn(t) && (info?.isAdmin || !t.admin));

  return (
    <div>
      <div className="toolbar">
        <div className="search-box">
          <Search />
          <input className="input" placeholder="Filtrar tweaks…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {FILTERS.map((f) => (
          <button key={f.id} className={`chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label}
            {f.id === 'on' && <span className="count">{activeCount}</span>}
          </button>
        ))}
        <div className="grow" />
        {hiddenCount > 0 && (
          <button className={`chip ${showHidden ? 'active' : ''}`} onClick={() => updateSettings({ showHidden: !showHidden })} title="Tweaks que não se aplicam a esta máquina">
            <EyeOff size={13} /> {hiddenCount} oculto(s)
          </button>
        )}
        <button
          className="btn btn-sm"
          disabled={!eligibleOff.length}
          onClick={() => setSelected(new Set(eligibleOff.map((t) => t.id)))}
          title="Seleciona os tweaks visíveis que ainda não estão ativos"
        >
          Selecionar inativos
        </button>
      </div>
      {!info?.isAdmin && tweaks.some((t) => t.admin) && (
        <div className="callout warning" style={{ marginBottom: 12 }}>
          <ShieldAlert />
          <div className="grow">Os tweaks marcados como “Admin” só podem ser aplicados com o app aberto como administrador.</div>
        </div>
      )}
      {visible.length ? (
        <div className="tweak-list">
          {visible.map((t) => (
            <TweakRow
              key={t.id}
              t={t}
              selected={selected.has(t.id)}
              onSelect={() => toggleSel(t.id)}
              expanded={expanded.has(t.id)}
              highlight={t.id === focusId}
              onExpand={() =>
                setExpanded((e) => {
                  const n = new Set(e);
                  n.has(t.id) ? n.delete(t.id) : n.add(t.id);
                  return n;
                })
              }
            />
          ))}
        </div>
      ) : (
        <Empty title="Nada por aqui">{query || filter !== 'all' ? 'Nenhum tweak corresponde aos filtros.' : emptyText}</Empty>
      )}
      {chosen.length > 0 && (
        <div className="bulkbar">
          <strong>{chosen.length}</strong> selecionado(s)
          <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>Limpar</button>
          <div className="grow" />
          <button
            className="btn btn-sm"
            disabled={!chosen.some((t) => applied[t.id] || isOn(t))}
            onClick={async () => {
              await revertMany(chosen.filter((t) => applied[t.id]), { title: 'Desfazendo selecionados' });
              setSelected(new Set());
            }}
          >
            <Undo2 /> Desfazer
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={async () => {
              const res = await applyMany(chosen.filter((t) => !t.hiddenReason), { title: 'Aplicando selecionados' });
              if (res) setSelected(new Set());
            }}
          >
            <Zap /> Aplicar selecionados
          </button>
        </div>
      )}
    </div>
  );
}
