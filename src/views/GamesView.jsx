import { useEffect, useState } from 'react';
import { Gamepad2, ScanSearch, Plus, Play, Trash2, Radar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { Card, Switch, Badge, Empty, Loading, useAsync, ActionButton } from '../components/ui.jsx';

function GameRow({ game, options, onRemove }) {
  const { toast, info } = useApp();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    call('games:status', game.id).then(setState);
  }, [game.id]);
  const set = async (key, enabled) => {
    setBusy(key);
    const res = await call('games:set', game.id, key, enabled);
    setBusy(null);
    if (res?.ok) setState((s) => ({ ...s, [key]: enabled }));
    else toast(res?.error || 'Falha.', { tone: 'error' });
  };
  return (
    <Card className="hover">
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="card-icon"><Gamepad2 /></div>
        <div className="grow">
          <div style={{ fontWeight: 600 }}>{game.name}</div>
          <div className="tiny dim ellipsis mono" title={game.exe}>{game.exe}</div>
        </div>
        <Badge>{game.source}</Badge>
        <button className="btn btn-sm btn-icon btn-ghost" title="Iniciar" onClick={() => call('games:launch', game.id)}><Play /></button>
        <button className="btn btn-sm btn-icon btn-ghost" title="Remover da lista" onClick={() => onRemove(game.id)}><Trash2 /></button>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {options.map((o) => (
          <div key={o.key} className="row">
            <div className="grow">
              <div className="small" style={{ fontWeight: 550 }}>{o.label}</div>
              <div className="tiny dim">{o.description}</div>
            </div>
            <Switch
              on={!!state?.[o.key]}
              busy={busy === o.key || state == null}
              disabled={o.key === 'priority' && !info?.isAdmin}
              onChange={(v) => set(o.key, v)}
              label={`${o.label} — ${game.name}`}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function GamesView() {
  const { settings, toast } = useApp();
  const lib = useAsync(() => call('games:list'), []);
  if (lib.loading && !lib.data) return <Loading />;
  const { games = [], options = [] } = lib.data || {};
  const scan = async () => {
    const list = await call('games:scan');
    lib.setData({ ...lib.data, games: list });
    toast(`${list.length} jogo(s) na biblioteca.`, { tone: 'success' });
  };
  const add = async () => lib.setData({ ...lib.data, games: await call('games:add') });
  const remove = async (id) => lib.setData({ ...lib.data, games: await call('games:remove', id) });

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row wrap">
        <div className="grow">
          <h2 style={{ margin: 0, fontSize: 17 }}>Biblioteca de jogos</h2>
          <div className="muted small">Ajustes por executável que valem só para aquele jogo. Os jogos daqui também são os que o Modo Jogo ao Vivo detecta.</div>
        </div>
        <ActionButton className="btn btn-sm" icon={ScanSearch} onClick={scan}>Procurar Steam e Epic</ActionButton>
        <button className="btn btn-sm btn-primary" onClick={add}><Plus /> Adicionar executável</button>
      </div>
      {!settings?.liveGameMode && games.length > 0 && (
        <div className="callout accent">
          <Radar />
          <div className="grow">Ative o <Link to="/gaming/live">Modo Jogo ao Vivo</Link> para aplicar um impulso temporário automaticamente quando um destes jogos abrir.</div>
        </div>
      )}
      {games.length ? (
        <div className="grid grid-2">
          {games.map((g) => <GameRow key={g.id} game={g} options={options} onRemove={remove} />)}
        </div>
      ) : (
        <Empty icon={Gamepad2} title="Nenhum jogo ainda" action={<ActionButton className="btn btn-primary" icon={ScanSearch} onClick={scan}>Procurar jogos instalados</ActionButton>}>
          Procure jogos da Steam e da Epic Games ou adicione o executável de qualquer jogo manualmente.
        </Empty>
      )}
    </div>
  );
}
