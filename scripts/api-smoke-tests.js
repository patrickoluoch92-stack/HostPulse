const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const DEFAULT_PORT = process.env.PORT || '5000';
const API_URL = process.env.API_SMOKE_BASE_URL || `http://127.0.0.1:${DEFAULT_PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs = 60000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) {
        return response;
      }
    } catch {
      // Server not ready yet.
    }

    await sleep(1500);
  }

  throw new Error(`API did not become healthy within ${timeoutMs}ms`);
}

async function main() {
  const apiEntrypoint = 'api/dist/main.js';
  const child = spawn('node', [apiEntrypoint], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'test',
      PORT: DEFAULT_PORT,
      HOST: process.env.HOST || '127.0.0.1',
    },
  });

  try {
    const healthResponse = await waitForHealth();
    const healthBody = await healthResponse.json();
    assert.equal(healthResponse.status, 200, 'Expected /health to return 200');
    assert.equal(healthBody.status, 'ok', 'Expected healthy status payload');

    const loginValidationResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(loginValidationResponse.status, 400, 'Expected auth validation failure');

    const unauthenticatedBookingResponse = await fetch(`${API_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: 1,
        startDate: '2026-05-01',
        endDate: '2026-05-02',
        total: 1000,
      }),
    });
    assert.equal(unauthenticatedBookingResponse.status, 401, 'Expected booking auth guard');

    const invalidWebhookResponse = await fetch(`${API_URL}/api/payments/mpesa/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(invalidWebhookResponse.status, 400, 'Expected webhook validation failure');
  } finally {
    child.kill('SIGINT');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
