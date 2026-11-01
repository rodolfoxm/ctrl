import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft, SlidersHorizontal, Wrench } from 'lucide-react';
import { useApp } from '../context.jsx';
import { NAV, AREAS, modulePath } from '../nav.js';

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function GlobalSearch({ onClose, onNavigate }) {
  const { catalog } = useApp();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => inputRef.current?.focus(), []);

  const entries = useMemo(() => {
    const pages = NAV.flatMap((g) => g.items.map((i) => ({ kind: 'Página', label: i.label, path: i.path, icon: i.icon, text: i.label })));
    const subs = Object.entries(AREAS).flatMap(([area, cfg]) =>
      cfg.subs.map((s) => ({ kind: cfg.label, label: s.label, path: `/${area}/${s.id}`, icon: s.icon, text: `${cfg.label} ${s.label}` })),
    );
    const tweaks = (catalog?.tweaks || []).map((t) => ({
      kind: 'Tweak', label: t.name, sub: t.description, path: `${modulePath(t.module)}?tweak=${t.id}`, icon: SlidersHorizontal, text: `${t.name} ${t.description} ${t.id}`,
    }));
    const actions = (catalog?.actions || []).map((a) => ({ kind: 'Correção', label: a.name, sub: a.description, path: '/system/fixes', icon: Wrench, text: `${a.name} ${a.description}` }));
    return [...pages, ...subs, ...tweaks, ...actions];
  }, [catalog]);

  const results = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return entries.filter((e) => e.kind !== 'Tweak' && e.kind !== 'Correção').slice(0, 14);
    const words = q.split(/\s+/);
    return entries
      .map((e) => {
        const t = norm(e.text);
        if (!words.every((w) => t.includes(w))) return null;
        const score = (norm(e.label).startsWith(q) ? 0 : norm(e.label).includes(q) ? 1 : 2) + (e.kind === 'Tweak' ? 0.5 : 0);
        return { ...e, score };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score)
      .slice(0, 40);
  }, [entries, query]);

  useEffect(() => setActive(0), [query]);

  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    }
    if (e.key === 'Enter' && results[active]) onNavigate(results[active].path);
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal palette" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Busca global">
        <div className="search-box">
          <Search />
          <input ref={inputRef} className="input" placeholder="Buscar páginas, tweaks e correções…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} />
        </div>
        <div className="palette-list">
          {!results.length && <div className="empty"><p>Nada encontrado para “{query}”.</p></div>}
          {results.map((r, i) => {
            const Icon = r.icon;
            return (
              <div key={`${r.path}-${r.label}`} className={`palette-item ${i === active ? 'active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => onNavigate(r.path)}>
                <Icon />
                <div className="grow">
                  <div className="ellipsis">{r.label}</div>
                  {r.sub && <div className="tiny dim ellipsis">{r.sub}</div>}
                </div>
                <span className="kind">{r.kind}</span>
                {i === active && <CornerDownLeft size={13} className="dim" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
