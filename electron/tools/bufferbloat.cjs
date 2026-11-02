// Bufferbloat test: how much latency grows while the connection is saturated.
// Latency is the TCP handshake time to Cloudflare (no admin needed, unlike raw ICMP);
// the load comes from Cloudflare's public speed-test endpoints. Each loaded phase stops
// at a time limit or a data cap, whichever comes first.
const nodeNet = require('net');
const { net } = require('electron');

const PROBE_HOST = '1.1.1.1';
const DOWN_URL = 'https://speed.cloudflare.com/__down?bytes=25000000';
const UP_URL = 'https://speed.cloudflare.com/__up';
const PHASE_MS = 8000;
const IDLE_MS = 4000;
const STREAMS = 4;
const DOWN_CAP = 250e6;
const UP_CAP = 120e6;
const UP_CHUNK = Buffer.alloc(2e6, 0x61);

function probe(timeout = 2000) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const sock = nodeNet.connect({ host: PROBE_HOST, port: 443 });
    const done = (ms) => {
      sock.destroy();
      resolve(ms);
    };
    sock.setTimeout(timeout, () => done(null));
    sock.once('error', () => done(null));
    sock.once('connect', () => done(Number(process.hrtime.bigint() - start) / 1e6));
  });
}

/** Probes every 250 ms until `until()` is true; returns the round-trip times that answered. */
async function sample(until) {
  const rtts = [];
  let lost = 0;
  while (!until()) {
    const ms = await probe();
    if (ms == null) lost++;
    else rtts.push(Math.round(ms * 10) / 10);
    await new Promise((r) => setTimeout(r, 250));
  }
  return { rtts, lost };
}

async function download(deadline, counter, signal) {
  const worker = async () => {
    while (Date.now() < deadline && counter.bytes < DOWN_CAP && !signal.aborted) {
      const res = await net.fetch(`${DOWN_URL}&r=${Math.random()}`, { signal, cache: 'no-store' });
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        counter.bytes += value.length;
        if (Date.now() >= deadline || counter.bytes >= DOWN_CAP) {
          reader.cancel().catch(() => {});
          break;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: STREAMS }, worker));
}

async function upload(deadline, counter, signal) {
  const worker = async () => {
    while (Date.now() < deadline && counter.bytes < UP_CAP && !signal.aborted) {
      await net.fetch(UP_URL, { method: 'POST', body: UP_CHUNK, signal, cache: 'no-store' });
      counter.bytes += UP_CHUNK.length;
    }
  };
  await Promise.all(Array.from({ length: STREAMS }, worker));
}

async function loaded(kind, onProgress) {
  const counter = { bytes: 0 };
  const ctl = new AbortController();
  const start = Date.now();
  const deadline = start + PHASE_MS;
  const cap = kind === 'download' ? DOWN_CAP : UP_CAP;
  const tick = setInterval(() => onProgress({ phase: kind, elapsed: Date.now() - start, total: PHASE_MS, bytes: counter.bytes }), 500);
  // A load error (offline, blocked endpoint) ends the phase early instead of hanging the probe loop.
  let loadError = null;
  const load = (kind === 'download' ? download : upload)(deadline, counter, ctl.signal).catch((err) => {
    if (!ctl.signal.aborted) loadError = err;
  });
  const lat = await sample(() => Date.now() >= deadline || counter.bytes >= cap || loadError);
  ctl.abort();
  await load;
  clearInterval(tick);
  const secs = Math.max(0.5, (Date.now() - start) / 1000);
  if (loadError && !counter.bytes) throw new Error(`Não foi possível ${kind === 'download' ? 'baixar' : 'enviar'} dados de teste: ${loadError.message}`);
  return { ...lat, mbps: Math.round(((counter.bytes * 8) / secs / 1e6) * 10) / 10, bytes: counter.bytes };
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10;
};

// Same scale as the common bufferbloat graders (added latency under load).
function grade(added) {
  if (added == null) return null;
  if (added < 5) return 'A+';
  if (added < 30) return 'A';
  if (added < 60) return 'B';
  if (added < 200) return 'C';
  if (added < 400) return 'D';
  return 'F';
}

async function run(onProgress = () => {}) {
  const t0 = Date.now();
  const tick = setInterval(() => onProgress({ phase: 'idle', elapsed: Date.now() - t0, total: IDLE_MS }), 500);
  const idle = await sample(() => Date.now() - t0 >= IDLE_MS);
  clearInterval(tick);
  if (!idle.rtts.length) throw new Error('Sem resposta da Cloudflare. Verifique a conexão.');
  const down = await loaded('download', onProgress);
  const up = await loaded('upload', onProgress);
  const base = median(idle.rtts);
  const phase = (p) => ({ median: median(p.rtts), samples: p.rtts, lost: p.lost, mbps: p.mbps, bytes: p.bytes, added: p.rtts.length ? Math.max(0, Math.round((median(p.rtts) - base) * 10) / 10) : null });
  const d = phase(down);
  const u = phase(up);
  const worst = Math.max(d.added ?? 0, u.added ?? 0);
  return { ok: true, at: new Date().toISOString(), grade: grade(worst), added: worst, idle: { median: base, samples: idle.rtts, lost: idle.lost }, download: d, upload: u };
}

module.exports = { run, grade };
