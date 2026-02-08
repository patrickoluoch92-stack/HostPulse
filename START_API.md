# 🚀 Start API Server - Quick Guide

## ✅ Project Configuration Status

The API project is **properly configured** but Nx has discovery issues due to Windows filesystem limitations with the `api.` directory name.

## 🎯 How to Run the API

### Method 1: Direct NestJS CLI (Recommended)
```powershell
# Navigate to API directory using Node.js (bypasses PowerShell limitation)
node -e "process.chdir('api.'); require('child_process').execSync('npx nest start --watch', {stdio: 'inherit'});"
```

### Method 2: Use the Run Script
```powershell
.\run-api.ps1
```

### Method 3: Manual Build and Run
```powershell
# Build first
node -e "require('child_process').execSync('npx webpack --config api./webpack.config.js --mode development', {stdio: 'inherit'});"

# Then run
node api./dist/main.js
```

### Method 4: Using ts-node (Development)
```powershell
node -e "process.chdir('api.'); require('child_process').execSync('npx ts-node src/main.ts', {stdio: 'inherit'});"
```

## 🐛 Debugging

### VS Code Debugging
1. Press **F5** or go to **Run and Debug**
2. Select **"Debug API (NestJS)"**
3. Set breakpoints in your code
4. The debugger will attach automatically

### Manual Debugging
```powershell
node --inspect-brk api./src/main.ts
# Then attach debugger to localhost:9229
```

## 📋 Project Details

- **Project Name:** `api`
- **Location:** `api./` directory  
- **Main File:** `api./src/main.ts`
- **Port:** 3000
- **API Base:** `http://localhost:3000/api`

## ✅ Configuration Verified

- ✅ `project.json` - Valid and configured
- ✅ `main.ts` - Exists and correct
- ✅ Build target - Webpack configured
- ✅ Serve target - Node.js with debugging
- ✅ VS Code launch configs - Created
- ✅ Package.json scripts - Added

## 🔧 If Nx Commands Don't Work

The project is registered in `nx.json`, but if `npx nx run api:build` doesn't work, use the alternative methods above. The configuration is correct - it's just a Windows filesystem limitation.

---

**Ready to run!** Use any of the methods above to start the API server.
