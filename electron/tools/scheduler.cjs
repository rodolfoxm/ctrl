// Scheduler: Windows scheduled tasks under "\ctrl\" that run the app in
// headless mode (--task=...) or a plain PowerShell command.
const { runJson, runPowerShell, q } = require('../ps.cjs');
const store = require('../store.cjs');

const FOLDER = '\\ctrl\\';

const TEMPLATES = [
  { id: 'clean-daily', name: 'Limpeza diária', description: 'Limpa temporários, caches do Windows Update e miniaturas todos os dias às 12h.', trigger: 'daily', at: '12:00', task: 'clean' },
  { id: 'clean-weekly', name: 'Limpeza semanal', description: 'Mesma limpeza segura, todo domingo às 12h.', trigger: 'weekly', at: '12:00', task: 'clean' },
  { id: 'verify-logon', name: 'Verificar tweaks ao entrar', description: 'Ao fazer logon, confere se os tweaks aplicados continuam ativos e reaplica os que o Windows desfez.', trigger: 'logon', task: 'repair' },
  { id: 'restore-weekly', name: 'Ponto de restauração semanal', description: 'Cria um ponto de restauração do sistema toda segunda-feira às 10h.', trigger: 'weekly-monday', at: '10:00', task: 'restore-point' },
  // Used by Settings > "Iniciar com o Windows": an elevated app can't use a normal login item.
  { id: 'app-logon', name: 'Iniciar com o Windows', description: 'Abre o ctrl minimizado ao fazer logon.', trigger: 'logon', task: 'open', hidden: true },
];

function appCommand() {
  const { app } = require('electron');
  const args = app.isPackaged ? [] : [app.getAppPath()];
  return { exe: process.execPath, args };
}

function triggerExpr(t) {
  if (t.trigger === 'daily') return `New-ScheduledTaskTrigger -Daily -At ${q(t.at)}`;
  if (t.trigger === 'weekly') return `New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At ${q(t.at)}`;
  if (t.trigger === 'weekly-monday') return `New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At ${q(t.at)}`;
  return 'New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME';
}

function actionExpr(t) {
  if (t.task === 'restore-point') {
    const cmd = "Checkpoint-Computer -Description 'ctrl - semanal' -RestorePointType MODIFY_SETTINGS";
    return `New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ${q(`-NoProfile -WindowStyle Hidden -Command "${cmd}"`)}`;
  }
  const { exe, args } = appCommand();
  const argStr = [...args.map((a) => `"${a}"`), t.task === 'open' ? '--minimized' : `--task=${t.task}`].join(' ');
  return `New-ScheduledTaskAction -Execute ${q(exe)} -Argument ${q(argStr)}`;
}

async function list() {
  const rows = await runJson(`
ConvertTo-Json -Compress -InputObject @(Get-ScheduledTask -TaskPath ${q(FOLDER)} -ErrorAction SilentlyContinue | ForEach-Object {
  $i = $_ | Get-ScheduledTaskInfo -ErrorAction SilentlyContinue
  [pscustomobject]@{ id = $_.TaskName; state = [string]$_.State; next = if ($i.NextRunTime) { $i.NextRunTime.ToString('o') } else { $null }; last = if ($i.LastRunTime -and $i.LastRunTime.Year -gt 2000) { $i.LastRunTime.ToString('o') } else { $null }; result = $i.LastTaskResult }
})`);
  const installed = new Map((rows || []).map((r) => [r.id, r]));
  return TEMPLATES.filter((t) => !t.hidden).map((t) => ({ ...t, installed: installed.has(t.id), ...(installed.get(t.id) || {}) }));
}

async function create(id) {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error('Tarefa desconhecida.');
  const res = await runPowerShell(`
$action = ${actionExpr(t)}
$trigger = ${triggerExpr(t)}
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskPath ${q(FOLDER)} -TaskName ${q(t.id)} -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description ${q(t.description)} -Force | Out-Null`);
  if (!res.ok) throw new Error(/denied|negado/i.test(res.stderr) ? 'Precisa de administrador para criar tarefas agendadas.' : res.stderr);
  store.log({ action: 'apply', id: `task:${t.id}`, name: `Tarefa agendada: ${t.name}`, ok: true });
  return { ok: true };
}

async function remove(id) {
  const res = await runPowerShell(`Unregister-ScheduledTask -TaskPath ${q(FOLDER)} -TaskName ${q(id)} -Confirm:$false`);
  if (!res.ok) throw new Error(res.stderr);
  store.log({ action: 'revert', id: `task:${id}`, name: `Tarefa removida: ${id}`, ok: true });
  return { ok: true };
}

async function runNow(id) {
  const res = await runPowerShell(`Start-ScheduledTask -TaskPath ${q(FOLDER)} -TaskName ${q(id)}`);
  if (!res.ok) throw new Error(res.stderr);
  return { ok: true };
}

module.exports = { TEMPLATES, list, create, remove, runNow };
