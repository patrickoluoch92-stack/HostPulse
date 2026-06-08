const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/run-nx.js <nx-args...>');
  process.exit(1);
}

const command = join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'nx.cmd' : 'nx',
);
const env = {
  ...process.env,
  NX_DAEMON: 'false',
};
const result = spawnSync(command, args, {
  cwd: process.cwd(),
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
