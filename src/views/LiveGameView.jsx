import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Radar, Gamepad2, Zap, Clock, Cpu, StopCircle, History, ShieldCheck } from 'lucide-react';
import { call, on } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { date, duration } from '../lib/format.js';
import { Card, Switch, Badge, Empty, Loading, useAsync, Callout } from '../components/ui.jsx';

/** Jogos › Modo ao vivo: a temporary boost applied only while a library game runs. */
export default function LiveGameView() {
  const { settings, updateSettings, info } = useApp();
  const st = useAsync(() => call('livegame:status'), []);
  const lib = useAsync(() => call('games:list'), []);
  useEffect(() => on('livegame:event', () => st.reload()), []); // eslint-disable-line react-hooks/exhaustive-deps

  const setEnabled = async (v) => {
    await updateSettings({ liveGameMode: v });
    st.setData(await call('livegame:setEnabled', v));
  };
  const d = st.data;
  const games = lib.data?.games || [];
  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 16 }}>
          <div className="grow">
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 750 }}>Impulso automático só enquanto você joga</h3>
            <div className="muted small">
              Quando um jogo da sua biblioteca abre, o ctrl aplica um impulso temporário. Quando ele fecha, tudo volta exatamente como estava.
              Sem injeção e sem leitura de memória: compatível com anti-cheat.
            </div>
          </div>
          <span className="muted small">{settings?.liveGameMode ? 'Ativo' : 'Desligado'}</span>
          <Switch on={settings?.liveGameMode} onChange={setEnabled} label="Modo Jogo ao Vivo" />
        </div>
      </Card>

      {!info?.isAdmin && <Callout tone="warning" icon={ShieldCheck}>Sem administrador, a prioridade do processo e o plano de energia podem não ser alterados.</Callout>}

      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <Card title="O que é aplicado durante a sessão" icon={Zap}>
          <div className="stack">
            <div className="row"><Cpu size={16} className="dim" /><div className="grow"><div>Prioridade Alta para o processo do jogo</div><div className="tiny dim">Sempre aplicado.</div></div><Badge tone="success">sempre</Badge></div>
            <div className="row"><Zap size={16} className="dim" /><div className="grow"><div>Plano de energia de alto desempenho</div><div className="tiny dim">Volta ao plano anterior quando o jogo fecha.</div></div><Switch on={settings?.liveGamePlan} onChange={(v) => updateSettings({ liveGamePlan: v })} label="Plano de energia" /></div>
            <div className="row"><Clock size={16} className="dim" /><div className="grow"><div>Timer do sistema em 0,5 ms</div><div className="tiny dim">Liberado ao fim da sessão.</div></div><Switch on={settings?.liveGameTimer} onChange={(v) => updateSettings({ liveGameTimer: v })} label="Timer" /></div>
            <div className="row" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}><div className="grow"><div>Perguntar antes de aplicar</div><div className="tiny dim">Mostra um aviso quando o jogo abre, em vez de aplicar direto.</div></div><Switch on={settings?.liveGameModeAsk} onChange={(v) => updateSettings({ liveGameModeAsk: v })} label="Perguntar antes" /></div>
          </div>
        </Card>
        <Card title="Sessão atual" icon={Radar}>
          {st.loading && !d ? <Loading /> : d?.session ? (
            <div className="stack">
              <div className="row"><span className="dot success" /><strong className="grow">{d.session.name}</strong><span className="small muted">desde {date(d.session.start, { timeStyle: 'short' })}</span></div>
              {d.session.applied.map((a) => <div key={a} className="small muted">• {a}</div>)}
              <button className="btn btn-sm" onClick={async () => st.setData(await call('livegame:end'))}><StopCircle /> Encerrar e restaurar agora</button>
            </div>
          ) : (
            <Empty icon={Gamepad2} title={settings?.liveGameMode ? 'Aguardando um jogo…' : 'Modo desligado'}>
              {games.length ? `Monitorando ${games.length} jogo(s) da sua biblioteca a cada 5 segundos.` : <>Sua biblioteca está vazia — adicione jogos em <Link to="/gaming/games">Jogos › Biblioteca</Link>.</>}
            </Empty>
          )}
        </Card>
      </div>

      <div className="section-title"><History size={16} className="dim" /><h2>Sessões anteriores</h2></div>
      <Card>
        {d?.sessions?.length ? (
          <table className="table">
            <thead><tr><th>Jogo</th><th>Início</th><th>Duração</th><th>Aplicado</th></tr></thead>
            <tbody>
              {d.sessions.map((s) => (
                <tr key={s.start}>
                  <td>{s.game}</td>
                  <td className="dim small">{date(s.start)}</td>
                  <td>{duration((new Date(s.end) - new Date(s.start)) / 1000)}</td>
                  <td className="small muted">{s.actions.join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="dim small">Nenhuma sessão registrada ainda.</div>}
      </Card>
    </>
  );
}
