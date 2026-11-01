export function bytes(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = Math.abs(n);
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : digits)} ${units[i]}`;
}

export function rate(n) {
  return n == null ? '—' : `${bytes(n)}/s`;
}

export function pct(n) {
  return n == null ? '—' : `${Math.round(n)}%`;
}

export function date(iso, opts = { dateStyle: 'short', timeStyle: 'short' }) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', opts);
}

export function ago(iso) {
  if (!iso) return 'nunca';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 0) return 'agora';
  if (s < 60) return 'agora mesmo';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `há ${Math.floor(s / 86400)} dia(s)`;
  return date(iso, { dateStyle: 'short' });
}

export function duration(sec) {
  if (sec == null) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}min`;
  return `${m} min`;
}

export function ms(n) {
  return n == null ? '—' : n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`;
}

export const IMPACT = { low: 'Impacto baixo', medium: 'Impacto médio', high: 'Impacto alto' };
export const RISK = { safe: 'Seguro', moderate: 'Moderado', advanced: 'Avançado' };
// "Seguro" stays neutral: the accent is red-pink, which would read as a warning on a risk label.
export const RISK_TONE = { safe: '', moderate: 'warning', advanced: 'danger' };
export const RESTART = { explorer: 'Reinicia o Explorer', logoff: 'Requer novo logon', reboot: 'Requer reinício' };

/** "Hoje, 14:27", "Ontem, 09:10" or "12/10, 18:00" — how the activity list reads times. */
export function when(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const day = new Date(d).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  if (day === today) return `Hoje, ${time}`;
  if (today - day === 864e5) return `Ontem, ${time}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${time}`;
}
