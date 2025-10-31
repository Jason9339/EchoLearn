/*
  Dev launcher: try port 3000, then 3001 automatically, and set NEXTAUTH_URL accordingly.
  On Windows, also skip excluded (reserved) port ranges to avoid EACCES.
  Works on Windows PowerShell and other shells since it's a Node script.
*/

const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');

const NEXT_BIN = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');

/**
 * Build candidate ports starting from 3000, prioritizing 3000 then 3001,
 * but extend to 3002-3005 as fallbacks.
 * On Windows, remove ports that fall into excluded ranges (netsh reserved).
 */
function buildCandidatePorts() {
  /** @type {number[]} */
  const baseCandidates = [];
  // Prefer 3000/3001 first
  baseCandidates.push(3000, 3001);
  // Nearby common dev ports
  for (let p = 3002; p <= 3050; p += 1) baseCandidates.push(p);
  baseCandidates.push(3100, 3200, 4000, 5000, 5173);
  if (process.platform !== 'win32') return baseCandidates;

  // Query excluded ranges: "netsh interface ipv4 show excludedportrange protocol=tcp"
  /** @type {Array<{start:number,end:number}>} */
  const ranges = [];
  try {
    const res = spawnSync('netsh', ['interface', 'ipv4', 'show', 'excludedportrange', 'protocol=tcp'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const out = res.stdout || '';
    // Parse per-line to be robust against CRLF and localized headers
    const lines = out.split(/\r?\n/);
    for (const ln of lines) {
      const m = ln.match(/^\s*(\d+)\s+(\d+)\s*$/);
      if (!m) continue;
      const start = Number(m[1]);
      const end = Number(m[2]);
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end) {
        ranges.push({ start, end });
      }
    }
  } catch {}

  const isExcluded = (p) => ranges.some((r) => p >= r.start && p <= r.end);
  const filtered = baseCandidates.filter((p) => !isExcluded(p));
  if (filtered.length === 0) {
    // Fallback: if everything filtered out, at least return 3002+
    return [3002, 3003, 3004, 3005];
  }
  return filtered;
}

const PORTS_TO_TRY = buildCandidatePorts();

function canBindPort(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => {
      try { srv.close(); } catch {}
      resolve(false);
    });
    srv.listen({ port, host: '127.0.0.1', exclusive: true }, () => {
      // Successfully bound; close immediately
      try { srv.close(() => resolve(true)); } catch { resolve(false); }
    });
  });
}

async function startNextOnPort(portIndex = 0) {
  if (portIndex >= PORTS_TO_TRY.length) {
    console.error('[dev] Failed to start Next.js on all tried ports:', PORTS_TO_TRY.join(', '));
    process.exit(1);
  }

  const port = PORTS_TO_TRY[portIndex];

  // Preflight bind test to avoid EACCES/EADDRINUSE upfront
  const ok = await canBindPort(port);
  if (!ok) {
    console.warn(`[dev] Port ${port} is not bindable (reserved or in use). Trying next...`);
    return startNextOnPort(portIndex + 1);
  }

  const childEnv = { ...process.env };
  // Always align PORT with the selected candidate to ensure consistency
  childEnv.PORT = String(port);
  // Always align NEXTAUTH_URL with the chosen port in dev to avoid callback URL mismatch
  childEnv.NEXTAUTH_URL = `http://localhost:${childEnv.PORT}`;
  if (!childEnv.HOST) childEnv.HOST = '127.0.0.1';

  console.log(`[dev] Starting Next.js on port ${port} (NEXTAUTH_URL=${childEnv.NEXTAUTH_URL})`);

  const child = spawn(process.execPath, [NEXT_BIN, 'dev', '--turbopack', '--port', String(port), '--hostname', '127.0.0.1'], {
    env: childEnv,
    stdio: ['inherit', 'inherit', 'pipe'],
  });

  let exited = false;
  const tryNext = (reason) => {
    if (portIndex < PORTS_TO_TRY.length - 1) {
      console.warn(`[dev] Next.js failed to start on port ${port}${reason ? ` (${reason})` : ''}. Trying next port...`);
      startNextOnPort(portIndex + 1);
    } else {
      console.error(`[dev] Next.js failed to start. Last tried port: ${port}.`);
      process.exit(1);
    }
  };

  child.on('exit', (code, signal) => {
    exited = true;
    if (code === 0) {
      process.exit(0);
      return;
    }
    tryNext(`code=${code}, signal=${signal}`);
  });

  child.on('close', (code, signal) => {
    if (exited) return;
    if (code === 0) {
      process.exit(0);
      return;
    }
    tryNext(`close code=${code}, signal=${signal}`);
  });

  child.on('error', (err) => {
    tryNext(`error=${err?.message || err}`);
  });

  // Keep stderr visible without killing on heuristics; rely on exit/close to retry
  if (child.stderr && child.stderr.pipe) {
    child.stderr.pipe(process.stderr);
  }

  // Safety: if process is killed, forward to child
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  signals.forEach(sig => {
    process.on(sig, () => {
      if (!exited) {
        try { child.kill(sig); } catch {}
      }
      process.exit(0);
    });
  });
}

startNextOnPort(0);


