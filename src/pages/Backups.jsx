import { Link } from 'react-router-dom';
import { ArchiveRestore, Plus, History, ShieldAlert, Download, FolderOpen, Undo2 } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { date, ago } from '../lib/format.js';
import { Card, Badge, Empty, Loading, useAsync, Callout, ActionButton, Stat } from '../components/ui.jsx';

const TYPE = { 0: 'Instalação de app', 1: 'Desinstalação', 7: 'Checkpoint', 10: 'Driver', 12: 'Configurações', 13: 'Cancelado' };

/** Histórico › Backups: Windows restore points plus exporting the app state. */
export function BackupsTab() {
  const { info, toast, applied } = useApp();
  const st = useAsync(() => call('backups:status'), []);
  const d = st.data;
  const create = async () => {
    const res = await call('backups:create', 'ctrl - manual');
    if (res?.ok) toast('Ponto de restauração criado.', { tone: 'success' }); else toast(res?.error || 'Falha.', { tone: 'error', duration: 9000 });
    st.reload();
  };
  const enable = async () => {
    const res = await call('backups:enable');
    if (res?.ok) toast('Proteção do sistema ativada no disco do Windows.', { tone: 'success' }); else toast(res?.error, { tone: 'error' });
    st.reload();
  };
  const exportState = async () => {
    const res = await call('state:export');
    if (res?.ok) toast(`Salvo em ${res.path}`, { tone: 'success' });
  };
  const appliedCount = Object.keys(applied).length;
  return (
    <>
      <div className="grid grid-3">
        <Card><Stat label="Backups de tweaks" value={appliedCount} sub="valores originais guardados pelo app" /></Card>
        <Card><Stat label="Pontos de restauração" value={d ? d.points.length : '—'} sub={d?.points[0] ? `último ${ago(d.points[0].created)}` : ''} /></Card>
        <Card><Stat label="Proteção do sistema" value={d ? (d.enabled ? 'Ativa' : 'Desligada') : '—'} color={d && !d.enabled ? 'var(--warning)' : 'var(--success)'} /></Card>
      </div>

      <div className="section-title"><ArchiveRestore size={16} className="dim" /><h2>Pontos de restauração do Windows</h2>
        <div className="end">
          <button className="btn btn-sm btn-ghost" onClick={() => call('backups:openRestore')}><History /> Restaurar sistema…</button>
          <ActionButton className="btn btn-sm btn-primary" icon={Plus} disabled={!info?.isAdmin} onClick={create}>Criar agora</ActionButton>
        </div>
      </div>
      {d && !d.enabled && (
        <Callout tone="warning" icon={ShieldAlert}>
          A Proteção do Sistema está desligada, então o Windows não cria pontos de restauração.{' '}
          <ActionButton className="btn btn-xs" disabled={!info?.isAdmin} onClick={enable}>Ativar no disco C:</ActionButton>
        </Callout>
      )}
      <Card style={{ marginTop: 12 }}>
        {st.loading && !d ? <Loading /> : d?.points.length ? (
          <table className="table">
            <thead><tr><th>Descrição</th><th>Tipo</th><th>Criado</th><th className="num">Nº</th></tr></thead>
            <tbody>
              {d.points.map((p) => (
                <tr key={p.seq}>
                  <td>{p.description}{/^(ctrl|mojo)/.test(p.description || '') && <> <Badge tone="accent">ctrl</Badge></>}</td>
                  <td className="dim small">{TYPE[p.type] || p.type}</td>
                  <td className="small">{date(p.created)}</td>
                  <td className="num dim">{p.seq}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty title="Nenhum ponto de restauração">Crie um antes de grandes mudanças — o app cria um automaticamente antes da primeira alteração de cada sessão.</Empty>}
        <div className="small dim" style={{ marginTop: 10 }}>Restaurar é feito pelo assistente do próprio Windows (“Restaurar sistema…”), que reinicia o PC.</div>
      </Card>

      <div className="section-title"><Undo2 size={16} className="dim" /><h2>Backups dos tweaks</h2></div>
      <div className="grid grid-2">
        <Card title="Desfazer pelo app" icon={Undo2}>
          <div className="small muted" style={{ marginBottom: 12 }}>Os {appliedCount} tweaks aplicados podem ser desfeitos um a um ou em lote, voltando exatamente ao valor anterior.</div>
          <Link className="btn btn-sm" to="/history?tab=undo">Abrir Central de desfazer</Link>
        </Card>
        <Card title="Exportar estado" icon={Download}>
          <div className="small muted" style={{ marginBottom: 12 }}>Salva num arquivo JSON os tweaks aplicados com seus valores originais, perfis e configurações — útil antes de reinstalar o app.</div>
          <div className="row">
            <button className="btn btn-sm" onClick={exportState}><Download /> Exportar</button>
            <button className="btn btn-sm btn-ghost" onClick={() => call('state:openFolder')}><FolderOpen /> Abrir pasta de dados</button>
          </div>
        </Card>
      </div>
    </>
  );
}
