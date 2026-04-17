<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.

<!-- nx configuration end-->

## Cursor Cloud specific instructions

### Services overview

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| PostgreSQL 18 | `sudo pg_ctlcluster 18 main start` | 5432 | Must start before API; user `postgres`/`postgres`, database `hostpulse` |
| NestJS API | `npx nx run api:serve` | 3000 | Global prefix `/api`; binds `0.0.0.0` (IPv4 only) |
| Next.js Frontend | `npx nx run apps:dev` | 4200 | Proxies `/api-proxy/*` to `http://127.0.0.1:3000/api` |

### Running the environment

1. Start PostgreSQL: `sudo pg_ctlcluster 18 main start`
2. Copy `.env.example` to `.env` if missing and set `DATABASE_URL` (password `postgres` for local dev).
3. Generate Prisma client: `npx prisma generate --schema=prisma/schema.prisma`
4. Apply migrations: `npx prisma migrate dev --schema=prisma/schema.prisma`
5. Start the API: `npx nx run api:serve` (in a separate terminal/tmux session)
6. Start the frontend: `npx nx run apps:dev` (in a separate terminal/tmux session)

### Gotchas

- **No ESLint configured.** The repo has no lint targets. Use `npx nx run-many --target=typecheck` for static checks.
- **IPv6 issue.** The API binds to `0.0.0.0` (IPv4 only). Always use `127.0.0.1` instead of `localhost` when testing endpoints, because `localhost` may resolve to `::1` (IPv6) first.
- **Playwright e2e config mismatch.** The `apps-e2e/playwright.config.ts` sets `webServer.url` to `http://localhost:3000` but the frontend runs on port 4200. This causes Playwright to fail when `localhost` resolves to IPv6. To run e2e tests, either fix the config or stop the dev server and let the nx e2e target start it automatically.
- **API e2e tests.** The `api.-e2e` project has no test spec files; it only contains jest config and support files.
- **Prisma schema path.** Always pass `--schema=prisma/schema.prisma` to Prisma CLI commands; the schema lives at the workspace root under `prisma/`.
- **Seed data.** Use `node scripts/seed-test-property.js` to create a test property (requires at least one user to exist as hostId=1).
