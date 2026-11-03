import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Eraser, Check, RotateCcw, ListOrdered, Activity } from 'lucide-react';
import { call } from '../lib/api.js';
import { Card, Switch, Badge, Stat, Callout, Loading, ActionButton, Empty } from '../components/ui.jsx';
import { when } from '../lib/format.js';

// Tabs of the Batuta page. Each keeps an editable copy of its slice of the config; the page remounts
// a tab (through `key`) when the saved config changes, so the copy never goes stale.
const TAB_LABEL = { rule: 'Regras', detected: 'Regras', denied: 'Aviso', contain: 'Contenção', release: 'Contenção', purge: 'Memória', plan: 'Núcleos', watchdog: 'Vigia', 'watchdog-release': 'Vigia' };

export const PRIORITY = [['default', 'Padrão do Windows'], ['high', 'Alta'], ['above', 'Acima do normal'], ['normal', 'Normal'], ['below', 'Abaixo do normal'], ['idle', 'Ociosa']];
const CORES = [['all', 'Todos'], ['p', 'Só P-cores'], ['e', 'Só E-cores']];
const IO = [['default', 'Padrão'], ['normal', 'Normal'], ['low', 'Baixa']];
export const GPU = [['default', 'Padrão'], ['high', 'Alta'], ['above', 'Acima do normal'], ['normal', 'Normal'], ['low', 'Baixa']];
export const EFFICIENCY = [['default', 'Windows decide'], ['never', 'Nunca'], ['always', 'Sempre']];

export const Select = ({ value, options, onChange, disabled, label }) => (
  <select className="select select-sm" value={value || options[0][0]} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={label}>
    {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </select>
);

export const NumberField = ({ label, value, onChange, unit, min = 0, max, step = 1, hint }) => (
  <label className="field">
    <span>{label}</span>
    <div className="row" style={{ gap: 6 }}>
      <input className="input" type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {unit && <span className="muted small">{unit}</span>}
    </div>
    {hint && <small className="dim">{hint}</small>}
  </label>
);

const EVENT_TEXT = {
  rule: (e) => `${e.name}: ${e.actions.join(', ')} aplicados`,
  denied: (e) => `${e.name}: o Windows ou o anti-cheat não deixou mudar o processo`,
  contain: (e) => `${e.name} contido (usava ${e.cpu}% da CPU em segundo plano)`,
  release: (e) => `${e.name} voltou ao normal`,
  purge: (e) => `Lista de espera limpa${e.manual ? ' manualmente' : ''}: ${e.before} → ${e.after} MB`,
  plan: (e) => (e.idle ? 'Parado: plano de economia' : 'Em uso: plano de desempenho'),
  detected: (e) => `${e.name} reconhecido como jogo${e.path ? ` (${e.path})` : ''}`,
  watchdog: (e) => `${e.name} passou do limite (${e.value}${e.metric === 'ram' ? ' MB' : '% da CPU'}): ${{ below: 'prioridade abaixo do normal', idle: 'prioridade ociosa', ecores: 'mandado para os E-cores', notify: 'só aviso' }[e.action]}`,
  'watchdog-release': (e) => `${e.name} se acalmou e voltou ao normal`,
};

export function RulesTab({ cfg, hybrid, save }) {
  const [rules, setRules] = useState(cfg.rules);
  const [exe, setExe] = useState('');
  const [procs, setProcs] = useState([]);
  useEffect(() => {
    call('batuta:processes').then((p) => setProcs(Array.isArray(p) ? p : []));
  }, []);
  const dirty = JSON.stringify(rules) !== JSON.stringify(cfg.rules);
  const patch = (i, k, v) => setRules((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const add = () => {
    const name = exe.trim();
    if (!name || rules.some((r) => r.exe.toLowerCase().replace(/\.exe$/, '') === name.toLowerCase().replace(/\.exe$/, ''))) return;
    setRules((rs) => [...rs, { exe: /\.exe$/i.test(name) ? name : `${name}.exe`, name: name.replace(/\.exe$/i, ''), priority: 'default', cores: 'all', io: 'default', gpu: 'default', efficiency: 'default', game: false }]);
    setExe('');
  };
  return (
    <Card
      title="Regras por programa"
      sub="Aplicadas sempre que o programa abrir e reaplicadas se ele mudar sozinho. Nada é injetado no processo."
      end={dirty && <ActionButton className="btn btn-sm btn-primary" icon={Check} onClick={() => save({ rules })}>Salvar regras</ActionButton>}
    >
      {!hybrid && <Callout tone="info">Seu processador não tem P-cores e E-cores, então a escolha de núcleos fica em "Todos".</Callout>}
      {rules.length ? (
        <div className="table-wrap">
          <table className="table batuta-rules">
            <thead>
              <tr><th>Programa</th><th>Prioridade</th><th>Núcleos</th><th>E/S</th><th>GPU</th><th>Eficiência</th><th title="Jogos ligam a limpeza de memória no modo só durante jogos">Jogo</th><th /></tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.exe}>
                  <td><strong>{r.name || r.exe}</strong><div className="tiny dim mono">{r.exe}</div></td>
                  <td><Select label={`Prioridade de ${r.exe}`} value={r.priority} options={PRIORITY} onChange={(v) => patch(i, 'priority', v)} /></td>
                  <td><Select label={`Núcleos de ${r.exe}`} value={hybrid ? r.cores : 'all'} options={CORES} disabled={!hybrid} onChange={(v) => patch(i, 'cores', v)} /></td>
                  <td><Select label={`E/S de ${r.exe}`} value={r.io} options={IO} onChange={(v) => patch(i, 'io', v)} /></td>
                  <td><Select label={`GPU de ${r.exe}`} value={r.gpu} options={GPU} onChange={(v) => patch(i, 'gpu', v)} /></td>
                  <td><Select label={`Modo de eficiência de ${r.exe}`} value={r.efficiency} options={EFFICIENCY} onChange={(v) => patch(i, 'efficiency', v)} /></td>
                  <td><Switch on={r.game} onChange={(v) => patch(i, 'game', v)} label={`${r.exe} é um jogo`} /></td>
                  <td className="num"><button className="icon-btn" onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remover regra de ${r.exe}`}><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon={ListOrdered} title="Nenhuma regra ainda">Use o assistente ou adicione um programa abaixo.</Empty>
      )}
      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <input className="input" list="batuta-procs" placeholder="programa.exe (ex.: cs2.exe)" value={exe} onChange={(e) => setExe(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ maxWidth: 320 }} aria-label="Programa para a nova regra" />
        <datalist id="batuta-procs">{procs.map((p) => <option key={p.exe} value={p.exe}>{p.title}</option>)}</datalist>
        <button className="btn btn-sm" onClick={add} disabled={!exe.trim()}><Plus /> Adicionar</button>
      </div>
    </Card>
  );
}

export function ContainmentTab({ cfg, save }) {
  const [c, setC] = useState(cfg.containment);
  const dirty = JSON.stringify(c) !== JSON.stringify(cfg.containment);
  const set = (k) => (v) => setC((x) => ({ ...x, [k]: v }));
  return (
    <Card
      title="Contenção de segundo plano"
      sub="Quando a CPU está carregada, programas em segundo plano que exageram descem para prioridade abaixo do normal por alguns segundos. O que está na tela, serviços do Windows e os programas com regra nunca são contidos."
      end={<Switch on={c.enabled} onChange={(v) => save({ containment: { ...c, enabled: v } })} label="Contenção ligada" />}
    >
      <div className="grid grid-3" style={{ gap: 14 }}>
        <NumberField label="Começa quando a CPU passa de" value={c.total} onChange={set('total')} unit="%" max={100} />
        <NumberField label="Contém quem usa mais de" value={c.proc} onChange={set('proc')} unit="% da CPU" max={100} />
        <NumberField label="Por pelo menos" value={c.overMs} onChange={set('overMs')} unit="ms" step={100} />
        <NumberField label="Solta quando cai abaixo de" value={c.restore} onChange={set('restore')} unit="%" max={100} />
        <NumberField label="Fica contido no mínimo" value={c.minMs} onChange={set('minMs')} unit="ms" step={100} />
      </div>
      <label className="field" style={{ marginTop: 14 }}>
        <span>Nunca conter (nomes separados por vírgula)</span>
        <input className="input" value={c.exclusions.join(', ')} onChange={(e) => set('exclusions')(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} placeholder="obs64, discord" />
      </label>
      {dirty && <ActionButton className="btn btn-sm btn-primary" style={{ marginTop: 14 }} icon={Check} onClick={() => save({ containment: c })}>Salvar contenção</ActionButton>}
    </Card>
  );
}

export function MemoryTab({ cfg, ramGb, status, save, toast }) {
  const [m, setM] = useState(cfg.memory);
  const dirty = JSON.stringify(m) !== JSON.stringify(cfg.memory);
  const set = (k) => (v) => setM((x) => ({ ...x, [k]: v }));
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <Card
        title="Limpeza da lista de espera"
        sub="O Windows guarda arquivos recentes na memória em espera. Em alguns jogos isso gera travadas quando a memória livre acaba; limpar a lista na hora certa evita."
        end={<Switch on={m.enabled} onChange={(v) => save({ memory: { ...m, enabled: v } })} label="Limpeza de memória ligada" />}
      >
        <div className="stack" style={{ gap: 14 }}>
          <NumberField label="Quando a lista de espera passar de" value={m.listMB} onChange={set('listMB')} unit="MB" step={256} />
          <NumberField label="E a memória livre estiver abaixo de" value={m.freeMB} onChange={set('freeMB')} unit="MB" step={256} hint={`Você tem ${ramGb} GB (${ramGb * 1024} MB).`} />
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <span className="grow">Só enquanto um jogo das regras estiver aberto</span>
          <Switch on={m.onlyGaming} onChange={set('onlyGaming')} label="Só durante jogos" />
        </div>
        <label className="field" style={{ marginTop: 14 }}>
          <span>Não limpar enquanto estes estiverem abertos</span>
          <input className="input" value={m.exclusions.join(', ')} onChange={(e) => set('exclusions')(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} placeholder="Premiere, AfterFX" />
        </label>
        {dirty && <ActionButton className="btn btn-sm btn-primary" style={{ marginTop: 14 }} icon={Check} onClick={() => save({ memory: m })}>Salvar memória</ActionButton>}
      </Card>
      <Card title="Agora" end={<ActionButton className="btn btn-sm" icon={Eraser} onClick={async () => {
        const r = await call('batuta:purge');
        if (r?.ok) toast(`Lista de espera limpa: ${r.before} → ${r.after} MB.`, { tone: 'success' });
        else toast(r?.error || 'Falha.', { tone: 'error' });
      }}>Limpar agora</ActionButton>}>
        <div className="grid grid-2">
          <Stat label="Lista de espera" value={status?.standby >= 0 ? status.standby : '—'} unit="MB" />
          <Stat label="Memória livre" value={status?.free >= 0 ? status.free : '—'} unit="MB" />
        </div>
        <p className="small muted" style={{ margin: '12px 0 0' }}>
          A resolução do timer em 0,5 ms, que o ISLC também oferece, fica no <Link to="/gaming/live">Modo ao vivo</Link> e na
          aba <Link to="/gaming/timer">Resolução do timer</Link>.
        </p>
      </Card>
    </div>
  );
}

export function CoresTab({ cfg, laptop, save, toast }) {
  const [park, setPark] = useState(null);
  const [plans, setPlans] = useState([]);
  const [b, setB] = useState(cfg.boost);
  useEffect(() => {
    call('batuta:parking').then(setPark);
    call('batuta:plans').then((p) => setPlans(Array.isArray(p) ? p : []));
  }, []);
  const apply = async (fn, v) => {
    const r = await call(fn, v);
    if (r?.ok) {
      setPark(r);
      toast('Núcleos atualizados.', { tone: 'success' });
    } else toast(r?.error || 'Falha.', { tone: 'error' });
  };
  const planOptions = [['', 'Desempenho (automático)'], ...plans.map((p) => [p.guid, p.name])];
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <Card title="Núcleos sempre ativos" sub="Quanto do processador o Windows mantém acordado no plano atual. 100% desliga o estacionamento de núcleos: o jogo nunca espera um núcleo acordar.">
        {!park ? <Loading /> : park.lockedBy ? (
          <Callout tone="info">O ajuste "Desativar estacionamento de núcleos" está aplicado e já mantém 100%. Para controlar aqui, desfaça-o em Ajustes › Desempenho › CPU.</Callout>
        ) : (
          <>
            {[['ac', 'Na tomada'], ...(laptop ? [['dc', 'Na bateria']] : [])].map(([k, label]) => (
              <label key={k} className="field" style={{ marginBottom: 12 }}>
                <span>{label}: <strong>{park[k]}%</strong></span>
                <input type="range" min="0" max="100" step="5" value={park[k] ?? 0} onChange={(e) => setPark((p) => ({ ...p, [k]: Number(e.target.value) }))} aria-label={`Núcleos ativos ${label.toLowerCase()}`} />
              </label>
            ))}
            <div className="row" style={{ gap: 8 }}>
              <ActionButton className="btn btn-sm btn-primary" icon={Check} onClick={() => apply('batuta:setParking', { ac: park.ac, dc: laptop ? park.dc : undefined })}>Aplicar</ActionButton>
              {park.backup && <ActionButton className="btn btn-sm btn-ghost" icon={RotateCcw} onClick={() => apply('batuta:restoreParking')}>Voltar ao original</ActionButton>}
            </div>
          </>
        )}
      </Card>
      <Card
        title="Plano por atividade"
        sub="Usa um plano enquanto você mexe no PC e outro quando ele fica parado. Durante uma sessão do Modo ao vivo, quem decide o plano é ele."
        end={<Switch on={b.enabled} onChange={(v) => save({ boost: { ...b, enabled: v } })} label="Plano por atividade ligado" />}
      >
        <label className="field"><span>Em uso</span><Select label="Plano em uso" value={b.activePlan || ''} options={planOptions} onChange={(v) => setB((x) => ({ ...x, activePlan: v || null }))} /></label>
        <label className="field" style={{ marginTop: 10 }}><span>Parado</span><Select label="Plano parado" value={b.idlePlan || ''} options={plans.length ? plans.map((p) => [p.guid, p.name]) : [['', '—']]} onChange={(v) => setB((x) => ({ ...x, idlePlan: v }))} /></label>
        <div style={{ marginTop: 10 }}><NumberField label="Considerar parado depois de" value={b.idleMin} onChange={(v) => setB((x) => ({ ...x, idleMin: v }))} unit="min" min={1} /></div>
        {JSON.stringify(b) !== JSON.stringify(cfg.boost) && <ActionButton className="btn btn-sm btn-primary" style={{ marginTop: 14 }} icon={Check} onClick={() => save({ boost: b })}>Salvar</ActionButton>}
      </Card>
    </div>
  );
}

export function ActivityTab({ events }) {
  if (!events.length) return <Empty icon={Activity} title="Nada por enquanto">O que o Core fizer aparece aqui: regras aplicadas, contenções, limpezas de memória e trocas de plano.</Empty>;
  return (
    <Card>
      <div>
        {events.map((e, i) => (
          <div key={`${e.at}-${i}`} className="batuta-event">
            <Badge tone={e.type === 'denied' ? 'warning' : ''}>{TAB_LABEL[e.type] || 'Aviso'}</Badge>
            <span className="grow">{(EVENT_TEXT[e.type] || (() => e.type))(e)}</span>
            <span className="dim small">{when(e.at)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
