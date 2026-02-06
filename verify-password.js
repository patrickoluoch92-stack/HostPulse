// Read .env file directly to avoid dotenv caching issues
const fs = require('fs');
const path = require('path');

// Try multiple .env locations
let envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '.env');
}

if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found');
  process.exit(1);
}

console.log(`Reading .env from: ${envPath}\n`);

// Parse .env file manually (don't log secrets)
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\s]+)["']?/);
if (!dbUrlMatch) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

const dbUrl = dbUrlMatch[1];
// Do not print the full DATABASE_URL to avoid leaking secrets

const { spawn } = require('child_process');
if (!dbUrl) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

// Parse the DATABASE_URL - extract and decode password
const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
if (!match) {
  console.error('❌ Invalid DATABASE_URL format');
  process.exit(1);
}

const [, user, encodedPassword, host, port, database] = match;
// Decode URL-encoded password (e.g., %24 becomes $)
// PostgreSQL connection strings use URL encoding, but psql needs the actual password
let password = decodeURIComponent(encodedPassword);

console.log('\nTesting PostgreSQL connection (sensitive values masked)\n');
console.log('Connection Details:');
console.log(`  Host: ${host}`);
console.log(`  Port: ${port}`);
console.log(`  User: ${user}`);
console.log(`  Database: ${database}`);
console.log(`  Password length: ${password.length} characters\n`);

const possiblePaths = [
  'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe',
  'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
  'C:\\Program Files\\PostgreSQL\\14\\bin\\psql.exe',
];

let psqlPath = null;
for (const p of possiblePaths) {
  try {
    const fs = require('fs');
    if (fs.existsSync(p)) {
      psqlPath = p;
      break;
    }
  } catch (e) {}
}

if (!psqlPath) {
  console.log('⚠️  psql.exe not found. Please use pgAdmin to verify password.');
  process.exit(0);
}

console.log(`✅ Found psql at: ${psqlPath}\n`);
console.log('Testing connection...\n');

process.env.PGPASSWORD = password;

const psql = spawn(psqlPath, [
  '-U', user,
  '-h', host,
  '-p', port,
  '-d', 'postgres',
  '-c', 'SELECT version();'
], {
  env: { ...process.env, PGPASSWORD: password },
  stdio: ['ignore', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';

psql.stdout.on('data', (data) => { stdout += data.toString(); });
psql.stderr.on('data', (data) => { stderr += data.toString(); });

psql.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Password is CORRECT!');
    const versionMatch = stdout.match(/PostgreSQL\s+([^\s,]+)/);
    if (versionMatch) {
      console.log(`\nPostgreSQL Version: ${versionMatch[1]}`);
    }
    
    const checkDb = spawn(psqlPath, [
      '-U', user, '-h', host, '-p', port, '-d', 'postgres',
      '-c', "SELECT datname FROM pg_database WHERE datname = 'hostpulse';"
    ], {
      env: { ...process.env, PGPASSWORD: password },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let dbCheckOutput = '';
    checkDb.stdout.on('data', (data) => { dbCheckOutput += data.toString(); });
    
    checkDb.on('close', () => {
      if (dbCheckOutput.includes('hostpulse')) {
        console.log('✅ Database "hostpulse" exists');
      } else {
        console.log('⚠️  Database "hostpulse" does NOT exist');
      }
      console.log('\n✅ Password verification complete!');
      process.exit(0);
    });
  } else {
    console.error('❌ Password is INCORRECT or connection failed');
    if (stderr) console.error('\n' + stderr);
    console.error('\n💡 Update .env with correct password and try again');
    process.exit(1);
  }
});

psql.on('error', (err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
