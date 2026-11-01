import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Undo2, History as HistoryIcon, Trash2, Download, ArchiveRestore } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { date } from '../lib/format.js';
import { Page, Hero, SubNav } from '../components/Page.jsx';
import { Card, Empty, ActionButton } from '../components/ui.jsx';
import { ActivityList } from './Dashboard.jsx';
import { BackupsTab } from './Backups.jsx';

const TABS = [
  { id: 'activity', label: 'Atividade', icon: HistoryIcon },
  { id: 'undo', label: 'Central de desfazer', icon: Undo2 },
  { id: 'backups', label: 'Backups e restauração', icon: ArchiveRestore },
];

const WINDOWS = [
  { id: '1h', label: 'Última hora', ms: 36e5 },
  { id: '24h', label: 'Últimas 24 horas', ms: 864e5 },
  { id: '7d', label: 'Últimos 7 dias', ms: 7 * 864e5 },
];

function UndoTab() {
  const { applied, revertMany, tweakById, runBatch, confirm } = useApp();
  const list = Object.entries(applied).map(([id, v]) => ({ id, ...v, tweak: tweakById.get(id) })).sort((a, b) => (a.at < b.at ? 1 : -1));
  const since = (w) => list.filter((x) => Date.now() - new Date(x.at).getTime() <= w.ms);
  const undoWindow = async (w) => {
    const n = since(w).length;
    if (!(await confirm(`Desfazer ${n} alteração(ões)?`, `Tudo que o app aplicou em: ${w.label.toLowerCase()}. Cada tweak volta exatamente ao valor que tinha antes.`, { confirmLabel: 'Desfazer', danger: true }))) return;
    runBatch(`Desfazendo: ${w.label.toLowerCase()}`, 'guardian:undoSince', new Date(Date.now() - w.ms).toISOString());
  };
  const undoAll = async () => {
    if (!(await confirm('Desfazer tudo?', `Os ${list.length} tweaks aplicados pelo app voltam ao estado anterior. Seus arquivos não são tocados.`, { confirmLabel: 'Desfazer tudo', danger: true }))) return;
    runBatch('Desfazendo tudo', 'guardian:undoAll');
  };
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Card title="Desfazer em lote" sub="Cada tweak guarda o valor original antes de ser aplicado; desfazer restaura exatamente esse valor." icon={Undo2}>
        <div className="row wrap">
          {WINDOWS.map((w) => (
            <button key={w.id} className="btn" disabled={!since(w).length} onClick={() => undoWindow(w)}>{w.label} ({since(w).length})</button>
          ))}
          <div className="grow" />
          <button className="btn btn-danger" disabled={!list.length} onClick={undoAll}><Undo2 /> Desfazer tudo ({list.length})</button>
        </div>
      </Card>
      <Card title="Tweaks aplicados" icon={HistoryIcon}>
        {list.length ? (
          <table className="table">
            <thead><tr><th>Tweak</th><th>Aplicado</th><th>Origem</th><th /></tr></thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td>{x.name}</td>
                  <td className="dim small">{date(x.at)}</td>
                  <td className="dim small">{x.source || 'manual'}</td>
                  <td className="num">{x.tweak && <ActionButton className="btn btn-xs" onClick={() => revertMany([x.tweak], { title: `Desfazendo ${x.name}` })}>Desfazer</ActionButton>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty title="Nada para desfazer">O app ainda não aplicou nenhum tweak neste PC.</Empty>}
      </Card>
    </div>
  );
}

function ActivityTab() {
  const { confirm } = useApp();
  const [state, setState] = useState(null);
  const load = () => call('state:get').then(setState);
  useEffect(() => {
    load();
  }, []);
  const exportLog = () => {
    const lines = (state?.history || []).map((h) => `${h.at}\t${h.action}\t${h.ok === false ? 'ERRO' : 'ok'}\t${h.name || h.id}${h.error ? `\t${h.error}` : ''}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ctrl-atividade-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
  };
  return (
    <Card
      title="Registro de atividade"
      sub="Tudo que o app aplicou, desfez, reparou ou executou (últimas 500 entradas)."
      icon={HistoryIcon}
      end={
        <>
          <button className="btn btn-sm btn-ghost" disabled={!state?.history?.length} onClick={exportLog}><Download /> Exportar</button>
          <button className="btn btn-sm btn-ghost" disabled={!state?.history?.length} onClick={async () => {
            if (await confirm('Limpar o registro?', 'Apaga apenas o histórico. Os backups dos tweaks aplicados são mantidos.', { confirmLabel: 'Limpar', danger: true })) {
              await call('guardian:clearHistory');
              load();
            }
          }}><Trash2 /> Limpar</button>
        </>
      }
    >
      <ActivityList items={state?.history} />
    </Card>
  );
}

export default function History() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get('tab'))?.id || 'activity';
  return (
    <Page title="Histórico">
      <Hero title="Tudo o que o ctrl mudou, e como voltar atrás">
        Cada ajuste guarda o valor original antes de ser aplicado. Aqui você vê o registro completo, desfaz uma alteração, um período ou
        tudo, e cuida dos pontos de restauração do Windows.
      </Hero>
      <SubNav items={TABS} active={tab} onChange={(id) => setParams({ tab: id })} />
      {tab === 'activity' && <ActivityTab />}
      {tab === 'undo' && <UndoTab />}
      {tab === 'backups' && <BackupsTab />}
    </Page>
  );
}
