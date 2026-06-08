const fs = require('fs');
const path = require('path');

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.error('Token required as first arg');
    process.exit(2);
  }
  const prBodyPath = path.join(__dirname, '..', 'PR_BODY.md');
  if (!fs.existsSync(prBodyPath)) {
    console.error('PR_BODY.md not found');
    process.exit(1);
  }
  const body = fs.readFileSync(prBodyPath, 'utf8');
  const payload = {
    title: 'fix(auth,bookings): validation, docs sanitization, and dev-ex tooling',
    head: 'fix/deps-url-parse',
    base: 'main',
    body,
  };

  const res = await fetch('https://api.github.com/repos/patrickoluoch92-stack/HostPulse/pulls', {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'hostpulse-bot',
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (res.ok) {
      console.log('PR_CREATED', json.number, json.html_url);
    } else {
      console.error('PR_ERROR', res.status, json);
      process.exit(1);
    }
  } catch (e) {
    console.error('INVALID_RESPONSE', res.status, text);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
