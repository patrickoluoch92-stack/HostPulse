# 🚀 API Debugging and Running Guide

## ✅ Configuration Complete

The API project is properly configured, but Nx has issues discovering it due to Windows filesystem limitations with the trailing dot directory name (`api.`).

## 🎯 Quick Start

### Option 1: Using Nx (Recommended)
```powershell
# Build the project
npx nx run api:build --configuration=development

# Run/Serve the project
npx nx run api:serve
```

### Option 2: Using NestJS CLI Directly
```powershell
cd api.
npx nest start --watch
```

### Option 3: Using the Run Script
```powershell
.\run-api.ps1
```

## 🐛 Debugging in VS Code

1. **Open VS Code**
2. **Go to Run and Debug** (F5)
3. **Select "Debug API (NestJS)"** or **"Debug API (Built)"**
4. **Set breakpoints** in your code
5. **Press F5** to start debugging

The launch configurations are in `.vscode/launch.json`:
- **Debug API (NestJS)** - Runs TypeScript directly with ts-node
- **Debug API (Built)** - Runs the built JavaScript (requires build first)

## 📋 Project Configuration

### Project Details
- **Name:** `api`
- **Location:** `api./` directory
- **Main Entry:** `api./src/main.ts`
- **Build Output:** `dist/api./main.js`
- **Port:** 3000 (configurable via `PORT` env var)
- **API Prefix:** `/api`

### Nx Targets
- **build** - Webpack build with source maps
- **serve** - Node.js server with watch mode and debugging

### Environment Variables
Create `.env` in the root directory:
```env
PORT=3000
MPESA_CONSUMER_KEY=your-key
DATABASE_URL=postgresql://username:<REPLACE_WITH_DB_PASSWORD>@localhost:5432/hostpulse
JWT_ACCESS_SECRET=<REPLACE_WITH_JWT_ACCESS_SECRET>
MPESA_WEBHOOK_SECRET=<REPLACE_WITH_WEBHOOK_SECRET>

MPESA_CONSUMER_SECRET=<REPLACE_WITH_MPESA_CONSUMER_SECRET>
# ... other env vars
```

### Bootstrap Doctor Check
Run the doctor before starting API/frontend:
```powershell
npm run doctor
```
This validates required env values and regenerates Prisma Client.

## 🔧 Troubleshooting

### Issue: "Cannot find project api"
**Solution:** The project is registered in `nx.json` but Nx plugins may not discover it due to the trailing dot. Use direct commands:
```powershell
npx nx run api:build
npx nx run api:serve
```

### Issue: "Cannot access api. directory"
**Solution:** Use Node.js commands or the provided scripts. PowerShell has limitations with trailing dots.

### Issue: Build fails
**Solution:** 
1. Ensure all dependencies are installed: `npm install`
2. Generate Prisma client: `npx prisma generate`
3. Check TypeScript errors: `npx tsc --noEmit -p api./tsconfig.json`

## ✅ Verification Checklist

- [x] Project registered in `nx.json`
- [x] `project.json` configured with build and serve targets
- [x] `main.ts` exists and is correct
- [x] Webpack config exists
- [x] TypeScript config exists
- [x] VS Code launch configurations created
- [x] Run script created
- [x] Package.json scripts added

## 🎯 Next Steps

1. **Build the project:**
   ```powershell
   npx nx run api:build --configuration=development
   ```

2. **Run the server:**
   ```powershell
   npx nx run api:serve
   ```

3. **Or use NestJS CLI:**
   ```powershell
   cd api.
   npx nest start --watch
   ```

4. **Test the API:**
   - Open: http://localhost:3000/api
   - Health check endpoints should be available

---

**Status:** ✅ **Configuration Complete - Ready to Run**
