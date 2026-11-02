import { useState } from 'react';
import { PackageX, Trash2, RotateCcw, ShieldAlert } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { Card, Badge, Loading, useAsync } from '../components/ui.jsx';

const LEVELS = [
  { id: 'recommended', label: 'Pode remover', tone: 'success', hint: 'Apps promocionais ou raramente usados.' },
  { id: 'optional', label: 'Opcional', tone: 'warning', hint: 'Úteis para algumas pessoas — remova só se não usa.' },
  { id: 'keep', label: 'Melhor manter', tone: 'danger', hint: 'Removê-los pode quebrar recursos do Windows ou de jogos.' },
];

export default function AppsView() {
  const { toast, confirm } = useApp();
  const list = useAsync(() => call('debloat:scan'), []);
  const [busy, setBusy] = useState(null);
  const remove = async (a) => {
    const body = `${a.warn ? `${a.warn}\n\n` : ''}Você pode reinstalá-lo depois por aqui ou pela Microsoft Store.`;
    if ((a.level === 'keep' || a.warn) && !(await confirm(`Remover ${a.label}?`, body, { confirmLabel: 'Remover', danger: true }))) return;
    setBusy(a.name);
    const res = await call('debloat:remove', a.name);
    setBusy(null);
    if (res?.ok) toast(`${a.label} removido.`, { tone: 'success' }); else toast(res?.error || 'Falha.', { tone: 'error' });
    list.reload();
  };
  const reinstall = async (a) => {
    setBusy(a.name);
    const res = await call('debloat:reinstall', a.name);
    setBusy(null);
    if (res?.ok) toast(`${a.label} reinstalado.`, { tone: 'success' });
    else if (res?.storeFallback) {
      toast('Não foi possível reinstalar localmente — abrindo na Microsoft Store.', { tone: 'warn' });
      call('shell:open', `ms-windows-store://pdp/?PFN=${res.storeFallback}`);
    } else toast(res?.error || 'Falha.', { tone: 'error' });
    list.reload();
  };
  if (list.loading && !list.data) return <Loading label="Listando apps instalados…" />;
  const apps = list.data || [];
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="callout info">
        <ShieldAlert />
        <div className="grow">A remoção vale só para a sua conta e mantém a cópia do sistema, então tudo pode ser reinstalado. Apps não listados aqui nunca são tocados.</div>
      </div>
      {LEVELS.map((lvl) => {
        const items = apps.filter((a) => a.level === lvl.id && (a.installed || a.removedByApp));
        if (!items.length) return null;
        return (
          <Card key={lvl.id} title={lvl.label} sub={lvl.hint} icon={PackageX} end={<Badge tone={lvl.tone}>{items.filter((a) => a.installed).length} instalado(s)</Badge>}>
            <table className="table">
              <tbody>
                {items.map((a) => (
                  <tr key={a.name}>
                    <td>
                      <div style={{ fontWeight: 550 }}>{a.label}</div>
                      <div className="tiny dim mono">{a.name}{a.version ? ` · ${a.version}` : ''}</div>
                      {a.warn && <div className="tiny" style={{ color: 'var(--warning)', marginTop: 2 }}>{a.warn}</div>}
                    </td>
                    <td className="num">
                      {a.installed ? (
                        <button className="btn btn-sm btn-danger" disabled={busy === a.name} onClick={() => remove(a)}>{busy === a.name ? <span className="spinner" /> : <Trash2 />} Remover</button>
                      ) : (
                        <button className="btn btn-sm" disabled={busy === a.name} onClick={() => reinstall(a)}>{busy === a.name ? <span className="spinner" /> : <RotateCcw />} Reinstalar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}
