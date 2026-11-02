import { Link, useSearchParams } from 'react-router-dom';
import { Settings as Cog, SlidersHorizontal, Database, Download, Upload, FolderOpen, RotateCcw, ShieldCheck, RefreshCw, Github } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { ago } from '../lib/format.js';
import { Page, Hero, SubNav } from '../components/Page.jsx';
import { Card, Switch, Logo, Callout, ActionButton } from '../components/ui.jsx';

const TABS = [
  { id: 'general', label: 'Geral', icon: SlidersHorizontal },
  { id: 'data', label: 'Dados', icon: Database },
  { id: 'updates', label: 'Atualizações', icon: RefreshCw },
];

function Row({ title, desc, children }) {
  return (
    <div className="row" style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div className="grow">
        <div style={{ fontWeight: 550 }}>{title}</div>
        {desc && <div className="small muted">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function General() {
  const { settings, updateSettings, info } = useApp();
  if (!settings) return null;
  const sw = (key, extra = {}) => <Switch on={!!settings[key]} onChange={(v) => updateSettings({ [key]: v })} label={key} {...extra} />;
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <Card title="Segurança" icon={ShieldCheck}>
        <Row title="Ponto de restauração automático" desc="Cria um ponto de restauração antes da primeira alteração de cada sessão.">{sw('autoRestorePoint')}</Row>
        <Row title="Confirmar tweaks avançados" desc="Pede confirmação antes de aplicar tweaks marcados como avançados ou com ressalvas.">{sw('confirmRisky')}</Row>
        <Row title="Mostrar tweaks ocultos" desc="Exibe nas listas os tweaks que não foram pensados para esta máquina.">{sw('showHidden')}</Row>
      </Card>
      <Card title="Comportamento" icon={Cog}>
        <Row title="Sentinela" desc="Verifica a cada 30 minutos se o Windows desfez algum tweak.">{sw('sentinel')}</Row>
        <Row title="Reparo automático" desc="Reaplica sozinho os tweaks que o Sentinela encontrar desfeitos.">{sw('sentinelRepair', { disabled: !settings.sentinel })}</Row>
        <Row title="Animação de abertura" desc="Mostra a animação do ctrl ao abrir o app. Um clique ou qualquer tecla pula.">{sw('intro')}</Row>
        <Row title="Manter na bandeja ao fechar" desc="Fechar a janela deixa o ctrl rodando ao lado do relógio, com o Sentinela e o Modo ao vivo ativos. Para sair, use Sair no ícone da bandeja.">{sw('closeToTray')}</Row>
        <Row title="Iniciar com o Windows" desc="Abre em segundo plano ao entrar (na bandeja, ou minimizado se a opção acima estiver desligada), para o Sentinela e o Modo ao vivo funcionarem sem abrir o app.">{sw('startWithWindows', { disabled: !info?.isAdmin })}</Row>
      </Card>
    </div>
  );
}

function Data() {
  const { toast, confirm, refreshState } = useApp();
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <Card title="Backup do estado" icon={Database}>
        <div className="small muted" style={{ marginBottom: 12 }}>Tweaks aplicados com seus valores originais, perfis personalizados, jogos e configurações.</div>
        <div className="row wrap">
          <button className="btn btn-sm" onClick={async () => { const r = await call('state:export'); if (r?.ok) toast(`Salvo em ${r.path}`, { tone: 'success' }); }}><Download /> Exportar</button>
          <button className="btn btn-sm" onClick={async () => {
            const r = await call('state:import');
            if (r?.ok) { toast('Estado importado.', { tone: 'success' }); refreshState(); } else if (r && !r.canceled) toast(r.error, { tone: 'error' });
          }}><Upload /> Importar</button>
          <button className="btn btn-sm btn-ghost" onClick={() => call('state:openFolder')}><FolderOpen /> Abrir pasta</button>
        </div>
      </Card>
      <Card title="Redefinir" icon={RotateCcw}>
        <Callout tone="warning">Redefine configurações, histórico, perfis e jogos. Os backups dos tweaks aplicados são mantidos, para que continuem podendo ser desfeitos.</Callout>
        <button className="btn btn-sm btn-danger" style={{ marginTop: 12 }} onClick={async () => {
          if (await confirm('Redefinir o app?', 'Configurações, histórico, perfis personalizados e biblioteca de jogos serão apagados.', { confirmLabel: 'Redefinir', danger: true })) {
            await call('state:reset');
            await refreshState();
            toast('App redefinido.', { tone: 'success' });
          }
        }}><RotateCcw /> Redefinir app</button>
      </Card>
    </div>
  );
}

function Updates() {
  const { info, catalog, settings, updateSettings, update, checkUpdate, toast } = useApp();
  const run = async () => {
    const res = await checkUpdate(true);
    if (res?.ok === false) toast(`Não foi possível verificar: ${res.error}`, { tone: 'error' });
    else if (!res?.available) toast('Você já está na versão mais recente.', { tone: 'success' });
  };
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <Card title="Atualizações" icon={RefreshCw}>
        <div className="row" style={{ gap: 16, marginBottom: 14 }}>
          <Logo size={52} />
          <div className="grow">
            <div style={{ fontSize: 17, fontWeight: 750 }}>ctrl {info?.version}</div>
            <div className="small muted">
              {update?.available ? `Versão ${update.version} disponível no GitHub.` : update?.checkedAt ? `Atualizado. Última verificação ${ago(update.checkedAt)}.` : 'Ainda não verificado.'}
            </div>
          </div>
        </div>
        {update?.available && (
          <Callout tone="accent" icon={Download}>
            Baixe o instalador novo e instale por cima: seus ajustes, backups e configurações são mantidos.
            <div style={{ marginTop: 10 }}><button className="btn btn-sm btn-accent" onClick={() => call('app:openRelease')}><Download /> Baixar {update.version}</button></div>
          </Callout>
        )}
        <Row title="Procurar atualizações ao abrir" desc="Consulta a página de versões do projeto no GitHub. Nenhum dado seu é enviado, e nada é baixado sem você pedir.">
          <Switch on={settings?.checkUpdates !== false} onChange={(v) => updateSettings({ checkUpdates: v })} label="Procurar atualizações" />
        </Row>
        <div className="row" style={{ marginTop: 14 }}>
          <ActionButton className="btn btn-sm" icon={RefreshCw} onClick={run}>Verificar agora</ActionButton>
          <button className="btn btn-sm btn-ghost" onClick={() => call('app:openRepo')}><Github /> Projeto no GitHub</button>
        </div>
      </Card>
      <Card title="Sobre esta instalação" icon={Database}>
        <dl className="kv">
          <dt>Versão</dt><dd>{info?.version} · Electron {info?.electron}</dd>
          <dt>Catálogo</dt><dd>{catalog?.tweaks.length} ajustes em {catalog?.modules.length} módulos, {catalog?.actions.length} correções, {catalog?.profiles.length} perfis</dd>
          <dt>Pasta de dados</dt><dd className="mono">{info?.dataPath}</dd>
          <dt>Privacidade</dt><dd>Sem conta, telemetria ou nuvem. A rede só é usada nos testes que você pede e, se ligado, para procurar atualizações.</dd>
        </dl>
        <Link to="/about" className="link-more" style={{ marginTop: 14 }}>Sobre o ctrl, licença e termos</Link>
      </Card>
    </div>
  );
}

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get('tab'))?.id || 'general';
  return (
    <Page title="Configurações">
      <Hero title="Configurações">Segurança, comportamento, dados e atualizações do ctrl.</Hero>
      <SubNav items={TABS} active={tab} onChange={(id) => setParams({ tab: id })} />
      {tab === 'general' && <General />}
      {tab === 'data' && <Data />}
      {tab === 'updates' && <Updates />}
    </Page>
  );
}
