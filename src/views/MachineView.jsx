import { ScanSearch, EyeOff, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { modulePath } from '../nav.js';
import { Card, Badge, Loading, useAsync } from '../components/ui.jsx';

function Fact({ label, value, note }) {
  return (
    <div className="row" style={{ padding: '9px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
      <span className="dim" style={{ width: 190, flexShrink: 0 }}>{label}</span>
      <div className="grow">
        <div>{value}</div>
        {note && <div className="tiny dim">{note}</div>}
      </div>
    </div>
  );
}

export default function MachineView() {
  const { catalog } = useApp();
  const m = useAsync(() => call('machine:get', true), []);
  if (m.loading && !m.data) return <Loading label="Detectando o perfil da máquina…" />;
  const d = m.data;
  const hidden = (catalog?.tweaks || []).filter((t) => t.hiddenReason);
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <Card title="O que o app detectou" sub="Esse perfil decide quais tweaks aparecem no catálogo." icon={ScanSearch}>
        <Fact label="Windows" value={`${d.osName} (build ${d.build})`} note={d.win11 ? 'Tweaks do Windows 11 liberados.' : 'Tweaks exclusivos do Windows 11 ficam ocultos.'} />
        <Fact label="Formato" value={d.laptop ? 'Notebook / portátil' : 'Desktop'} note={d.laptop ? 'Tweaks que mantêm a CPU sempre acordada ficam ocultos para poupar bateria e temperatura.' : 'Todos os tweaks de energia liberados.'} />
        <Fact label="Processador" value={d.cpuName} note={`${d.cores} núcleos / ${d.threads} threads · fabricante ${d.cpuVendor.toUpperCase()}${d.hybrid ? ' · híbrida (P-cores + E-cores): tweak de preferência por P-cores liberado' : ''}`} />
        <Fact label="Antivírus" value={d.defender ? 'Microsoft Defender ativo' : 'Defender inativo ou outro antivírus'} note={d.defender ? 'Ajustes do Defender e regras ASR liberados.' : 'Ajustes do Defender ficam ocultos — eles não teriam efeito.'} />
        <Fact label="Placa(s) de vídeo" value={d.gpus.map((g) => g.name).join(' + ') || '—'} note={`Tweaks por fabricante: ${d.gpuVendors.map((v) => v.toUpperCase()).join(', ') || 'nenhum'}`} />
        <Fact label="Taxa de atualização" value={d.refresh ? `${d.refresh} Hz` : '—'} />
        <Fact label="Memória" value={`${d.ramGb} GB`} note={d.ramGb >= 16 ? 'Tweaks de memória que pedem 16 GB+ liberados.' : 'Tweaks que reduzem uso de paginação ficam ocultos (menos de 16 GB).'} />
        <Fact label="Rede" value={[d.ethernet && 'Ethernet', d.wifi && 'Wi-Fi'].filter(Boolean).join(' + ') || '—'} note={d.activeLink ? `Conectado por ${d.activeLink.desc} (${d.activeLink.speed})` : ''} />
        <Fact label="Armazenamento" value={d.disks.map((k) => `${k.name} (${k.media}/${k.bus})`).join(', ') || '—'} note={d.ssd ? 'SSD detectado.' : 'Nenhum SSD detectado.'} />
      </Card>
      <Card title="Tweaks ocultos nesta máquina" sub="Você pode exibi-los na lista de cada módulo (botão “ocultos”), mas eles não foram pensados para este PC." icon={EyeOff} end={<Badge>{hidden.length}</Badge>}>
        {hidden.length ? (
          <div className="stack" style={{ gap: 6 }}>
            {hidden.map((t) => (
              <Link key={t.id} to={`${modulePath(t.module)}?tweak=${t.id}`} className="row" style={{ color: 'inherit', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="grow">{t.name}</span>
                <Badge tone="danger">{t.hiddenReason}</Badge>
              </Link>
            ))}
          </div>
        ) : (
          <div className="row muted"><CheckCircle2 size={16} style={{ color: 'var(--success)' }} /> Todo o catálogo se aplica a esta máquina.</div>
        )}
      </Card>
    </div>
  );
}
