// Removes preinstalled Store apps for the current user. Removal keeps the
// provisioned copy, so "Reinstalar" can re-register it or fall back to the Store.
const { runPowerShell, runJson, q } = require('./ps.cjs');
const store = require('./store.cjs');

// level: recommended | optional | keep (removing may break something)
const APPS = [
  { name: 'Microsoft.BingNews', label: 'Notícias', level: 'recommended' },
  { name: 'Microsoft.BingWeather', label: 'Clima', level: 'optional' },
  { name: 'Microsoft.BingSearch', label: 'Pesquisa do Bing', level: 'recommended' },
  { name: 'Microsoft.GetHelp', label: 'Obter Ajuda', level: 'recommended' },
  { name: 'Microsoft.Getstarted', label: 'Dicas', level: 'recommended' },
  { name: 'Microsoft.MicrosoftSolitaireCollection', label: 'Solitaire Collection', level: 'recommended' },
  { name: 'Microsoft.MicrosoftOfficeHub', label: 'Microsoft 365 (Office Hub)', level: 'recommended' },
  { name: 'Microsoft.WindowsFeedbackHub', label: 'Hub de Comentários', level: 'recommended' },
  { name: 'Microsoft.WindowsMaps', label: 'Mapas', level: 'recommended' },
  { name: 'Microsoft.People', label: 'Pessoas', level: 'recommended' },
  { name: 'Microsoft.ZuneMusic', label: 'Groove / Media Player', level: 'optional' },
  { name: 'Microsoft.ZuneVideo', label: 'Filmes e TV', level: 'optional' },
  { name: 'Microsoft.YourPhone', label: 'Vincular ao Celular', level: 'optional' },
  { name: 'Microsoft.549981C3F5F10', label: 'Cortana', level: 'recommended' },
  { name: 'Clipchamp.Clipchamp', label: 'Clipchamp', level: 'recommended' },
  { name: 'Microsoft.Todos', label: 'Microsoft To Do', level: 'optional' },
  { name: 'Microsoft.PowerAutomateDesktop', label: 'Power Automate', level: 'recommended' },
  { name: 'MSTeams', label: 'Microsoft Teams (novo)', level: 'optional' },
  { name: 'MicrosoftTeams', label: 'Microsoft Teams (pessoal)', level: 'optional' },
  { name: 'Microsoft.MicrosoftStickyNotes', label: 'Sticky Notes', level: 'optional' },
  { name: 'Microsoft.WindowsAlarms', label: 'Alarmes e Relógio', level: 'optional' },
  { name: 'Microsoft.WindowsSoundRecorder', label: 'Gravador de Som', level: 'optional' },
  { name: 'Microsoft.WindowsCommunicationsApps', label: 'Email e Calendário', level: 'optional' },
  { name: 'Microsoft.OutlookForWindows', label: 'Outlook (novo)', level: 'optional' },
  { name: 'Microsoft.Windows.DevHome', label: 'Dev Home', level: 'recommended' },
  { name: 'Microsoft.Copilot', label: 'Copilot', level: 'optional' },
  { name: 'MicrosoftCorporationII.QuickAssist', label: 'Assistência Rápida', level: 'optional' },
  { name: 'MicrosoftCorporationII.MicrosoftFamily', label: 'Family Safety', level: 'recommended' },
  { name: 'Microsoft.MixedReality.Portal', label: 'Portal de Realidade Misturada', level: 'recommended' },
  { name: 'Microsoft.SkypeApp', label: 'Skype', level: 'recommended' },
  { name: 'Microsoft.Microsoft3DViewer', label: 'Visualizador 3D', level: 'recommended' },
  { name: 'Microsoft.MSPaint', label: 'Paint 3D', level: 'recommended' },
  { name: 'Microsoft.Office.OneNote', label: 'OneNote (Store)', level: 'optional' },
  { name: 'Microsoft.WindowsCamera', label: 'Câmera', level: 'optional' },
  { name: 'Microsoft.Paint', label: 'Paint', level: 'optional' },
  { name: 'Microsoft.WindowsCalculator', label: 'Calculadora', level: 'keep' },
  { name: 'Microsoft.Windows.Photos', label: 'Fotos', level: 'keep' },
  { name: 'Microsoft.WindowsNotepad', label: 'Bloco de Notas', level: 'keep' },
  { name: 'Microsoft.XboxApp', label: 'Xbox Console Companion', level: 'optional' },
  { name: 'Microsoft.GamingApp', label: 'App Xbox', level: 'keep' },
  { name: 'Microsoft.XboxGamingOverlay', label: 'Xbox Game Bar', level: 'keep' },
  { name: 'Microsoft.XboxSpeechToTextOverlay', label: 'Xbox Speech to Text', level: 'optional' },
  { name: 'Microsoft.XboxIdentityProvider', label: 'Xbox Identity Provider', level: 'keep' },
  { name: 'Microsoft.Xbox.TCUI', label: 'Xbox TCUI', level: 'keep' },
  { name: 'Microsoft.WindowsStore', label: 'Microsoft Store', level: 'keep' },
];

async function scan() {
  const installed = await runJson(
    "ConvertTo-Json -Compress -InputObject @(Get-AppxPackage | Select-Object Name, PackageFamilyName, Version)",
    { timeout: 60000 },
  );
  const byName = new Map((installed || []).map((p) => [p.Name.toLowerCase(), p]));
  const removed = store.load().removedApps;
  return APPS.map((a) => {
    const pkg = byName.get(a.name.toLowerCase());
    return {
      ...a,
      installed: !!pkg,
      version: pkg?.Version || null,
      familyName: pkg?.PackageFamilyName || removed[a.name]?.familyName || null,
      removedByApp: !!removed[a.name],
    };
  });
}

async function remove(name) {
  const app = APPS.find((a) => a.name === name);
  if (!app) return { ok: false, error: 'App desconhecido.' };
  const family = await runPowerShell(`(Get-AppxPackage -Name ${q(name)} | Select-Object -First 1).PackageFamilyName`);
  const res = await runPowerShell(`Get-AppxPackage -Name ${q(name)} | Remove-AppxPackage`, { timeout: 180000 });
  store.log({ action: 'remove-app', id: name, name: app.label, ok: res.ok, error: res.ok ? undefined : res.stderr });
  if (!res.ok) return { ok: false, error: res.stderr || 'Falha ao remover.' };
  store.update((s) => {
    s.removedApps[name] = { label: app.label, familyName: family.stdout || null, at: new Date().toISOString() };
  });
  return { ok: true };
}

async function reinstall(name) {
  const app = APPS.find((a) => a.name === name);
  const entry = store.load().removedApps[name];
  // Re-register from the provisioned/other-user copy, which survives a per-user removal.
  const res = await runPowerShell(
    `$p = Get-AppxPackage -AllUsers -Name ${q(name)} -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $p) { throw 'NOT_FOUND' }
Add-AppxPackage -DisableDevelopmentMode -Register (Join-Path $p.InstallLocation 'AppXManifest.xml')`,
    { timeout: 180000 },
  );
  if (res.ok) {
    store.update((s) => delete s.removedApps[name]);
    store.log({ action: 'reinstall-app', id: name, name: app?.label || name, ok: true });
    return { ok: true };
  }
  return { ok: false, storeFallback: entry?.familyName || null, error: 'Não foi possível reinstalar localmente.' };
}

module.exports = { scan, remove, reinstall };
