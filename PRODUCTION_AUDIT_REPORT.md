# HostPulse Production Readiness Audit

## 1. Issues Found Before Fixing

- Root workspace scripts were incomplete: `npm run dev`, `npm run build`, and API smoke tests were missing.
- The active backend auth stack used insecure JWT fallback secrets in the live `app/auth` module.
- The Nest bootstrap lacked production middleware for `helmet`, rate limiting, request IDs, and structured request logging.
- The global exception filter returned unstructured error logs and did not expose request IDs for tracing.
- `ListingsModule` started using the shared auth guard without importing the auth module, which broke runtime dependency resolution.
- `FinancialsController` and several listings ingestion/job endpoints were authenticated but not role-restricted for admin access.
- The M-Pesa callback alias route `/api/mpesa/callback` was not guarded.
- Payment verification and escrow endpoints did not enforce ownership/admin access.
- The payment flow trusted callback metadata too loosely, logged sensitive webhook data, and reused weak timestamp-only idempotency keys.
- Booking creation did not validate authenticated user presence, date order, or overlapping bookings.
- The health endpoint returned degraded database states with a success HTTP status.
- The frontend production config used `output: export`, which breaks API rewrites/proxying for the booking flow.
- Prisma schema hot paths were missing important indexes and uniqueness guarantees for payment/webhook idempotency.
- Backend Docker packaging was missing.
- Existing API e2e coverage did not exercise the real app and the repo lacked a simple reproducible smoke test path.

## 2. Fixes Applied

### Workspace and Build

- Added root scripts for `dev`, `dev:api`, `dev:frontend`, `typecheck`, `build`, `build:api`, `build:frontend`, `start`, and `test:api`.
- Switched backend production builds to `nest build`, which is stable in this workspace.
- Added helper scripts:
  - `scripts/dev.js`
  - `scripts/typecheck.js`
  - `scripts/api-smoke-tests.js`
  - `scripts/run-nx.js`
- Updated README commands to match the verified workflow.

### Backend Security and Stability

- Replaced insecure JWT fallback usage with environment-backed configuration via `AppConfigService`.
- Added stricter environment validation for production secrets, rate limits, callback URLs, and M-Pesa IP allowlists.
- Added structured JSON logging and per-request request IDs.
- Added `helmet` and global/auth-specific rate limiting.
- Tightened the global validation pipe with `forbidNonWhitelisted`.
- Updated the exception filter to include request IDs and work with structured logging.
- Added admin role enforcement using `Roles` / `RolesGuard`.
- Restricted admin financial endpoints and listings ingestion/job endpoints to admins.
- Fixed `ListingsModule` dependency wiring for shared auth.

### Booking and Payments

- Added authenticated user validation, date validation, overlap checks, and persisted booking date metadata.
- Enforced ownership checks for payment verification and escrow status access.
- Restricted manual escrow release to admin users only.
- Guarded the M-Pesa callback alias route.
- Strengthened M-Pesa callback processing with:
  - duplicate callback protection
  - amount mismatch checks
  - phone mismatch checks
  - safer logging
  - deterministic payment idempotency keys
  - pending-payment reuse window to reduce duplicate STK requests
- Persisted `escrowReleasedBy` on manual release.

### Database

- Added Prisma schema indexes and unique constraints for:
  - `Payment.mpesaTxId`
  - `Payment.idempotencyKey`
  - payment lookup/status fields
  - `RevenueRecord.bookingId`
  - booking overlap query fields
  - host/user role hot paths
- Added migration:
  - `prisma/migrations/20260420151000_prod_hardening_indexes/migration.sql`
- Regenerated Prisma client after schema changes.

### Frontend and Deployment

- Removed the static-export-only frontend behavior that conflicted with API rewrites.
- Updated Next metadata for production branding.
- Kept frontend type safety in the repo-level `typecheck` step while allowing Next’s build to skip duplicate type validation.
- Added `.dockerignore` and a production `Dockerfile` for the backend service.
- Updated `.env.example` to reflect the real runtime contract and removed embedded credential-like defaults.

### Testing and Health

- Kept `/health` but changed degraded DB responses to return HTTP `503`.
- Added `npm run test:api` smoke coverage for:
  - `/health`
  - auth validation failure
  - booking auth protection
  - webhook payload validation

## 3. Remaining Risks

- Firebase auth, Google Places ingestion, and Redis background jobs still depend on real environment configuration and were not enabled in the current local environment.
- M-Pesa live callback reachability cannot be fully proven from this local workspace alone; the code path is hardened, but public callback delivery still depends on deployed HTTPS infrastructure and Safaricom credentials.
- I did not run a Docker build in this environment, so the Dockerfile is prepared but not runtime-validated here.
- The repo still contains legacy module trees (`api/src/auth`, `api/src/bookings`, `api/src/app/payments`) that are not on the active runtime path. They are no longer critical blockers, but they should be cleaned up in a follow-up refactor to reduce maintenance risk.

## 4. Deploy Steps

### Backend (Render / Railway / AWS)

1. Copy `.env.example` to your real secret store and set production values.
2. Provision PostgreSQL and apply:
   - `npm run prisma:generate`
   - `npx prisma migrate deploy --schema=prisma/schema.prisma`
3. Build and verify:
   - `npm run build`
   - `npm run test:api`
4. Start the API with:
   - `npm start`
5. Set a public HTTPS `API_BASE_URL` and `MPESA_CALLBACK_URL`.
6. Set `MPESA_IP_WHITELIST` to the real Safaricom source IPs before enabling production callbacks.

### Frontend (Vercel)

1. Use the `apps/` directory as the Vercel project root.
2. Set:
   - `NEXT_PUBLIC_API_BASE_URL=https://your-api-domain/api`
   - Firebase client env vars if using Firebase auth
3. Build command:
   - `npm run build:frontend`
4. Deploy after backend is reachable from the public frontend domain listed in `CORS_ORIGINS`.

### Docker Backend

1. Build:
   - `docker build -t hostpulse-api .`
2. Run:
   - `docker run --env-file .env -p 3000:3000 hostpulse-api`

## 5. Scaling Recommendations

- Move request logs to a centralized sink such as Datadog, Loki, or CloudWatch using the structured JSON format now emitted by the API.
- Add a dedicated payments reconciliation job that periodically queries unresolved M-Pesa transactions and alerts on stuck pending payments.
- Add Redis-backed queue workers for ingestion and delayed payout/escrow workflows instead of relying on in-process scheduling alone.
- Split the legacy and active backend module trees so only one auth/payments path exists.
- Add targeted integration tests around booking overlap, payment verification, and admin authorization before expanding the feature set.
