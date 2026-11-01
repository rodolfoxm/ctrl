import { useState } from 'react';
import { Rocket, Search, FolderOpen, KeyRound } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { Card, Switch, Badge, Loading, Empty, useAsync } from '../components/ui.jsx';
import ModuleView from '../components/ModuleView.jsx';

export default function StartupView() {
  const { toast } = useApp();
  const list = useAsync(() => call('startup:list'), []);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);
  const items = (list.data || []).filter((i) => !query || `${i.name} ${i.command}`.toLowerCase().includes(query.toLowerCase()));
  const toggle = async (item, enabled) => {
    setBusy(item.name + item.approvedKey);
    const res = await call('startup:set', item.approvedKey, item.name, enabled);
    setBusy(null);
    if (res?.ok) list.setData(list.data.map((i) => (i === item ? { ...i, enabled } : i)));
    else toast(res?.error || 'Falha.', { tone: 'error' });
  };
  const enabledCount = (list.data || []).filter((i) => i.enabled).length;
  return (
    <div className="stack" style={{ gap: 18 }}>
      <Card
        title="Apps de inicialização"
        sub={list.data ? `${enabledCount} de ${list.data.length} abrem junto com o Windows. Desativar não desinstala nada — é o mesmo interruptor do Gerenciador de Tarefas.` : ''}
        icon={Rocket}
        end={<div className="search-box" style={{ width: 220 }}><Search /><input className="input" placeholder="Filtrar…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>}
      >
        {list.loading && !list.data ? <Loading /> : items.length ? (
          <table className="table">
            <tbody>
              {items.map((i) => (
                <tr key={i.name + i.approvedKey}>
                  <td style={{ width: 28 }}>{i.kind === 'folder' ? <FolderOpen size={15} className="dim" /> : <KeyRound size={15} className="dim" />}</td>
                  <td>
                    <div className="row" style={{ fontWeight: 550 }}>{i.name.replace(/\.lnk$/i, '')}<Badge>{i.scope}</Badge></div>
                    <div className="tiny dim mono ellipsis" style={{ maxWidth: 640 }} title={i.command}>{i.command}</div>
                  </td>
                  <td className="num"><Switch on={i.enabled} busy={busy === i.name + i.approvedKey} onChange={(v) => toggle(i, v)} label={i.name} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty title="Nenhum app de inicialização" />}
      </Card>
      <ModuleView moduleId="startup" compact />
    </div>
  );
}
