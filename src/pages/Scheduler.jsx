import { CalendarClock, Plus, Trash2, Play, Clock, ShieldAlert } from 'lucide-react';
import { call } from '../lib/api.js';
import { useApp } from '../context.jsx';
import { date, ago } from '../lib/format.js';
import { Page, Hero } from '../components/Page.jsx';
import { Card, Badge, Loading, useAsync, ActionButton, Callout } from '../components/ui.jsx';

const TRIGGER = { daily: 'Todo dia', weekly: 'Todo domingo', 'weekly-monday': 'Toda segunda', logon: 'Ao entrar no Windows' };

export default function Scheduler() {
  const { info, toast } = useApp();
  const list = useAsync(() => call('sched:list'), []);
  const act = async (channel, id, msg) => {
    const res = await call(channel, id);
    if (res?.ok) toast(msg, { tone: 'success' }); else toast(res?.error || 'Falha.', { tone: 'error' });
    list.reload();
  };
  return (
    <Page title="Agendador">
      <Hero badge="Agendador" icon={CalendarClock} title="Manutenção que acontece sozinha">
        Tarefas do Agendador de Tarefas do Windows (pasta “ctrl”). Elas rodam mesmo com o app fechado e podem ser removidas
        aqui ou no próprio Windows.
      </Hero>
      {!info?.isAdmin && <Callout tone="warning" icon={ShieldAlert}>Criar tarefas com privilégios elevados exige abrir o app como administrador.</Callout>}
      {list.loading && !list.data ? <Loading /> : (
        <div className="grid grid-2" style={{ marginTop: 14 }}>
          {(list.data || []).map((t) => (
            <Card key={t.id} className="hover">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div className="card-icon"><Clock /></div>
                <div className="grow">
                  <div className="row" style={{ fontWeight: 600 }}>
                    {t.name}
                    {t.installed ? <Badge tone="success">Agendada</Badge> : <Badge>Inativa</Badge>}
                  </div>
                  <div className="small muted">{t.description}</div>
                  <div className="tiny dim" style={{ marginTop: 6 }}>
                    {TRIGGER[t.trigger]}{t.at ? ` às ${t.at}` : ''}
                    {t.installed && t.next ? ` · próxima ${date(t.next)}` : ''}
                    {t.installed && t.last ? ` · última ${ago(t.last)}${t.result ? ` (código ${t.result})` : ''}` : ''}
                  </div>
                </div>
              </div>
              <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
                {t.installed ? (
                  <>
                    <ActionButton className="btn btn-sm btn-ghost" icon={Play} onClick={() => act('sched:run', t.id, 'Tarefa iniciada.')}>Executar agora</ActionButton>
                    <ActionButton className="btn btn-sm" icon={Trash2} onClick={() => act('sched:remove', t.id, 'Tarefa removida.')}>Remover</ActionButton>
                  </>
                ) : (
                  <ActionButton className="btn btn-sm btn-primary" icon={Plus} disabled={!info?.isAdmin} onClick={() => act('sched:create', t.id, 'Tarefa agendada.')}>Agendar</ActionButton>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
