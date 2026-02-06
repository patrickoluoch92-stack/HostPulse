# ✅ API Project - Ready to Run & Debug

## 🎯 Quick Start

### Start the API Server

**Option 1: Using NestJS CLI (Easiest)**
```powershell
node -e "process.chdir('api.'); require('child_process').execSync('npx nest start --watch', {stdio: 'inherit'});"
```

**Option 2: Using the Run Script**
```powershell
.\run-api.ps1
```

**Option 3: Direct Node.js**
```powershell
# Build first
node -e "process.chdir('api.'); require('child_process').execSync('npx nest build', {stdio: 'inherit'});"

# Then run
node api./dist/main.js
```

## 🐛 Debugging

### VS Code Debugging
1. Open VS Code
2. Press **F5** or go to **Run and Debug**
3. Select **"Debug API (NestJS)"**
4. Set breakpoints in your code
5. Server starts with debugger attached

### Manual Debugging
```powershell
node --inspect-brk api./src/main.ts
# Attach debugger to localhost:9229
```

## ✅ Configuration Status

### Project Configuration
- ✅ **Name:** `api`
- ✅ **Location:** `api./` directory
- ✅ **Registered in:** `nx.json` → `"api": "api."`
- ✅ **Main Entry:** `api./src/main.ts`
- ✅ **Build Target:** `@nx/webpack:webpack` (configured)
- ✅ **Serve Target:** `@nx/js:node` with debugging (configured)

### Files Verified
- ✅ `api./project.json` - Valid configuration
- ✅ `api./src/main.ts` - Entry point exists
- ✅ `api./tsconfig.app.json` - TypeScript config
- ✅ `api./webpack.config.js` - Webpack config
- ✅ `api./package.json` - Scripts added

### VS Code Setup
- ✅ `.vscode/launch.json` - Debug configurations created
- ✅ `.vscode/tasks.json` - Build tasks created

## 📋 Running Commands

### Build
```powershell
# Using NestJS
node -e "process.chdir('api.'); require('child_process').execSync('npx nest build', {stdio: 'inherit'});"

# Or using package script
cd api.
npm run build
```

### Serve (Development)
```powershell
# Using NestJS watch mode
node -e "process.chdir('api.'); require('child_process').execSync('npx nest start --watch', {stdio: 'inherit'});"

# Or using package script
cd api.
npm run start:dev
```

### Serve (Production)
```powershell
# Build first, then run
node api./dist/main.js
```

## 🔧 Troubleshooting

### Issue: Nx cannot find project
**Status:** Known issue due to Windows filesystem limitation with trailing dots.  
**Solution:** Use NestJS CLI directly or the provided scripts. The project is properly configured.

### Issue: Cannot access api. directory
**Solution:** Use Node.js commands (they work) or the run-api.ps1 script.

### Issue: Build fails
**Check:**
1. Dependencies installed: `npm install`
2. Prisma client generated: `npx prisma generate`
3. TypeScript compiles: `npx tsc --noEmit -p api./tsconfig.json`

## 🎯 Verification

Run this to verify everything is set up:
```powershell
node -e "
const fs = require('fs');
const path = require('path');
const apiDir = path.join(process.cwd(), 'api.');
console.log('✅ API directory exists:', fs.existsSync(apiDir));
console.log('✅ project.json exists:', fs.existsSync(path.join(apiDir, 'project.json')));
console.log('✅ main.ts exists:', fs.existsSync(path.join(apiDir, 'src', 'main.ts')));
console.log('✅ webpack.config.js exists:', fs.existsSync(path.join(apiDir, 'webpack.config.js')));
const proj = JSON.parse(fs.readFileSync(path.join(apiDir, 'project.json'), 'utf8'));
console.log('✅ Project name:', proj.name);
console.log('✅ Has build target:', !!proj.targets?.build);
console.log('✅ Has serve target:', !!proj.targets?.serve);
"
```

## 🚀 Next Steps

1. **Start the server:**
   ```powershell
   node -e "process.chdir('api.'); require('child_process').execSync('npx nest start --watch', {stdio: 'inherit'});"
   ```

2. **Test the API:**
   - Open: http://localhost:3000/api
   - Check health endpoints

3. **Debug if needed:**
   - Press F5 in VS Code
   - Or use: `node --inspect api./src/main.ts`

---

**Status:** ✅ **READY TO RUN AND DEBUG**

All configurations are complete. The project can be run and debugged using the methods above.
