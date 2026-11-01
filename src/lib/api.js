// Single entry point to the main process. In a plain browser (npm run web) a mock
// backend stands in so the UI can be developed without touching the system.
import { mockBackend } from './mock.js';

const bridge = typeof window !== 'undefined' && window.ctrl ? window.ctrl : mockBackend;

export const isMock = bridge === mockBackend;

export function call(channel, ...args) {
  return bridge.invoke(channel, ...args);
}

export function on(channel, cb) {
  return bridge.on(channel, cb);
}

/** Throws when a handler returned { ok: false, error }. */
export async function must(channel, ...args) {
  const res = await call(channel, ...args);
  if (res && res.ok === false && !res.canceled) throw new Error(res.error || 'Falha na operação.');
  return res;
}
