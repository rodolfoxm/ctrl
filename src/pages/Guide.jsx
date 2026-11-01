import { Link } from 'react-router-dom';
import { ShieldCheck, Undo2, Zap, EyeOff, Radar, Keyboard, HelpCircle } from 'lucide-react';
import { Page, Hero } from '../components/Page.jsx';
import { Card } from '../components/ui.jsx';

const STEPS = [
  { title: 'Rode como administrador', body: 'A maioria dos tweaks mexe em configurações do sistema inteiro. O indicador no topo mostra se o app está elevado; se não estiver, use “Reabrir como administrador”.' },
  { title: 'Comece pela Visão geral', body: <>A <Link to="/">otimização recomendada</Link> aplica só os tweaks essenciais: seguros, reversíveis e com ganho claro. Um ponto de restauração é criado antes.</> },
  { title: 'Escolha um perfil ou ajuste módulo por módulo', body: <><Link to="/profiles">Perfis</Link> aplicam um conjunto pronto (Competitivo, Equilibrado, Privacidade…). Para controle fino, abra <Link to="/performance">Ajustes</Link> (Desempenho, Rede, Sistema e Hardware) ou <Link to="/gaming">Jogos</Link>.</> },
  { title: 'Reinicie quando pedido', body: 'Tweaks marcados “Requer reinício” só valem depois de reiniciar. Um botão aparece no topo quando há algo pendente.' },
  { title: 'Verifique de vez em quando', body: <>O Windows Update desfaz tweaks sem avisar. A <Link to="/guardian">Verificação</Link> mostra o que foi desfeito e reaplica com um clique. Ou deixe a Sentinela fazer isso sozinha.</> },
];

const FAQ = [
  { icon: Undo2, q: 'Como desfaço algo?', a: <>Desligue o interruptor do tweak, use “Desfazer” no módulo ou perfil, ou abra a <Link to="/history?tab=undo">Central de desfazer</Link> para reverter por período. O app salva o valor original antes de aplicar e restaura exatamente ele.</> },
  { icon: EyeOff, q: 'Por que alguns tweaks estão ocultos?', a: <>Eles não se aplicam ao seu hardware (ex.: tweaks AMD num PC NVIDIA, ou CPU sempre acordada num notebook). Veja o motivo em <Link to="/hardware/machine">Sua máquina</Link>.</> },
  { icon: ShieldCheck, q: 'O que significam “Seguro”, “Moderado” e “Avançado”?', a: 'Seguro: sem efeito colateral relevante. Moderado: desliga algo que algumas pessoas usam (ex.: impressão, indexação). Avançado: troca segurança ou consumo por desempenho — o app pede confirmação.' },
  { icon: Radar, q: 'O Modo Jogo ao Vivo é seguro com anti-cheat?', a: 'Sim. Ele só muda a prioridade do processo, o plano de energia e a resolução do timer — coisas que o próprio Windows expõe. Não injeta nada nem lê memória do jogo.' },
  { icon: Zap, q: 'Qual o ganho real?', a: 'Depende do PC. O maior ganho costuma vir de plano de energia, Game DVR desligado, MMCSS, aceleração do mouse e processos de fundo. Use o Monitor e a medição de DPC para comparar antes e depois.' },
  { icon: HelpCircle, q: 'O app envia algum dado?', a: 'Não. Não há conta nem telemetria. A rede só é usada nos testes que você pede (ping e benchmark de DNS) e, se a opção estiver ligada, para ver se saiu versão nova no GitHub.' },
];

export default function Guide() {
  return (
    <Page title="Guia">
      <Hero title="Como usar o ctrl com segurança">
        Tudo que o app faz é reversível e fica registrado. Cinco passos para começar e as respostas para as dúvidas mais comuns.
      </Hero>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card title="Primeiros passos" icon={Zap}>
          <div className="stack" style={{ gap: 16 }}>
            {STEPS.map((s, i) => (
              <div key={s.title} className="guide-step">
                <div className="guide-num">{i + 1}</div>
                <div><div style={{ fontWeight: 600 }}>{s.title}</div><div className="small muted">{s.body}</div></div>
              </div>
            ))}
          </div>
        </Card>
        <div className="stack" style={{ gap: 14 }}>
          {FAQ.map((f) => (
            <Card key={f.q} style={{ padding: 16 }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <f.icon size={17} style={{ color: 'var(--accent)', marginTop: 2 }} />
                <div><div style={{ fontWeight: 600 }}>{f.q}</div><div className="small muted">{f.a}</div></div>
              </div>
            </Card>
          ))}
          <Card style={{ padding: 16 }}>
            <div className="row"><Keyboard size={17} style={{ color: 'var(--accent)' }} /><div className="grow"><strong>Atalho:</strong> <kbd>Ctrl</kbd> + <kbd>K</kbd> abre a busca de páginas, tweaks e correções.</div></div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
