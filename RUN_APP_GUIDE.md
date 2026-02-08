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
npx nx run api:serve
```
- API: **http://127.0.0.1:3000/api**

### Run both (two terminals)
1. Terminal 1: `npx nx run api:serve`
2. Terminal 2: `npx nx run apps:dev` (or `.\run-frontend.ps1` for frontend)
3. Open **http://127.0.0.1:4200** for the app and **http://127.0.0.1:3000/api** for the API.

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
   Run `npx nx run apps:dev` (frontend) or `npx nx run api:serve` (backend). Wait until you see **“Ready”** or the “compiled” message before opening the browser.

3. **Use http (not https)** — ports 4200 (frontend) and 3000 (API).

4. **Check the terminal**
   If the dev command exits or shows an error, fix that before opening the browser.

5. **Firewall** — Allow Node.js through Windows Firewall (or temporarily disable to test).
