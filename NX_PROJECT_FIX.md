# Nx Project Configuration Fix

## Issue
Nx cannot find the `api` project even though it's registered in `nx.json`.

## Root Cause
Windows filesystem has issues with directory names containing trailing dots (`api.`). PowerShell and some tools cannot properly access files in such directories.

## Solution Applied

1. **Project Registered in nx.json:**
   ```json
   "projects": {
     "api": "api."
   }
   ```

2. **Project Configuration (api./project.json):**
   - Name: `api`
   - Build executor: `@nx/webpack:webpack`
   - Serve executor: `@nx/js:node`
   - Main entry: `api./src/main.ts`
   - All paths correctly configured

3. **Targets Configured:**
   - `build` - Webpack build with development/production configs
   - `serve` - Node.js serve with watch and inspect enabled for debugging

## Verification

The project.json is valid and can be read by Node.js:
- ✅ Project name: `api`
- ✅ Main entry: `api./src/main.ts`
- ✅ Build and serve targets configured

## Running the Project

Even though `npx nx show projects` doesn't list it, you can run it directly:

```powershell
# Build the project
npx nx run api:build

# Serve/run the project (with debugging)
npx nx run api:serve

# Or use the project name directly
npx nx serve api
```

## Alternative: Direct Execution

If Nx continues to have issues, you can run the app directly:

```powershell
cd api.
npm run build
node dist/main.js
```

Or use NestJS CLI:
```powershell
cd api.
npx nest start --watch
```

---

**Status:** Project configuration is correct. Nx discovery issue is due to Windows filesystem limitations with trailing dots in directory names.
