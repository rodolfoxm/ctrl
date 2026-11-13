import { useRef } from 'react';
import { useTitle } from './Shell.jsx';

export function Page({ title, children }) {
  useTitle(title);
  return <div className="page">{children}</div>;
}

/** Page header: a plain title, one line of context and the page actions. */
export function Hero({ title, children, actions, aside }) {
  return (
    <header className="hero">
      <div className="grow">
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {(actions || aside) && (
        <div className="hero-actions">
          {actions}
          {aside}
        </div>
      )}
    </header>
  );
}

/** Horizontal tab bar with optional group labels, keyboard-navigable. */
export function SubNav({ items, active, onChange }) {
  const refs = useRef([]);
  const index = items.findIndex((i) => i.id === active);
  const onKey = (e) => {
    let next = null;
    if (e.key === 'ArrowRight') next = (index + 1) % items.length;
    if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    if (next != null) {
      e.preventDefault();
      onChange(items[next].id);
      refs.current[next]?.focus();
    }
  };
  return (
    <div className="subnav" role="tablist" onKeyDown={onKey}>
      {items.map((item, i) => {
        const Icon = item.icon;
        const newGroup = item.group && item.group !== items[i - 1]?.group;
        return (
          <span key={item.id} style={{ display: 'contents' }}>
            {newGroup && (
              <>
                {i > 0 && <span className="subnav-divider" />}
                <span className="subnav-group">{item.group}</span>
              </>
            )}
            <button
              ref={(el) => (refs.current[i] = el)}
              role="tab"
              aria-selected={item.id === active}
              tabIndex={item.id === active ? 0 : -1}
              className={`subnav-tab ${item.id === active ? 'active' : ''}`}
              onClick={() => onChange(item.id)}
            >
              {Icon && <Icon />}
              {item.label}
              {item.count != null && <span className="tiny dim">{item.count}</span>}
            </button>
          </span>
        );
      })}
    </div>
  );
}
