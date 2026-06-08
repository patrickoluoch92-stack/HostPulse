const { execFile } = require('node:child_process');
const net = require('node:net');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

function normalizeHost(host) {
  return host === '0.0.0.0' ? '127.0.0.1' : host || '127.0.0.1';
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function isPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', (error) => {
      resolve(error.code !== 'EADDRINUSE');
    });
    server.listen({ port, host }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function waitForPortState(port, host, expectedAvailable, timeoutMs = 10000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const available = await isPortAvailable(port, host);
    if (available === expectedAvailable) {
      return true;
    }
    await sleep(250);
  }

  return false;
}

async function findPortOwner(port) {
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('netstat', ['-ano', '-p', 'tcp']);
    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => line.includes(`:${port}`) && line.includes('LISTENING'));

    for (const line of lines) {
      const parts = line.split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (Number.isInteger(pid) && pid > 0) {
        return { pid };
      }
    }
    return null;
  }

  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN']);
    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      return null;
    }

    const parts = lines[1].split(/\s+/);
    const pid = Number(parts[1]);
    return Number.isInteger(pid) && pid > 0 ? { pid } : null;
  } catch {
    return null;
  }
}

async function getProcessInfo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return null;
  }

  if (process.platform === 'win32') {
    const script =
      `Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" | ` +
      'Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress';
    try {
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script]);
      const raw = stdout.trim();
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      return {
        pid: Number(parsed.ProcessId),
        name: parsed.Name || '',
        commandLine: parsed.CommandLine || '',
      };
    } catch {
      return null;
    }
  }

  try {
    const { stdout } = await execFileAsync('ps', ['-p', String(pid), '-o', 'pid=', '-o', 'comm=', '-o', 'args=']);
    const line = stdout.trim();
    if (!line) {
      return null;
    }
    const match = line.match(/^(\d+)\s+(\S+)\s+(.*)$/);
    if (!match) {
      return null;
    }
    return {
      pid: Number(match[1]),
      name: match[2] || '',
      commandLine: match[3] || '',
    };
  } catch {
    return null;
  }
}

function isHostPulseProcess(processInfo, workspaceRoot) {
  if (!processInfo) {
    return false;
  }

  const haystack = `${processInfo.name} ${processInfo.commandLine}`.toLowerCase();
  const normalizedRoot = workspaceRoot.replace(/\\/g, '/').toLowerCase();
  return (
    haystack.includes('hostpulse') ||
    haystack.includes(normalizedRoot) ||
    haystack.includes('api/dist/main') ||
    haystack.includes('nest start')
  );
}

async function stopProcessGracefully(pid) {
  try {
    process.kill(pid, 'SIGTERM');
  } catch (error) {
    if (error && error.code !== 'ESRCH') {
      throw error;
    }
  }

  const stoppedAfterSignal = await waitForProcessExit(pid, 5000);
  if (stoppedAfterSignal) {
    return;
  }

  if (process.platform === 'win32') {
    await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F']);
    return;
  }

  process.kill(pid, 'SIGKILL');
  await waitForProcessExit(pid, 2000);
}

async function waitForProcessExit(pid, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const processInfo = await getProcessInfo(pid);
    if (!processInfo) {
      return true;
    }
    await sleep(250);
  }
  return false;
}

async function findNextAvailablePort(startPort, host, attempts = 10) {
  let port = startPort;
  for (let idx = 0; idx < attempts; idx += 1) {
    const available = await isPortAvailable(port, host);
    if (available) {
      return port;
    }
    port += 1;
  }

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  findNextAvailablePort,
  findPortOwner,
  getProcessInfo,
  isHostPulseProcess,
  isPortAvailable,
  normalizeHost,
  parsePositiveInt,
  stopProcessGracefully,
  waitForPortState,
};
