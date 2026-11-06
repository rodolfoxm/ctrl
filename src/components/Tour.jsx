import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { useApp } from '../context.jsx';

const STOPS = [
  { id: 'overview', path: '/', title: 'Visão geral', text: 'A saúde do sistema de 0 a 100, a otimização recomendada e o que seu PC está fazendo agora. Se o Windows desfizer algum ajuste, o aviso aparece aqui.' },
  { id: 'tweaks', path: '/performance', title: 'Ajustes', text: 'Os ajustes do ctrl, separados em Desempenho, Rede, Sistema e Hardware. Tudo tem backup: dá para ligar, testar e desligar. Aqui também estão a limpeza e a saúde dos discos.' },
  { id: 'profiles', path: '/profiles', title: 'Perfis', text: 'Conjuntos prontos de ajustes, como Competitivo, Privacidade e Notebook. O que não serve para o seu PC é pulado.' },
  { id: 'games', path: '/gaming', title: 'Jogos', text: 'Sua biblioteca de jogos, com ajustes por jogo. O Modo ao vivo sobe a prioridade só enquanto o jogo roda e volta tudo quando ele fecha.' },
  { id: 'core', path: '/core', title: 'Core', text: 'Rege o que roda no PC: quem tem prioridade, em quais núcleos e quanto de memória fica em espera. Use "Configurar para meus jogos" quando quiser mudar.' },
  { id: 'verify', path: '/guardian', title: 'Verificação', text: 'Confere se o Windows desfez algum ajuste e reaplica com um clique. A Sentinela faz isso sozinha a cada 30 minutos.' },
  { id: 'history', path: '/history', title: 'Histórico', text: 'Tudo que o ctrl fez fica aqui. Dá para desfazer um ajuste, a última hora ou tudo de uma vez, e usar os pontos de restauração.' },
  { id: 'settings', path: '/settings', title: 'Configurações', text: 'Cor do app, iniciar com o Windows, bandeja e atualizações. Fechar a janela deixa o ctrl rodando na bandeja.' },
  { id: 'scheduler', path: '/scheduler', title: 'Agendador', text: 'Tarefas automáticas, como verificar os ajustes toda vez que você entra no Windows.' },
  { id: 'guide', path: '/guide', title: 'Guia', text: 'Dúvidas comuns e este tutorial de novo, quando quiser. Para achar qualquer ajuste, aperte Ctrl+K em qualquer tela.' },
];

/** Walks through every part of the app, one sidebar item at a time. Doesn't block the screen. */
export default function Tour() {
  const { tour, setTour } = useApp();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const next = useRef(null);
  const stop = STOPS[index];
  const last = index === STOPS.length - 1;

  const end = () => {
    setTour(false);
    setIndex(0);
    navigate('/');
  };

  useEffect(() => {
    if (!tour) return undefined;
    navigate(stop.path);
    next.current?.focus();
    // An attribute, not a class: React rewrites the link's className when the route changes.
    const item = document.querySelector(`[data-tour="${stop.id}"]`);
    item?.setAttribute('data-tour-spot', '');
    return () => item?.removeAttribute('data-tour-spot');
  }, [tour, index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tour) return undefined;
    const onKey = (e) => e.key === 'Escape' && end();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tour) return null;
  return (
    <section className="tour" role="dialog" aria-labelledby="tour-title" aria-live="polite">
      <div className="tour-count">{index + 1} de {STOPS.length}</div>
      <h3 id="tour-title">{stop.title}</h3>
      <p>{stop.text}</p>
      <div className="tour-actions">
        {!last && <button className="btn btn-ghost" onClick={end}>Pular tutorial</button>}
        <button ref={next} className="btn btn-primary" onClick={() => (last ? end() : setIndex(index + 1))}>
          {last ? <>Concluir <Check /></> : <>Próximo <ArrowRight /></>}
        </button>
      </div>
    </section>
  );
}
