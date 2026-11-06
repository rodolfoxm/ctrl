import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Github, Scale, AlertTriangle, Heart, ExternalLink } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { Page } from '../components/Page.jsx';
import { Card, Wordmark } from '../components/ui.jsx';

const PILLARS = [
  {
    title: 'Nada muda sem backup',
    body: 'Antes de aplicar um ajuste, o ctrl guarda o valor original (registro, serviço, plano de energia). Desfazer devolve exatamente aquele valor, um ajuste por vez, por período ou tudo de uma vez.',
  },
  {
    title: 'Ele confere se o Windows desfez',
    body: 'Atualizações do Windows costumam reverter ajustes sem avisar. A Verificação relê cada alteração direto do sistema e reaplica com um clique. A Sentinela faz isso sozinha a cada 30 minutos.',
  },
  {
    title: 'Feito para a sua máquina',
    body: 'O ctrl detecta CPU, GPU, notebook ou desktop, Windows 10 ou 11, Wi-Fi e mais. Ajustes que não servem para o seu hardware ficam ocultos, com o motivo explicado.',
  },
  {
    title: 'Sem conta e sem telemetria',
    body: 'Nada sai do seu PC. A rede só é usada nos testes que você pede (ping, DNS) e, se a opção estiver ligada, para ver se saiu uma versão nova no GitHub.',
  },
];

const AREAS = [
  ['Desempenho', 'CPU, GPU, memória, armazenamento, tela e energia, com monitor ao vivo e medição de latência de drivers (DPC).'],
  ['Jogos', 'Biblioteca de jogos, Modo ao vivo (impulso só durante a partida), latência, input lag, timer, USB, áudio e prioridade.'],
  ['Rede', 'Teste de latência e jitter, benchmark e troca de DNS reversível, ajustes de TCP e da placa de rede.'],
  ['Sistema', 'Correções (SFC, DISM, rede, Windows Update), limpeza, privacidade, Windows 11, serviços, inicialização e apps embutidos.'],
  ['Hardware', 'Especificações, perfil detectado, saúde dos discos e da bateria e histórico do tempo de boot.'],
  ['Perfis', 'Conjuntos prontos (Competitivo, Equilibrado, Privacidade, Segurança reforçada, Notebook, PC modesto) ou os seus.'],
];

export default function About() {
  const { info, catalog } = useApp();
  const [params] = useSearchParams();
  // The global search links straight to a section (?s=apoiar).
  useEffect(() => {
    const id = params.get('s');
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'center' });
  }, [params]);
  return (
    <Page title="Sobre">
      <section className="about-hero">
        <h1 className="sr-only">Sobre o ctrl</h1>
        <Wordmark />
        <div>
          <p>Desempenho, controle e estabilidade para o seu Windows, sem medo de quebrar nada.</p>
          <div className="dim">
            Versão {info?.version || '—'} · {catalog ? `${catalog.tweaks.length} ajustes em ${catalog.modules.length} módulos, ${catalog.actions.length} correções e ${catalog.profiles.length} perfis` : 'carregando catálogo…'}
          </div>
        </div>
      </section>

      <div className="pillars">
        {PILLARS.map((p) => (
          <Card key={p.title} className="pillar">
            <h3>{p.title}</h3>
            <p>{p.body}</p>
          </Card>
        ))}
      </div>

      <div className="section-title"><h2>O que tem dentro</h2></div>
      <Card>
        <dl className="kv" style={{ gap: '12px 28px' }}>
          {AREAS.map(([k, v]) => (
            <span key={k} style={{ display: 'contents' }}>
              <dt style={{ color: 'var(--text-1)', fontWeight: 650 }}>{k}</dt>
              <dd className="muted">{v}</dd>
            </span>
          ))}
        </dl>
      </Card>

      <div className="grid grid-2" style={{ marginTop: 30, alignItems: 'start' }}>
        <Card title="Aviso de responsabilidade" icon={AlertTriangle}>
          <div className="legal">
            <p style={{ marginTop: 0 }}>
              O ctrl altera configurações do Windows (registro, serviços, energia, rede). Cada ajuste tem backup e pode ser desfeito, mas
              <strong> o software é fornecido “como está”, sem garantias de nenhum tipo</strong>.
            </p>
            <p style={{ marginBottom: 0 }}>
              O autor não se responsabiliza por danos ao computador, perda de dados, instabilidade ou qualquer outro prejuízo decorrente do
              uso. Você aceitou estes termos ao instalar. Crie um ponto de restauração antes de grandes mudanças (o ctrl faz isso por padrão).
            </p>
          </div>
        </Card>
        <Card title="Licença" icon={Scale}>
          <div className="legal">
            <p style={{ marginTop: 0 }}>
              Distribuído sob a <strong>PolyForm Noncommercial License 1.0.0</strong>. Uso pessoal, estudo, pesquisa e uso por organizações sem
              fins lucrativos são livres. Vender, revender ou usar comercialmente não é permitido sem autorização do autor.
            </p>
            <p style={{ marginBottom: 14 }}>Copyright © 2026 rodolfoxm. A avaliação de saúde dos discos segue as regras do CrystalDiskInfo (licença MIT).</p>
          </div>
          <div className="row wrap">
            <button className="btn btn-sm" onClick={() => call('app:openRepo')}><Github /> Código no GitHub</button>
            <Link className="btn btn-sm btn-ghost" to="/guide">Guia de uso</Link>
          </div>
        </Card>
      </div>

      <Card id="apoiar" title="Apoiar o desenvolvimento" icon={Heart} style={{ marginTop: 14 }}>
        <div className="row wrap" style={{ alignItems: 'center', gap: 16 }}>
          <p className="grow muted" style={{ margin: 0, minWidth: 260 }}>
            O ctrl é gratuito e continua assim. Se ele te ajudou, dá para apoiar com qualquer valor, uma vez só, pelo site do mojo. É
            opcional e não muda nada no app.
          </p>
          <button className="btn btn-sm" onClick={() => call('app:openSupport')}><ExternalLink /> Apoiar no site</button>
        </div>
      </Card>
    </Page>
  );
}
