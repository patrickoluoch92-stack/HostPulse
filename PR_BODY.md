Title: fix(auth,bookings): validation, docs sanitization, and dev-ex tooling

Summary
- Fixes registration/login → booking E2E flow by adding validation, normalizing auth inputs, and removing debug logs.
- Sanitizes example DB credentials in `.env.example` and setup docs.
- Dev DX: updates VS Code launch/tasks for Chrome debugging and auto-start frontend.

Changes
- `api/src/app/bookings/*`: Add `class-validator` decorators and restore payload handling so `ValidationPipe` no longer strips request bodies.
- `api/src/auth/auth.service.ts`: Normalize email on register/login and return `ConflictException` on duplicate register.
- `.env.example`, `SETUP_STATUS.md`, `SETUP_AND_RUN.ps1`, `COMPLETE_SETUP_GUIDE.md`: Replace example DB credentials with placeholders.
- `.vscode/*`: Update runtimeExecutable for Chrome and add preLaunch frontend task.

How to test (quick)
1. Start API:
   npx nx run api:serve
2. Start frontend (optional):
   npx nx run apps:dev
3. Smoke (register → login → booking):
   POST /api/auth/register
   POST /api/auth/login
   POST /api/bookings (with returned Bearer token)

Notes
- Branch: `fix/deps-url-parse` (pushed).
- I could not detect a `GITHUB_TOKEN` in the environment; open the compare URL below and create the PR manually if needed.

Compare URL
https://github.com/patrickoluoch92-stack/HostPulse/compare/main...fix/deps-url-parse?expand=1
