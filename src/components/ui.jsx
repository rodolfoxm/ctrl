import { useEffect, useState } from 'react';
import { Check, Orbit } from 'lucide-react';

export function Switch({ on, onChange, disabled, busy, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      className={`switch ${on ? 'on' : ''} ${busy ? 'busy' : ''}`}
      disabled={disabled || busy}
      onClick={() => onChange(!on)}
    >
      <span className="track" />
      <span className="thumb" />
    </button>
  );
}

export function Checkbox({ checked, onChange, label }) {
  return (
    <button type="button" className={`check ${checked ? 'checked' : ''}`} aria-pressed={checked} aria-label={label} onClick={() => onChange(!checked)}>
      {checked && <Check />}
    </button>
  );
}

export function Badge({ tone, icon: Icon, children, title }) {
  return (
    <span className={`badge ${tone || ''}`} title={title}>
      {Icon && <Icon />}
      {children}
    </span>
  );
}

export function Card({ title, sub, icon: Icon, end, children, className = '', ...rest }) {
  return (
    <section className={`card ${className}`} {...rest}>
      {(title || end) && (
        <div className="card-head">
          {Icon && (
            <div className="card-icon">
              <Icon />
            </div>
          )}
          <div className="grow">
            {title && <h3>{title}</h3>}
            {sub && <div className="sub">{sub}</div>}
          </div>
          {end && <div className="end">{end}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, sub, color }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={color ? { color } : undefined}>
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

/** Counts up to a number once it is known (skipped when the system asks for less motion). */
export function CountUp({ value }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setShown(value);
    const from = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - from) / 700);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

export function Meter({ value, color }) {
  return (
    <div className="meter">
      <div style={{ width: `${Math.max(0, Math.min(100, value || 0))}%`, background: color }} />
    </div>
  );
}

export function Empty({ icon: Icon = Orbit, title, children, action }) {
  return (
    <div className="empty">
      <div className="orbit">
        <Icon size={22} />
      </div>
      {title && <h4>{title}</h4>}
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Callout({ tone = 'info', icon: Icon, children }) {
  return (
    <div className={`callout ${tone}`}>
      {Icon && <Icon />}
      <div className="grow">{children}</div>
    </div>
  );
}

export function Spinner({ lg }) {
  return <span className={`spinner ${lg ? 'lg' : ''}`} />;
}

export function Loading({ label = 'Carregando…' }) {
  return (
    <div className="empty">
      <Spinner lg />
      <p>{label}</p>
    </div>
  );
}

/** Async button: shows a spinner while the handler runs. */
export function ActionButton({ onClick, children, className = 'btn', icon: Icon, disabled, ...rest }) {
  const [running, setRunning] = useState(false);
  return (
    <button
      className={className}
      disabled={disabled || running}
      onClick={async (e) => {
        setRunning(true);
        try {
          await onClick(e);
        } finally {
          setRunning(false);
        }
      }}
      {...rest}
    >
      {running ? <Spinner /> : Icon && <Icon />}
      {children}
    </button>
  );
}

export function Ring({ value, size = 168, stroke = 12, caption, color }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value || 0));
  const tone = color || (v >= 80 ? 'var(--success)' : v >= 55 ? 'var(--accent)' : v >= 35 ? 'var(--warning)' : 'var(--danger)');
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tone} />
            <stop offset="100%" stopColor="var(--text-3)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ring-grad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.05,.7,.1,1)' }}
        />
      </svg>
      <div className="ring-label">
        <div className="ring-value">{value == null ? '—' : Math.round(v)}</div>
        {caption && <div className="ring-caption">{caption}</div>}
      </div>
    </div>
  );
}

/** Minimal SVG area/line chart for live series. */
export function Sparkline({ data, max, height = 60, color = 'var(--accent)', fill = true }) {
  const w = 300;
  const pts = data.length ? data : [0];
  const top = max ?? Math.max(1, ...pts);
  const step = pts.length > 1 ? w / (pts.length - 1) : w;
  const coords = pts.map((v, i) => [i * step, height - (Math.min(v ?? 0, top) / top) * (height - 4) - 2]);
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const gid = `g${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${line} L${w},${height} L0,${height} Z`} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(fn)
      .then((data) => {
        if (!alive) return;
        if (data && data.ok === false) setState({ loading: false, data: null, error: data.error });
        else setState({ loading: false, data, error: null });
      })
      .catch((err) => alive && setState({ loading: false, data: null, error: err.message }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1), setData: (data) => setState((s) => ({ ...s, data })) };
}

/** The ctrl wordmark: corner bracket, the name, a block cursor that blinks. */
export function Wordmark({ text = 'ctrl', size, still }) {
  return (
    <span className={`wordmark ${still ? 'static' : ''}`} style={size ? { fontSize: size } : undefined} aria-label="ctrl" role="img">
      <i className="wm-corner" aria-hidden="true" />
      <span aria-hidden="true">{text}</span>
      <i className="wm-cursor" aria-hidden="true" />
    </span>
  );
}

/** App icon: the "c" version of the wordmark on a black tile. */
export function Logo({ size = 28 }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size, background: '#000', borderRadius: size * 0.24, fontSize: size * 0.62 }}>
      <Wordmark text="c" still />
    </span>
  );
}
