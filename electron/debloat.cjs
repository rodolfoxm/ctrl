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
  { name: 'Microsoft.BingFinance', label: 'Finanças (MSN)', level: 'recommended' },
  { name: 'Microsoft.BingSports', label: 'Esportes (MSN)', level: 'recommended' },
  { name: 'Microsoft.BingTravel', label: 'Viagens (MSN)', level: 'recommended' },
  { name: 'Microsoft.BingFoodAndDrink', label: 'Comidas e Bebidas (MSN)', level: 'recommended' },
  { name: 'Microsoft.BingHealthAndFitness', label: 'Saúde e Boa Forma (MSN)', level: 'recommended' },
  { name: 'Microsoft.BingTranslator', label: 'Tradutor', level: 'optional' },
  { name: 'Microsoft.News', label: 'Microsoft Notícias', level: 'recommended' },
  { name: 'Microsoft.3DBuilder', label: '3D Builder', level: 'recommended' },
  { name: 'Microsoft.Print3D', label: 'Impressão 3D', level: 'recommended' },
  { name: 'Microsoft.Messaging', label: 'Mensagens', level: 'recommended' },
  { name: 'Microsoft.OneConnect', label: 'Wi-Fi e Celular Pagos', level: 'recommended' },
  { name: 'Microsoft.Wallet', label: 'Microsoft Pay', level: 'recommended' },
  { name: 'Microsoft.Office.Sway', label: 'Sway', level: 'recommended' },
  { name: 'Microsoft.MicrosoftPowerBIForWindows', label: 'Power BI', level: 'optional' },
  { name: 'Microsoft.NetworkSpeedTest', label: 'Teste de Velocidade da Rede', level: 'recommended' },
  { name: 'Microsoft.Whiteboard', label: 'Whiteboard', level: 'optional' },
  { name: 'Microsoft.MicrosoftJournal', label: 'Journal', level: 'optional' },
  { name: 'Microsoft.Windows.AIHub', label: 'AI Hub (vitrine de apps de IA)', level: 'recommended' },
  { name: 'Microsoft.M365Companions', label: 'Microsoft 365 Companions', level: 'recommended' },
  { name: '7EE7776C.LinkedInforWindows', label: 'LinkedIn', level: 'recommended' },
  { name: '4DF9E0F8.Netflix', label: 'Netflix', level: 'optional' },
  { name: 'Disney.37853FC22B2CE', label: 'Disney+', level: 'optional' },
  { name: 'SpotifyAB.SpotifyMusic', label: 'Spotify', level: 'optional' },
  { name: 'AmazonVideo.PrimeVideo', label: 'Prime Video', level: 'optional' },
  { name: 'HULULLC.HULUPLUS', label: 'Hulu', level: 'optional' },
  { name: 'BytedancePte.Ltd.TikTok', label: 'TikTok', level: 'recommended' },
  { name: 'Facebook.Instagram', label: 'Instagram', level: 'recommended' },
  { name: 'FACEBOOK.FACEBOOK', label: 'Facebook', level: 'recommended' },
  { name: 'Amazon.com.Amazon', label: 'Amazon', level: 'recommended' },
  { name: 'king.com.CandyCrushSaga', label: 'Candy Crush Saga', level: 'recommended' },
  { name: 'king.com.CandyCrushSodaSaga', label: 'Candy Crush Soda Saga', level: 'recommended' },
  { name: 'king.com.BubbleWitch3Saga', label: 'Bubble Witch 3 Saga', level: 'recommended' },
  { name: 'flaregamesGmbH.RoyalRevolt', label: 'Royal Revolt', level: 'recommended' },
  { name: 'AdobeSystemsIncorporated.AdobePhotoshopExpress', label: 'Photoshop Express', level: 'recommended' },
  { name: 'Drawboard.DrawboardPDF', label: 'Drawboard PDF', level: 'recommended' },
  { name: 'DolbyLaboratories.DolbyAccess', label: 'Dolby Access', level: 'optional' },
  { name: 'DellInc.DellDigitalDelivery', label: 'Dell Digital Delivery', level: 'optional' },
  { name: 'DellInc.DellMobileConnect', label: 'Dell Mobile Connect', level: 'optional' },
  { name: 'AD2F1837.HPJumpStarts', label: 'HP JumpStart', level: 'recommended' },
  { name: 'AD2F1837.HPWelcome', label: 'HP Welcome', level: 'recommended' },
  { name: 'AD2F1837.HPPrivacySettings', label: 'HP Privacy Settings', level: 'optional' },
  { name: 'AD2F1837.HPAIExperienceCenter', label: 'HP AI Experience Center', level: 'optional' },
  { name: 'AD2F1837.myHP', label: 'myHP', level: 'optional', warn: 'Algumas funções do notebook HP (perfis de energia, câmera, áudio) são configuradas por ele.' },
  { name: 'E046963F.LenovoCompanion', label: 'Lenovo Companion', level: 'optional' },
  { name: 'MicrosoftWindows.CrossDevice', label: 'Experiência entre dispositivos', level: 'optional', warn: 'O Vincular ao Celular e o uso do celular como webcam deixam de funcionar.' },
  { name: 'MicrosoftWindows.Client.WebExperience', label: 'Widgets', level: 'optional', warn: 'O painel de Widgets (Win+W) e o clima na barra de tarefas somem.' },
  { name: 'Microsoft.WindowsCalculator', label: 'Calculadora', level: 'keep' },
  { name: 'Microsoft.Windows.Photos', label: 'Fotos', level: 'keep', warn: 'Imagens deixam de abrir com dois cliques até você escolher outro visualizador.' },
  { name: 'Microsoft.WindowsNotepad', label: 'Bloco de Notas', level: 'keep' },
  { name: 'Microsoft.XboxApp', label: 'Xbox Console Companion', level: 'optional' },
  { name: 'Microsoft.GamingApp', label: 'App Xbox', level: 'keep', warn: 'Jogos do Game Pass e da Microsoft Store deixam de abrir e atualizar.' },
  { name: 'Microsoft.XboxGamingOverlay', label: 'Xbox Game Bar', level: 'keep', warn: 'Some a gravação de tela com Win+G e o painel de desempenho; alguns jogos da Microsoft dependem dela.' },
  { name: 'Microsoft.XboxSpeechToTextOverlay', label: 'Xbox Speech to Text', level: 'optional' },
  { name: 'Microsoft.XboxIdentityProvider', label: 'Xbox Identity Provider', level: 'keep', warn: 'O login da conta Microsoft em jogos (Minecraft, Forza, Sea of Thieves) para de funcionar.' },
  { name: 'Microsoft.Xbox.TCUI', label: 'Xbox TCUI', level: 'keep' },
  { name: 'Microsoft.WindowsStore', label: 'Microsoft Store', level: 'keep', warn: 'Sem a Store não dá para reinstalar os outros apps desta lista nem atualizar apps da loja.' },
  { name: 'Microsoft.GamingServices', label: 'Gaming Services', level: 'keep', warn: 'Jogos modernos da Microsoft Store e do Game Pass deixam de abrir.' },
  { name: 'Microsoft.HEVCVideoExtension', label: 'Extensão de vídeo HEVC', level: 'keep', warn: 'Vídeos HEVC/H.265 (de celulares e câmeras) deixam de tocar em alguns apps.' },
  { name: 'Microsoft.VP9VideoExtensions', label: 'Extensão de vídeo VP9', level: 'keep', warn: 'Vídeos VP9 deixam de tocar em alguns apps.' },
  { name: 'Microsoft.WebMediaExtensions', label: 'Extensões de mídia da Web', level: 'keep', warn: 'Formatos como OGG e Vorbis deixam de tocar em alguns apps.' },
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
