// The app's accent color is the user's choice (Configurações → Aparência). Every accent token in
// styles.css is derived from one hex here. The intro video keeps its own colors.
export const DEFAULT_ACCENT = '#c8ff00';

export const ACCENT_PRESETS = [
  { name: 'Lima', hex: '#c8ff00' },
  { name: 'Ciano', hex: '#29cdf2' },
  { name: 'Rosa', hex: '#ff5fa2' },
  { name: 'Laranja', hex: '#ff8a1f' },
  { name: 'Lilás', hex: '#a98bff' },
  { name: 'Branco', hex: '#f2f2f2' },
];

const KEY = 'ctrl.accent';
const valid = (hex) => typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex);

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function mixWhite(hex, amount) {
  return `#${channels(hex).map((c) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0')).join('')}`;
}

// WCAG relative luminance: light accents get dark text on buttons, dark accents get white.
function luminance(hex) {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function applyAccent(hex) {
  const c = (valid(hex) ? hex : DEFAULT_ACCENT).toLowerCase();
  const vars = {
    '--accent': c,
    '--accent-hover': mixWhite(c, 0.25),
    '--accent-ink': luminance(c) > 0.3 ? '#0a0a0a' : '#ffffff',
    '--accent-muted': `${c}1f`,
    '--accent-subtle': `${c}12`,
    '--border-accent': `${c}66`,
    '--success': c,
    '--success-muted': `${c}1a`,
    '--c-cpu': c,
    '--c-net': c,
  };
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
  try { localStorage.setItem(KEY, c); } catch { /* storage unavailable: color still applies for this session */ }
}

// Paint the last chosen color before React mounts, so the app never flashes the default.
export function applyStoredAccent() {
  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch { /* ignore */ }
  if (valid(stored)) applyAccent(stored);
}
