const { mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const command = join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
);
const cacheDir = join(process.cwd(), 'tmp', 'tsc');
mkdirSync(cacheDir, { recursive: true });

const runs = [
  [
    '-p',
    'api/tsconfig.app.json',
    '--noEmit',
    '--tsBuildInfoFile',
    join(cacheDir, 'api.tsbuildinfo'),
  ],
  [
    '-p',
    'apps/tsconfig.json',
    '--noEmit',
    '--tsBuildInfoFile',
    join(cacheDir, 'apps.tsbuildinfo'),
  ],
];

for (const args of runs) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
