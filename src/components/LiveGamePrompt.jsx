import { useEffect, useState } from 'react';
import { Radar } from 'lucide-react';
import { call, on } from '../lib/api.js';
import { useApp } from '../context.jsx';

/** "Game detected — boost it?" prompt for Live Game Mode in ask-first mode. */
export default function LiveGamePrompt() {
  const { toast } = useApp();
  const [ask, setAsk] = useState(null);
  useEffect(
    () =>
      on('livegame:event', (e) => {
        if (e.type === 'detected') setAsk(e);
        if (e.type === 'started') toast(`Modo Jogo ao Vivo ativo para ${e.session.name}.`, { tone: 'success' });
        if (e.type === 'ended') toast(`Sessão de ${e.record.game} encerrada — tudo foi restaurado.`, { tone: 'info' });
      }),
    [toast],
  );
  if (!ask) return null;
  const answer = (yes) => {
    call('livegame:confirm', ask.game.id, ask.pid, yes);
    setAsk(null);
  };
  return (
    <div className="backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="row" style={{ marginBottom: 10 }}>
          <div className="card-icon"><Radar /></div>
          <h3 style={{ margin: 0 }}>{ask.game.name} foi aberto</h3>
        </div>
        <p>
          Aplicar o impulso de sessão? Prioridade alta para o processo do jogo, plano de energia de alto desempenho e timer de 0,5 ms
          enquanto ele estiver aberto. Tudo volta ao normal quando o jogo fechar.
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => answer(false)}>Agora não</button>
          <button className="btn btn-primary" onClick={() => answer(true)} autoFocus>Aplicar impulso</button>
        </div>
      </div>
    </div>
  );
}
