# HostPulse Firebase Integration

## Services configured
- Hosting (`firebase.json`)
- Authentication (frontend Firebase Auth + backend token verification)
- Firestore (`firestore.rules`, `firestore.indexes.json`)
- Storage (`storage.rules`)
- Analytics (initialized in browser when supported)

## Required environment variables

Frontend (`.env.local`):
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)
- `NEXT_PUBLIC_API_BASE_URL` (recommended in production, e.g. `https://api.example.com/api`)

Backend (`.env`):
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Auth flow (hybrid)
1. Frontend signs in/up with Firebase Auth.
2. Frontend gets Firebase ID token (`getIdToken()`).
3. Frontend sends token to backend (`POST /api/auth/firebase/exchange`).
4. Backend verifies ID token with Firebase Admin.
5. Protected routes accept either:
   - Existing JWT token, or
   - Firebase ID token.

## Deploy steps
1. Login:
   - `npx -y firebase-tools@latest login`
2. Select project:
   - `npx -y firebase-tools@latest use --add <PROJECT_ID>`
3. Build app/backend as needed:
   - `npx nx run apps:dev` for local frontend
   - `npx nx run api:serve` for local API
4. Deploy Firebase:
   - `npx -y firebase-tools@latest deploy`
