const { spawn } = require('node:child_process');
const { join } = require('node:path');

const isWindows = process.platform === 'win32';
const nodeCommand = isWindows ? 'node.exe' : 'node';
const nextCommand = join(
  process.cwd(),
  'node_modules',
  '.bin',
  isWindows ? 'next.cmd' : 'next',
);

const children = [];

function startProcess(label, args) {
  const [command, commandArgs, cwd] = args;
  const child = spawn(command, commandArgs, {
    cwd,
    shell: isWindows,
    stdio: 'inherit',
    env: {
      ...process.env,
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${label}] exited via signal ${signal}`);
      shutdown(signal);
      return;
    }

    if (typeof code === 'number' && code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
      shutdown(code);
    }
  });

  children.push(child);
}

function shutdown(exitCode = 0) {
  while (children.length > 0) {
    const child = children.pop();
    if (child && !child.killed) {
      child.kill('SIGINT');
    }
  }

  setTimeout(() => process.exit(typeof exitCode === 'number' ? exitCode : 0), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

startProcess('api', [
  nodeCommand,
  ['scripts/start-api-dev.js'],
  process.cwd(),
]);
startProcess('frontend', [
  nextCommand,
  ['dev', '--webpack', '--hostname', '127.0.0.1', '--port', '4200'],
  join(process.cwd(), 'apps'),
]);
