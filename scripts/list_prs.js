async function main() {
  const token = process.argv[2];
  if (!token) { console.error('token required'); process.exit(2); }
  const res = await fetch('https://api.github.com/repos/patrickoluoch92-stack/HostPulse/pulls?state=open', {
    headers: { Authorization: `token ${token}`, 'User-Agent': 'hostpulse-bot' }
  });
  const prs = await res.json();
  for (const p of prs) {
    if (p.head && p.head.ref === 'fix/deps-url-parse') {
      console.log('MATCH', p.number, p.state, p.html_url);
      return;
    }
  }
  console.log('NO_MATCH');
}
main().catch(e=>{ console.error(e); process.exit(1); });
