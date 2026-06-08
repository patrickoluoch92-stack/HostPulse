const token = process.argv[2];
const prNumber = process.argv[3];
if (!token || !prNumber) {
  console.error('Usage: node merge_pr.js <token> <prNumber>');
  process.exit(2);
}

async function main() {
  const url = `https://api.github.com/repos/patrickoluoch92-stack/HostPulse/pulls/${prNumber}/merge`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'hostpulse-bot',
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({ commit_title: `Merge PR #${prNumber} via automation`, merge_method: 'merge' }),
  });
  const json = await res.json().catch(()=>null);
  if (res.ok) {
    console.log('MERGED', json.merge_commit_sha || json.sha || json.message || 'merged');
  } else {
    console.error('MERGE_FAILED', res.status, json);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
