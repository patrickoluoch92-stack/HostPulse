const fs = require('fs');
const path = require('path');

const workspace = path.resolve(__dirname, '..');
const launchPath = path.join(workspace, '.vscode', 'launch.json');

function detectChrome() {
  const candidates = [
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Chromium/Application/chrome.exe',
    'C:/Program Files/Google/Chrome Beta/Application/chrome.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return 'chrome'; // fallback to PATH
}

function updateLaunch(runtimePath) {
  if (!fs.existsSync(launchPath)) {
    console.error('launch.json not found at', launchPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(launchPath, 'utf8');
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse launch.json:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(obj.configurations)) obj.configurations = [];

  const cfg = obj.configurations.find(c => c.name && c.name.includes('Launch Chrome'));
  if (!cfg) {
    console.error('No Chrome launch configuration found to update.');
    process.exit(1);
  }

  cfg.runtimeExecutable = runtimePath;
  fs.writeFileSync(launchPath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  console.log('Updated', launchPath, 'runtimeExecutable ->', runtimePath);
}

const pathFound = detectChrome();
updateLaunch(pathFound);
