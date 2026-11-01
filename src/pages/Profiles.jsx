import { useMemo, useState } from 'react';
import { Layers, Play, Undo2, Plus, Download, Upload, Trash2, Pencil, Search, CheckCircle2 } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { iconFor } from '../lib/icons.js';
import { Page, Hero } from '../components/Page.jsx';
import { Card, Badge, Meter, Loading, useAsync, Checkbox, Empty } from '../components/ui.jsx';

const ACCENT = { danger: 'var(--danger)', accent: 'var(--accent)', info: 'var(--info)', success: 'var(--success)', warning: 'var(--warning)' };

function ProfileEditor({ initial, onClose, onSaved }) {
  const { catalog, toast } = useApp();
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [chosen, setChosen] = useState(new Set(initial?.tweaks || []));
  const [query, setQuery] = useState('');
  const list = useMemo(
    () => catalog.tweaks.filter((t) => !query || `${t.name} ${t.module}`.toLowerCase().includes(query.toLowerCase())),
    [catalog, query],
  );
  const save = async () => {
    if (!name.trim()) return toast('Dê um nome ao perfil.', { tone: 'warn' });
    const res = await call('profiles:save', { id: initial?.id, name, description, tweaks: [...chosen] });
    if (res?.ok) onSaved();
    else toast(res?.error || 'Falha.', { tone: 'error' });
  };
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{initial ? 'Editar perfil' : 'Novo perfil'}</h3>
        <div className="stack">
          <input className="input" placeholder="Nome do perfil" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <textarea className="input" rows={2} placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="row">
            <div className="search-box grow"><Search /><input className="input" placeholder="Filtrar tweaks…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
            <Badge tone="accent">{chosen.size} selecionado(s)</Badge>
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
            {list.map((t) => (
              <label key={t.id} className="row" style={{ padding: '7px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                <Checkbox checked={chosen.has(t.id)} onChange={(v) => setChosen((s) => { const n = new Set(s); v ? n.add(t.id) : n.delete(t.id); return n; })} label={t.name} />
                <span className="grow small">{t.name}</span>
                <span className="tiny dim">{catalog.modules.find((m) => m.id === t.module)?.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Salvar perfil</button>
        </div>
      </div>
    </div>
  );
}

export default function Profiles() {
  const { catalog, runBatch, ensureRestorePoint, confirm, toast, tweakById, info } = useApp();
  const list = useAsync(() => call('profiles:list'), []);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);
  if (!catalog || (list.loading && !list.data)) return <Page title="Perfis"><Loading /></Page>;
  const { profiles = [], active } = list.data || {};

  const apply = async (p) => {
    const needsAdmin = p.eligible.some((id) => tweakById.get(id)?.admin);
    if (needsAdmin && !info?.isAdmin) return toast('Perfis aplicam tweaks que precisam de administrador.', { tone: 'warn', action: { label: 'Reabrir como admin', run: () => call('app:relaunchAdmin') } });
    const risky = p.eligible.map((id) => tweakById.get(id)).filter((t) => t && (t.risk === 'advanced' || t.warn));
    const ok = await confirm(`Aplicar o perfil “${p.name}”?`, `${p.eligible.length} tweaks serão aplicados${p.tweaks.length > p.eligible.length ? ` (${p.tweaks.length - p.eligible.length} não se aplicam a este PC)` : ''}.${risky.length ? `\n\nCom ressalvas:\n${risky.map((t) => `• ${t.name}`).join('\n')}` : ''}\n\nTudo pode ser desfeito pelo próprio perfil ou pelo Guardião.`, { confirmLabel: 'Aplicar perfil' });
    if (!ok || !(await ensureRestorePoint())) return;
    await runBatch(`Aplicando perfil ${p.name}`, 'profiles:apply', p.id);
    list.reload();
  };
  const revert = async (p) => {
    if (!(await confirm(`Desfazer o perfil “${p.name}”?`, `Os ${p.appliedCount} tweaks deste perfil aplicados pelo app voltam ao estado anterior.`, { confirmLabel: 'Desfazer', danger: true }))) return;
    await runBatch(`Desfazendo perfil ${p.name}`, 'profiles:revert', p.id);
    list.reload();
  };
  const del = async (p) => {
    if (!(await confirm(`Excluir “${p.name}”?`, 'Os tweaks já aplicados continuam aplicados.', { confirmLabel: 'Excluir', danger: true }))) return;
    await call('profiles:delete', p.id);
    list.reload();
  };
  const importProfile = async () => {
    const res = await call('profiles:import');
    if (res?.ok) {
      toast(`Perfil “${res.profile.name}” importado${res.skipped ? ` (${res.skipped} tweak(s) desconhecido(s) ignorado(s))` : ''}.`, { tone: 'success' });
      list.reload();
    } else if (res && !res.canceled) toast(res.error, { tone: 'error' });
  };

  return (
    <Page title="Perfis">
      <Hero
        badge="Perfis"
        icon={Layers}
        title="Um clique para configurar o PC para o que você faz"
        actions={
          <>
            <button className="btn btn-primary" onClick={() => setEditing({})}><Plus /> Criar perfil</button>
            <button className="btn" onClick={importProfile}><Upload /> Importar</button>
          </>
        }
      >
        Perfis são conjuntos de tweaks. Tweaks que não se aplicam a este PC são pulados automaticamente, e desfazer um perfil só
        reverte o que ele aplicou.
      </Hero>
      <div className="grid grid-2">
        {profiles.map((p) => {
          const Icon = iconFor(p.icon);
          const pct = p.eligible.length ? (p.appliedCount / p.eligible.length) * 100 : 0;
          return (
            <Card key={p.id} className="hover">
              <div className="row" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
                <div className="card-icon" style={{ color: ACCENT[p.accent], background: 'var(--surface-2)' }}><Icon /></div>
                <div className="grow">
                  <div className="row" style={{ fontWeight: 600, fontSize: 15 }}>
                    {p.name}
                    {!p.builtin && <Badge>Personalizado</Badge>}
                    {active === p.id && <Badge tone="success" icon={CheckCircle2}>Último aplicado</Badge>}
                  </div>
                  <div className="small muted">{p.description}</div>
                </div>
              </div>
              <div className="row small" style={{ marginBottom: 6 }}>
                <span className="grow muted">{p.appliedCount} de {p.eligible.length} aplicados</span>
                <button className="btn btn-xs btn-ghost" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? 'Ocultar tweaks' : 'Ver tweaks'}</button>
              </div>
              <Meter value={pct} color={ACCENT[p.accent]} />
              {open === p.id && (
                <div className="stack" style={{ gap: 4, marginTop: 10, maxHeight: 220, overflowY: 'auto' }}>
                  {p.tweaks.map((id) => {
                    const t = tweakById.get(id);
                    return (
                      <div key={id} className="row tiny" style={{ opacity: p.eligible.includes(id) ? 1 : 0.45 }}>
                        <span className="grow">{t?.name || id}</span>
                        {!p.eligible.includes(id) && <span className="dim">{t?.hiddenReason || 'não se aplica'}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="row wrap" style={{ marginTop: 14 }}>
                <button className="btn btn-sm btn-primary" disabled={p.appliedCount === p.eligible.length} onClick={() => apply(p)}><Play /> Aplicar</button>
                <button className="btn btn-sm" disabled={!p.appliedCount} onClick={() => revert(p)}><Undo2 /> Desfazer</button>
                <div className="grow" />
                <button className="btn btn-sm btn-icon btn-ghost" title="Exportar" onClick={() => call('profiles:export', p.id)}><Download /></button>
                {!p.builtin && <button className="btn btn-sm btn-icon btn-ghost" title="Editar" onClick={() => setEditing(p)}><Pencil /></button>}
                {!p.builtin && <button className="btn btn-sm btn-icon btn-ghost" title="Excluir" onClick={() => del(p)}><Trash2 /></button>}
                {p.builtin && <button className="btn btn-sm btn-ghost" title="Criar uma cópia editável" onClick={() => setEditing({ name: `${p.name} (cópia)`, description: p.description, tweaks: p.tweaks })}>Duplicar</button>}
              </div>
            </Card>
          );
        })}
      </div>
      {!profiles.length && <Empty title="Nenhum perfil" />}
      {editing && <ProfileEditor initial={editing.id || editing.name ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
    </Page>
  );
}
