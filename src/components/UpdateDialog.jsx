import { useEffect, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { call, on } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { bytes } from '../lib/format.js';
import Markdown from './Markdown.jsx';

const date = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

/** New version: notes of it and the two before it, and an in-app install (download, check, run the installer). */
export default function UpdateDialog() {
  const { update, updateOpen, setUpdateOpen, toast } = useApp();
  const [progress, setProgress] = useState(null);
  useEffect(() => on('app:updateProgress', setProgress), []);
  if (!updateOpen || !update?.available) return null;
  const busy = !!progress;
  const pct = progress?.size ? Math.round((progress.got / progress.size) * 100) : 0;
  const install = async () => {
    setProgress({ got: 0, size: update.asset?.size || 0 });
    const res = await call('app:installUpdate');
    if (res?.ok === false) {
      setProgress(null);
      toast(res.error, { tone: 'error', duration: 9000 });
    }
  };
  return (
    <div className="backdrop" onClick={() => !busy && setUpdateOpen(false)}>
      <div className="modal update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="update-title">Nova versão {update.version}</h3>
        <p>Você está na {update.current}. Instalar por cima mantém seus ajustes, backups e configurações.</p>
        <div className="update-notes">
          {(update.releases || []).map((r) => (
            <section key={r.version}>
              <h4>
                {r.version} <span className="muted small">{date(r.date)}</span>
                {r.version === update.current && <span className="badge">a sua</span>}
                {r.version === update.version && <span className="badge success">nova</span>}
              </h4>
              <Markdown text={r.notes.split(/\n-{3,}\n/)[0]} />
            </section>
          ))}
          <button className="link-more" onClick={() => call('shell:open', 'https://github.com/rodolfoxm/ctrl/releases')}>
            Versões anteriores no GitHub <ExternalLink size={13} />
          </button>
        </div>
        {busy && (
          <div style={{ marginTop: 14 }}>
            <div className="meter"><div style={{ width: `${pct}%` }} /></div>
            <div className="small muted" style={{ marginTop: 6 }}>
              {progress.done ? 'Abrindo o instalador… o ctrl vai fechar.' : `Baixando ${bytes(progress.got)} de ${bytes(progress.size)}`}
            </div>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" disabled={busy} onClick={() => setUpdateOpen(false)}>Agora não</button>
          <button className="btn btn-primary" disabled={busy || !update.asset} onClick={install}><Download /> Instalar agora</button>
        </div>
      </div>
    </div>
  );
}
