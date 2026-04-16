# HostPulse – Run the App

## Backend and frontend (browser-friendly)

Both servers bind to **0.0.0.0** so the browser can connect.

### Frontend (Next.js) – port 4200

**Option A – Start and open browser (recommended if you get “connection refused”)**
```powershell
.\run-frontend.ps1
```
This starts the **API** and **Frontend** in separate windows, then opens **http://127.0.0.1:4200**. Both must run for login/register to work.

**Option B – Manual**
```powershell
npx nx run apps:dev
```
Wait until you see **“Ready”** or **“compiled”** in the terminal, then open: **http://127.0.0.1:4200**

### Backend (API) – port 3000
```powershell
npm run start:api
```
- API: **http://127.0.0.1:3000/api**

### Run both (two terminals)
1. Terminal 1: `npm run start:api`
2. Terminal 2: `npx nx run apps:dev` (or `.\run-frontend.ps1` for frontend)
3. Open **http://127.0.0.1:4200** for the app and **http://127.0.0.1:3000/api** for the API.

## Hospitality data expansion pipeline

This repository includes a reusable hospitality discovery and ingestion pipeline for Kenya.

```powershell
# full run (all counties)
npm run hospitality:sync -- --min-quality 5

# dry run (no inserts)
npm run hospitality:sync:dry
```

- Output report: `artifacts/hospitality-sync-report.json`
- API search endpoint: `GET /api/hospitality`
- API stats endpoint: `GET /api/hospitality/stats`

Example query:

```text
GET http://127.0.0.1:3000/api/hospitality?county=Nairobi&category=hotel&page=1&pageSize=10
```

To run periodically, schedule:

```bash
0 2 * * * cd /workspace && npm run hospitality:sync -- --min-quality 5 >> /workspace/artifacts/hospitality-sync-cron.log 2>&1
```

## Other options

### Run API script
```powershell
.\run-api.ps1
```

### VS Code debugging
1. Press **F5**, choose **"Debug API (NestJS)"**
2. Backend listens on `0.0.0.0` by default so the browser can connect.

## If you get “Connection refused” (ERR_CONNECTION_REFUSED)

1. **Use 127.0.0.1 instead of localhost**  
   On some Windows setups this fixes “connection refused”: **http://127.0.0.1:4200** (frontend), **http://127.0.0.1:3000/api** (backend).

2. **Start the server first**  
   Run `npx nx run apps:dev` (frontend) or `npm run start:api` (backend). Wait until you see **“Ready”** or the “compiled” message before opening the browser.

3. **Use http (not https)** — ports 4200 (frontend) and 3000 (API).

4. **Check the terminal**
   If the dev command exits or shows an error, fix that before opening the browser.

5. **Firewall** — Allow Node.js through Windows Firewall (or temporarily disable to test).
