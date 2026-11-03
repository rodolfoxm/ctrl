// Runs PowerShell scripts via -EncodedCommand so quoting never leaks into argv.
// Scripts too big for the 32K-character Windows command line go through a temp .ps1.
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_ENCODED = 24000;
const BASE_ARGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass'];

/** argv for a full script, plus a cleanup for the temp file when one was needed. */
function scriptArgs(full) {
  const encoded = encode(full);
  if (encoded.length <= MAX_ENCODED) return { args: [...BASE_ARGS, '-EncodedCommand', encoded], cleanup: () => {} };
  const file = path.join(os.tmpdir(), `ctrl-${crypto.randomBytes(8).toString('hex')}.ps1`);
  // UTF-8 with BOM so Windows PowerShell 5.1 reads accented text correctly.
  fs.writeFileSync(file, `\uFEFF${full}`, 'utf8');
  return { args: [...BASE_ARGS, '-File', file], cleanup: () => fs.rm(file, { force: true }, () => {}) };
}

const PRELUDE = [
  "$ErrorActionPreference = 'Stop'",
  "$ProgressPreference = 'SilentlyContinue'",
  '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
].join('\n');

/** Quote a JS value as a PowerShell single-quoted string literal. */
function q(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function encode(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function runPowerShell(script, { timeout = 60000 } = {}) {
  return new Promise((resolve) => {
    const full = `${PRELUDE}\ntry {\n${script}\n} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }`;
    const { args, cleanup } = scriptArgs(full);
    let child;
    try {
      child = spawn('powershell.exe', args, { windowsHide: true });
    } catch (err) {
      cleanup();
      resolve({ ok: false, code: -1, stdout: '', stderr: err.message });
      return;
    }
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      stderr += `\nTempo limite de ${Math.round(timeout / 1000)}s excedido.`;
    }, timeout);
    child.stdout.on('data', (d) => (stdout += d.toString('utf8')));
    child.stderr.on('data', (d) => (stderr += d.toString('utf8')));
    child.on('error', (err) => {
      clearTimeout(timer);
      cleanup();
      resolve({ ok: false, code: -1, stdout, stderr: err.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      cleanup();
      resolve({ ok: code === 0, code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

/** Runs a script that prints JSON as its last line and parses it. */
async function runJson(script, opts) {
  const res = await runPowerShell(script, opts);
  if (!res.ok) throw new Error(res.stderr || `PowerShell saiu com código ${res.code}`);
  const lines = res.stdout.split(/\r?\n/).filter((l) => l.trim());
  const last = lines[lines.length - 1];
  if (!last) return null;
  return JSON.parse(last);
}

/** Starts a long-lived script; calls onLine for each stdout line. Returns a stop function. */
function streamPowerShell(script, onLine) {
  const full = `${PRELUDE}\n${script}`;
  const { args, cleanup } = scriptArgs(full);
  const child = spawn('powershell.exe', args, { windowsHide: true });
  child.on('close', cleanup);
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onLine(line);
    }
  });
  child.on('error', () => {});
  const stop = () => {
    if (!child.killed) child.kill();
  };
  // Long-running workers that read commands from stdin (the Batuta engine) use these.
  stop.send = (line) => child.stdin.writable && child.stdin.write(`${line}\n`);
  stop.onExit = (fn) => child.on('close', fn);
  return stop;
}

module.exports = { runPowerShell, runJson, streamPowerShell, q };
