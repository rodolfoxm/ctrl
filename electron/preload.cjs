const { contextBridge, ipcRenderer } = require('electron');

// The renderer only names a channel and passes data; the main process decides what
// runs (tweak ids are looked up in the catalog, never sent as scripts).
const CHANNEL = /^[a-z]+:[a-zA-Z]+$/;
const EVENTS = new Set(['win:state', 'hw:update', 'tweaks:progress', 'guardian:sweep', 'livegame:event', 'net:bloat', 'batuta:event', 'app:health', 'app:updateProgress']);

contextBridge.exposeInMainWorld('ctrl', {
  invoke: (channel, ...args) => {
    if (!CHANNEL.test(channel)) return Promise.reject(new Error(`Canal inválido: ${channel}`));
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel, cb) => {
    if (!EVENTS.has(channel)) return () => {};
    const listener = (_e, data) => cb(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
