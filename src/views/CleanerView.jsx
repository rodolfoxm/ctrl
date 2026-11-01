import { useMemo, useState } from 'react';
import { Eraser, ScanSearch, Lock, AlertTriangle } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { bytes, ago } from '../lib/format.js';
import { Card, Badge, Empty, Loading, Stat, Checkbox } from '../components/ui.jsx';

export default function CleanerView() {
  const { info, toast, confirm } = useApp();
  const [scan, setScan] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const doScan = async () => {
    setScanning(true);
    const res = await call('cleaner:scan');
    setScanning(false);
    if (res?.ok === false) return toast(res.error, { tone: 'error' });
    setScan(res);
    setSelected(new Set(res.items.filter((i) => i.safe && i.bytes > 0 && !i.browserRunning && (info?.isAdmin || !i.admin)).map((i) => i.id)));
  };
  const total = useMemo(() => (scan?.items || []).filter((i) => selected.has(i.id)).reduce((a, i) => a + i.bytes, 0), [scan, selected]);

  const clean = async () => {
    const chosen = scan.items.filter((i) => selected.has(i.id));
    if (chosen.some((i) => !i.safe) && !(await confirm('Limpar itens sensíveis?', chosen.filter((i) => !i.safe).map((i) => `• ${i.name}: ${i.description}`).join('\n'), { confirmLabel: 'Limpar', danger: true }))) return;
    setCleaning(true);
    const res = await call('cleaner:clean', [...selected]);
    setCleaning(false);
    if (res?.ok) {
      toast(`${bytes(res.freed)} liberados.`, { tone: 'success' });
      doScan();
    } else toast(res?.error || 'Falha.', { tone: 'error' });
  };

  if (!scan && !scanning) {
    return (
      <Card>
        <Empty icon={Eraser} title="Limpeza de disco" action={<button className="btn btn-primary" onClick={doScan}><ScanSearch /> Analisar agora</button>}>
          Procura temporários, caches de atualização, shaders, despejos de falhas, caches de navegador e a Lixeira. Nada é apagado sem você escolher.
        </Empty>
      </Card>
    );
  }
  if (scanning && !scan) return <Loading label="Analisando o disco…" />;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <Card>
        <div className="row wrap">
          <Stat label="Encontrado" value={bytes(scan.items.reduce((a, i) => a + i.bytes, 0))} sub={`análise ${ago(scan.at)}`} />
          <div style={{ width: 30 }} />
          <Stat label="Selecionado" value={bytes(total)} color="var(--accent)" sub={`${selected.size} categoria(s)`} />
          <div className="grow" />
          <button className="btn" disabled={scanning} onClick={doScan}>{scanning ? <span className="spinner" /> : <ScanSearch />} Analisar de novo</button>
          <button className="btn btn-primary" disabled={!selected.size || cleaning} onClick={clean}>{cleaning ? <span className="spinner" /> : <Eraser />} Limpar {bytes(total)}</button>
        </div>
      </Card>
      <Card>
        <table className="table">
          <tbody>
            {scan.items.map((i) => {
              const blocked = i.admin && !info?.isAdmin;
              return (
                <tr key={i.id} style={{ opacity: i.bytes ? 1 : 0.5 }}>
                  <td style={{ width: 30 }}>
                    <Checkbox
                        checked={selected.has(i.id)}
                        onChange={(v) => setSelected((s) => { const n = new Set(s); v ? n.add(i.id) : n.delete(i.id); return n; })}
                        label={i.name}
                      />
                  </td>
                  <td>
                    <div className="row" style={{ fontWeight: 550 }}>
                      {i.name}
                      {i.admin && <Badge icon={Lock}>Admin</Badge>}
                      {!i.safe && <Badge tone="warning">Atenção</Badge>}
                      {i.browserRunning && <Badge tone="warning" icon={AlertTriangle}>Navegador aberto</Badge>}
                    </div>
                    <div className="small muted">{i.description}{blocked ? ' — sem admin, só parte dos arquivos pode ser apagada.' : ''}</div>
                  </td>
                  <td className="num dim small">{i.files ? `${i.files.toLocaleString('pt-BR')} arquivos` : ''}</td>
                  <td className="num" style={{ fontWeight: 600, minWidth: 90 }}>{bytes(i.bytes)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
