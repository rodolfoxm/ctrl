import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Minus, Square, Copy, X, Search, ShieldCheck, ShieldAlert, PanelLeftClose, PanelLeftOpen, RotateCw, LogOut, Download } from 'lucide-react';
import { call, on, isMock } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { NAV, FOOTER_NAV } from '../nav.js';
import { Logo, Wordmark } from './ui.jsx';
import GlobalSearch from './GlobalSearch.jsx';
import LiveGamePrompt from './LiveGamePrompt.jsx';
import UpdateDialog from './UpdateDialog.jsx';

function TopBar({ onSearch }) {
  const { info, pendingRestart, setPendingRestart, update, setUpdateOpen } = useApp();
  const [maximized, setMaximized] = useState(false);
  useEffect(() => on('win:state', (s) => setMaximized(s.maximized)), []);
  return (
    <header className="topbar">
      <button className="search-trigger" onClick={onSearch}>
        <Search size={14} /> Buscar ajustes e telas… <kbd>Ctrl K</kbd>
      </button>
      {isMock && !location.search.includes('demo') && <span className="mode-note">Modo navegador (dados simulados)</span>}
      <div className="spacer" />
      {pendingRestart === 'reboot' && (
        <button className="btn btn-sm btn-primary pill" onClick={() => call('system:restart').then(() => setPendingRestart('none'))}>
          <RotateCw /> Reiniciar para concluir
        </button>
      )}
      {pendingRestart === 'logoff' && (
        <button className="btn btn-sm pill" onClick={() => call('system:logoff')}>
          <LogOut /> Sair e entrar para concluir
        </button>
      )}
      {update?.available && (
        <button className="btn btn-sm btn-accent pill update-pill" onClick={() => setUpdateOpen(true)} title="Ver novidades e instalar">
          <Download /> Nova versão {update.version}
        </button>
      )}
      {info && (
        <span className={`admin-pill pill ${info.isAdmin ? 'yes' : 'no'}`} title={info.isAdmin ? 'Rodando como administrador' : 'Sem privilégios de administrador'}>
          {info.isAdmin ? <ShieldCheck /> : <ShieldAlert />}
          {info.isAdmin ? 'Administrador' : (
            <button className="btn btn-xs btn-ghost" style={{ color: 'inherit', padding: 0 }} onClick={() => call('app:relaunchAdmin')}>
              Reabrir como administrador
            </button>
          )}
        </span>
      )}
      <div className="win-controls">
        <button onClick={() => call('win:minimize')} aria-label="Minimizar"><Minus size={15} /></button>
        <button onClick={() => call('win:toggleMaximize')} aria-label="Maximizar">{maximized ? <Copy size={13} /> : <Square size={13} />}</button>
        <button className="close" onClick={() => call('win:close')} aria-label="Fechar"><X size={16} /></button>
      </div>
    </header>
  );
}

function isActive(item, pathname) {
  if (item.path === '/') return pathname === '/';
  return (item.match || [item.path]).some((p) => pathname.startsWith(p));
}

function UpdateCard() {
  const { update, setUpdateOpen } = useApp();
  if (!update?.available) return null;
  return (
    <div className="update-card" role="status">
      <strong>Nova versão {update.version}</strong>
      <span className="muted">Instala por cima, mantendo seus ajustes e backups.</span>
      <button className="btn btn-xs btn-accent" onClick={() => setUpdateOpen(true)}><Download /> Ver e instalar</button>
    </div>
  );
}

function Sidebar({ collapsed, onToggle }) {
  const { pathname } = useLocation();
  const { applied } = useApp();
  const count = Object.keys(applied || {}).length;
  const link = (item, small) => {
    const Icon = item.icon;
    return (
      <NavLink key={item.id} to={item.path} data-tour={item.id} className={`nav-link ${small ? 'small' : ''} ${isActive(item, pathname) ? 'active' : ''}`} title={collapsed ? item.label : undefined}>
        <Icon />
        <span>{item.label}</span>
        {item.id === 'verify' && count > 0 && !collapsed && <span className="badge badge-dot">{count}</span>}
      </NavLink>
    );
  };
  return (
    <nav className="sidebar" aria-label="Navegação principal">
      <div className="sidebar-brand">{collapsed ? <Logo size={36} /> : <Wordmark />}</div>
      {NAV.map((g, i) => (
        <div className="nav-group" key={g.title || i}>
          {g.title && <div className="nav-group-title">{g.title}</div>}
          {g.items.map((item) => link(item))}
        </div>
      ))}
      <div className="sidebar-footer">
        <UpdateCard />
        {FOOTER_NAV.map((item) => link(item, true))}
        <button className="nav-link small collapse-btn" onClick={onToggle} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          <span>Recolher menu</span>
        </button>
      </div>
    </nav>
  );
}

/** Shown when settings and tweak backups don't persist: almost always an antivirus restricting the ctrl. */
function SaveBlockedBanner() {
  const { info } = useApp();
  if (!info?.saveBlocked) return null;
  const av = info.antivirus?.length ? info.antivirus.join(' e ') : 'Um antivírus';
  return (
    <div className="callout danger save-blocked" role="alert">
      <ShieldAlert />
      <div className="grow">
        <strong>{av} está impedindo o ctrl de salvar.</strong> Configurações, backups dos ajustes e o "Iniciar com o Windows" não ficam
        guardados. Adicione <span className="mono">{'C:\\Program Files\\ctrl\\ctrl.exe'}</span> aos aplicativos confiáveis {info.antivirus?.length ? 'dele' : 'do seu antivírus'}
        {/kaspersky/i.test(av) ? ' (Configurações › Ameaças e exclusões › Especificar aplicativos confiáveis, com tudo marcado)' : ''} e reabra o ctrl.
      </div>
    </div>
  );
}

export default function Shell({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('ctrl.sidebar') === '1';
    } catch {
      return false;
    }
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.querySelector('.main')?.scrollTo({ top: 0 });
  }, [pathname]);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem('ctrl.sidebar', c ? '0' : '1');
      } catch {}
      return !c;
    });

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="column">
        <TopBar onSearch={() => setSearchOpen(true)} />
        <main className="main">
          <SaveBlockedBanner />
          {children}
        </main>
      </div>
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} onNavigate={(p) => (setSearchOpen(false), navigate(p))} />}
      <LiveGamePrompt />
      <UpdateDialog />
    </div>
  );
}

export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ctrl` : 'ctrl';
  }, [title]);
}
