const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const envPath = path.join(ROOT, '.env');
const envExamplePath = path.join(ROOT, '.env.example');
const schemaPath = path.join(ROOT, 'prisma', 'schema.prisma');

function fail(message, details) {
  console.error(`\n[doctor] ERROR: ${message}`);
  if (details) {
    console.error(`[doctor] ${details}`);
  }
  process.exit(1);
}

function warn(message) {
  console.warn(`[doctor] WARN: ${message}`);
}

function info(message) {
  console.log(`[doctor] ${message}`);
}

function parseEnv(filePath) {
  const result = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const idx = trimmed.indexOf('=');
    if (idx === -1) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .replace(/^'(.*)'$/, '$1');
    result[key] = value;
  }
  return result;
}

if (!fs.existsSync(envPath)) {
  if (!fs.existsSync(envExamplePath)) {
    fail('.env is missing and .env.example was not found.');
  }
  fs.copyFileSync(envExamplePath, envPath);
  warn('Created .env from .env.example. Review and update secrets before production use.');
}

if (!fs.existsSync(schemaPath)) {
  fail(`Prisma schema not found at ${schemaPath}`);
}

const envVars = parseEnv(envPath);
const databaseUrl = envVars.DATABASE_URL;
const jwtSecret = envVars.JWT_ACCESS_SECRET;
const webhookSecret = envVars.MPESA_WEBHOOK_SECRET;
const firebaseApiKey = envVars.NEXT_PUBLIC_FIREBASE_API_KEY;
const firebaseProjectId = envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const firebaseAuthDomain = envVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const firebaseStorageBucket = envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

if (!databaseUrl) {
  fail('DATABASE_URL is missing in .env');
}
if (/YOUR_DB_PASSWORD/i.test(databaseUrl)) {
  fail('DATABASE_URL still contains placeholder value.', 'Set a real PostgreSQL password in .env');
}
if (!jwtSecret) {
  fail('JWT_ACCESS_SECRET is missing in .env');
}
if (
  jwtSecret === 'dev-secret-change-me-in-production' ||
  jwtSecret === 'your-secret-key-change-in-production'
) {
  fail('JWT_ACCESS_SECRET still uses default placeholder.', 'Set a strong JWT secret in .env');
}
if (!webhookSecret) {
  fail('MPESA_WEBHOOK_SECRET is missing in .env');
}
if (/change-me|placeholder|your_/i.test(webhookSecret)) {
  fail('MPESA_WEBHOOK_SECRET appears to be a placeholder.', 'Set a strong webhook signing secret in .env');
}
const firebaseRequiredKeys = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
];
const firebaseValues = {
  NEXT_PUBLIC_FIREBASE_API_KEY: firebaseApiKey,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseProjectId,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseAuthDomain,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: firebaseStorageBucket,
};
const firebasePresent = firebaseRequiredKeys.filter((key) => Boolean(firebaseValues[key]));
const firebaseMissing = firebaseRequiredKeys.filter((key) => !firebaseValues[key]);
if (firebasePresent.length > 0 && firebaseMissing.length > 0) {
  fail(
    'Firebase configuration is partially set in .env.',
    `Set all required keys or remove all Firebase keys. Missing: ${firebaseMissing.join(', ')}`
  );
}
if (firebasePresent.length === 0) {
  info('Firebase config not provided. Firebase features will stay disabled in UI.');
} else {
  info('Firebase config keys are present.');
}

info('Environment file checks passed.');

const prismaGenerate = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'generate', '--schema=prisma/schema.prisma'],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  }
);

if (prismaGenerate.status !== 0) {
  fail('Prisma client generation failed.');
}

info('Prisma client generation succeeded.');
info('Doctor checks completed successfully.');
