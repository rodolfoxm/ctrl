// Tiny JSON persistence in the user's data folder.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = {
  applied: {}, // tweakId -> { name, module, at, snapshot, source }
  removedApps: {}, // appx name -> { label, familyName, at }
  games: [], // { id, name, exe, source }
  gameProfiles: {}, // gameId -> { priority, gpu, fso, liveTweaks: [] }
  customProfiles: [], // { id, name, description, tweaks: [] }
  activeProfile: null, // profile id last applied
  history: [], // { at, action, id, name, ok, error, source }
  sweeps: [], // { at, verified, drifted: [ids], unverifiable }
  sessions: [], // live game mode sessions { game, exe, start, end, actions }
  dns: null, // { provider, previous: [{ alias, servers }] }
  onboarded: false,
  settings: {
    autoRestorePoint: true,
    confirmRisky: true,
    showHidden: false,
    liveGameMode: false,
    liveGameModeAsk: true,
    liveGamePlan: true,
    liveGameTimer: true,
    sentinel: true,
    sentinelRepair: false,
    startWithWindows: false,
    closeToTray: true,
    intro: true,
    checkUpdates: true,
  },
};

let cache = null;

function file() {
  return path.join(app.getPath('userData'), 'state.json');
}

function merge(raw) {
  return { ...structuredClone(DEFAULTS), ...raw, settings: { ...DEFAULTS.settings, ...(raw.settings || {}) } };
}

// Before the rename the app was called mojoTWEEKS; its state (applied tweaks and their
// backups) is copied over once so everything stays undoable after updating.
function migrateLegacy() {
  const target = file();
  const legacy = path.join(app.getPath('appData'), 'mojoTWEEKS', 'state.json');
  if (fs.existsSync(target) || !fs.existsSync(legacy)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(legacy, target);
}

function load() {
  if (cache) return cache;
  try {
    migrateLegacy();
  } catch {}
  try {
    cache = merge(JSON.parse(fs.readFileSync(file(), 'utf8')));
  } catch {
    cache = structuredClone(DEFAULTS);
  }
  return cache;
}

// Some antivirus suites (Kaspersky's "restricted" group for unsigned apps) drop an app's writes without
// returning an error, so every save is read back; a mismatch flags the state as not persisting.
let blocked = false;
const blockedListeners = [];

function setBlocked(value) {
  if (value && !blocked) blockedListeners.forEach((fn) => fn());
  blocked = value;
}

function save() {
  const target = file();
  const json = JSON.stringify(cache, null, 2);
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, json, 'utf8');
    fs.renameSync(tmp, target);
  } catch (err) {
    setBlocked(true);
    throw err;
  }
  setBlocked(fs.readFileSync(target, 'utf8') !== json);
}

/** Saves the current state once to find out early whether writes persist. */
function probe() {
  load();
  try {
    save();
  } catch {}
  return !blocked;
}

const isBlocked = () => blocked;
const onBlocked = (fn) => blockedListeners.push(fn);

function update(fn) {
  const state = load();
  fn(state);
  save();
  return state;
}

function log(entry) {
  update((s) => {
    s.history.unshift({ at: new Date().toISOString(), ...entry });
    s.history = s.history.slice(0, 500);
  });
}

function replace(next) {
  cache = merge(next);
  save();
  return cache;
}

function reset({ keepApplied = true } = {}) {
  const prev = load();
  cache = structuredClone(DEFAULTS);
  if (keepApplied) cache.applied = prev.applied;
  save();
  return cache;
}

module.exports = { load, update, log, replace, reset, file, probe, isBlocked, onBlocked, DEFAULTS };
