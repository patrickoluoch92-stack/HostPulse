const path = require('path');
const fs = require('fs');

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

const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.log('[firebase-check] .env not found, skipping Firebase checks.');
  process.exit(0);
}

const envVars = parseEnv(envPath);
const required = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
];

const present = required.filter((key) => Boolean(envVars[key]));
const missing = required.filter((key) => !envVars[key]);

if (present.length === 0) {
  console.log('[firebase-check] Firebase config not present. Integration disabled by environment.');
  process.exit(0);
}

if (missing.length > 0) {
  console.error('[firebase-check] Firebase config is partially set.');
  console.error(`[firebase-check] Missing keys: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('[firebase-check] Firebase environment keys are present.');
