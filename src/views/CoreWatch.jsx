import { useState } from 'react';
import { Plus, Trash2, Check, ScanSearch, Eye } from 'lucide-react';
import { Card, Switch, Badge, ActionButton, Empty } from '../components/ui.jsx';
import { Select, NumberField, PRIORITY, GPU, EFFICIENCY } from './BatutaTabs.jsx';

const ACTIONS = [['below', 'Baixar a prioridade'], ['idle', 'Prioridade ociosa'], ['ecores', 'Mandar para os E-cores'], ['notify', 'Só avisar']];
const METRICS = [['cpu', 'CPU'], ['ram', 'Memória']];

/** Games recognised without a rule: by folder (Steam, Epic, Xbox…), by the ctrl library or by the assistant's list. */
export function AutoDetectCard({ cfg, status, save }) {
  const [a, setA] = useState(cfg.autoDetect);
  const detected = (status?.managed || []).filter((m) => m.auto);
  const known = new Set(cfg.rules.map((r) => r.exe.toLowerCase().replace(/\.exe$/, '')));
  const toRule = (name) => save({ rules: [...cfg.rules, { exe: `${name}.exe`, name, game: true, priority: a.priority, cores: 'all', io: 'normal', gpu: a.gpu, efficiency: a.efficiency }] });
  return (
    <Card
      title="Jogos detectados automaticamente"
      sub="Tudo que roda das pastas de jogos da Steam, Epic, Xbox, EA, Ubisoft, Riot e Battle.net, da sua biblioteca do ctrl ou da lista do assistente ganha esta regra, sem cadastrar nada. Launchers, anti-cheats e relatórios de erro ficam de fora."
      icon={ScanSearch}
      end={<Switch on={a.enabled} onChange={(v) => save({ autoDetect: { ...a, enabled: v } })} label="Detecção automática ligada" />}
      style={{ marginBottom: 14 }}
    >
      <div className="row wrap" style={{ gap: 14 }}>
        <label className="field"><span>Prioridade</span><Select label="Prioridade dos jogos detectados" value={a.priority} options={PRIORITY} onChange={(v) => setA((x) => ({ ...x, priority: v }))} /></label>
        <label className="field"><span>GPU</span><Select label="GPU dos jogos detectados" value={a.gpu} options={GPU} onChange={(v) => setA((x) => ({ ...x, gpu: v }))} /></label>
        <label className="field"><span>Modo de eficiência</span><Select label="Eficiência dos jogos detectados" value={a.efficiency} options={EFFICIENCY} onChange={(v) => setA((x) => ({ ...x, efficiency: v }))} /></label>
        {JSON.stringify(a) !== JSON.stringify(cfg.autoDetect) && <ActionButton className="btn btn-sm btn-primary" icon={Check} onClick={() => save({ autoDetect: a })}>Salvar</ActionButton>}
      </div>
      {detected.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="small muted" style={{ marginBottom: 6 }}>Abertos agora</div>
          {detected.map((d) => (
            <div key={d.pid} className="row" style={{ padding: '6px 0', gap: 10 }}>
              <Badge tone="success">detectado</Badge>
              <span className="grow mono">{d.name}.exe</span>
              {!known.has(d.name.toLowerCase()) && <button className="btn btn-sm btn-ghost" onClick={() => toRule(d.name)}><Plus /> Criar regra própria</button>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Watchdog: a program above a CPU or memory limit for N seconds gets one reversible action, undone when it calms down. */
export function WatchdogTab({ cfg, hybrid, save }) {
  const [rules, setRules] = useState(cfg.watchdog);
  const [exe, setExe] = useState('');
  const dirty = JSON.stringify(rules) !== JSON.stringify(cfg.watchdog);
  const patch = (i, k, v) => setRules((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const add = () => {
    const name = exe.trim();
    if (!name) return;
    setRules((rs) => [...rs, { exe: /\.exe$/i.test(name) ? name : `${name}.exe`, metric: 'cpu', threshold: 25, seconds: 10, action: 'below' }]);
    setExe('');
  };
  return (
    <Card
      title="Vigia"
      sub="Fica de olho em programas específicos. Se um deles passar do limite de CPU ou de memória por um tempo, recebe uma ação reversível, desfeita sozinha quando ele se acalma. O Vigia nunca fecha programas."
      icon={Eye}
      end={dirty && <ActionButton className="btn btn-sm btn-primary" icon={Check} onClick={() => save({ watchdog: rules })}>Salvar Vigia</ActionButton>}
    >
      {rules.length ? (
        <div className="table-wrap">
          <table className="table batuta-rules">
            <thead><tr><th>Programa</th><th>Quando</th><th>Passar de</th><th>Por</th><th>Ação</th><th /></tr></thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={`${r.exe}-${i}`}>
                  <td className="mono">{r.exe}</td>
                  <td><Select label={`Medida de ${r.exe}`} value={r.metric} options={METRICS} onChange={(v) => patch(i, 'metric', v)} /></td>
                  <td><NumberField label="" value={r.threshold} onChange={(v) => patch(i, 'threshold', v)} unit={r.metric === 'ram' ? 'MB' : '%'} min={1} /></td>
                  <td><NumberField label="" value={r.seconds} onChange={(v) => patch(i, 'seconds', v)} unit="s" min={1} /></td>
                  <td><Select label={`Ação para ${r.exe}`} value={r.action} options={hybrid ? ACTIONS : ACTIONS.filter(([v]) => v !== 'ecores')} onChange={(v) => patch(i, 'action', v)} /></td>
                  <td className="num"><button className="icon-btn" onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remover vigia de ${r.exe}`}><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon={Eye} title="Ninguém sob vigia">Bom para o launcher que dispara do nada, o antivírus que pesa no meio da partida ou um programa que vaza memória.</Empty>
      )}
      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <input className="input" placeholder="programa.exe" value={exe} onChange={(e) => setExe(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ maxWidth: 320 }} aria-label="Programa para vigiar" />
        <button className="btn btn-sm" onClick={add} disabled={!exe.trim()}><Plus /> Vigiar</button>
      </div>
    </Card>
  );
}
