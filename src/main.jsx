import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import '@fontsource-variable/plus-jakarta-sans';
import './styles.css';
import { AppProvider, useApp } from './context.jsx';
import Shell from './components/Shell.jsx';
import Onboarding from './components/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Guide from './pages/Guide.jsx';
import Guardian from './pages/Guardian.jsx';
import AreaPage from './pages/AreaPage.jsx';
import Modules from './pages/Modules.jsx';
import Profiles from './pages/Profiles.jsx';
import History from './pages/History.jsx';
import About from './pages/About.jsx';
import Scheduler from './pages/Scheduler.jsx';
import Settings from './pages/Settings.jsx';

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <div className="callout danger">
          <div className="grow">
            <strong>Algo deu errado nesta tela.</strong>
            <div className="small mono selectable" style={{ marginTop: 6 }}>{String(this.state.error?.message || this.state.error)}</div>
            <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => this.setState({ error: null })}>Tentar de novo</button>
          </div>
        </div>
      </div>
    );
  }
}

function Root() {
  const { onboarded, settings } = useApp();
  return (
    <Shell>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/guardian" element={<Guardian />} />
          <Route path="/live-game" element={<Navigate to="/gaming/live" replace />} />
          <Route path="/history" element={<History />} />
          <Route path="/about" element={<About />} />
          <Route path="/:area" element={<AreaPage />} />
          <Route path="/:area/:sub" element={<AreaPage />} />
          <Route path="/modules" element={<Modules />} />
          <Route path="/profiles" element={<Profiles />} />
          <Route path="/backups" element={<Navigate to="/history?tab=backups" replace />} />
          <Route path="/scheduler" element={<Scheduler />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
      {settings && !onboarded && <Onboarding />}
    </Shell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <HashRouter>
        <Root />
      </HashRouter>
    </AppProvider>
  </React.StrictMode>,
);
