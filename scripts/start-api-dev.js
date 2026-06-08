const { spawn } = require('node:child_process');
const { join, resolve } = require('node:path');
const { config } = require('dotenv');
const {
  findNextAvailablePort,
  findPortOwner,
  getProcessInfo,
  isHostPulseProcess,
  normalizeHost,
  parsePositiveInt,
  stopProcessGracefully,
  waitForPortState,
} = require('./port-utils');

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '..', '.env') });

const workspaceRoot = process.cwd();
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

async function main() {
  const requestedPort = parsePositiveInt(process.env.PORT, 5000);
  const fallbackAttempts = parsePositiveInt(process.env.PORT_FALLBACK_ATTEMPTS, 10);
  const host = normalizeHost(process.env.HOST || '127.0.0.1');

  let resolvedPort = requestedPort;
  const owner = await findPortOwner(requestedPort);

  if (owner?.pid) {
    const processInfo = await getProcessInfo(owner.pid);
    if (isHostPulseProcess(processInfo, workspaceRoot)) {
      console.log(
        `[api] Port ${requestedPort} is already used by HostPulse (PID ${owner.pid}). Stopping the stale instance before restart...`,
      );
      await stopProcessGracefully(owner.pid);
      const released = await waitForPortState(requestedPort, host, true, 10000);
      if (!released) {
        throw new Error(`Port ${requestedPort} did not free up after stopping PID ${owner.pid}.`);
      }
    } else {
      const description = processInfo?.commandLine || processInfo?.name || `PID ${owner.pid}`;
      const fallbackPort = await findNextAvailablePort(requestedPort + 1, host, fallbackAttempts);
      if (!fallbackPort) {
        throw new Error(
          `Port ${requestedPort} is in use by another process (${description}) and no fallback port was available.`,
        );
      }

      resolvedPort = fallbackPort;
      console.warn(
        `[api] Port ${requestedPort} is in use by another process (${description}). Starting HostPulse on ${resolvedPort} instead.`,
      );
    }
  }

  const child = spawn(npmCommand, ['--prefix', 'api', 'run', 'start:dev'], {
    cwd: workspaceRoot,
    shell: isWindows,
    stdio: 'inherit',
    env: {
      ...process.env,
      HOST: process.env.HOST || '0.0.0.0',
      PORT: String(resolvedPort),
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(`[api] ${error.message}`);
  process.exit(1);
});
