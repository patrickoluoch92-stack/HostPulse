## HostPulse

HostPulse is a full-stack booking app focused on Kenya's hospitality and tourism sector. It enables bookings for vacation rentals, resorts, lodges, hotels, tours, and travel companies, and aims to provide features like AI-powered recommendations, real-time availability syncing, and geo-location support.

## Developer Notes

This repository is an Nx workspace that contains a NestJS API and a Next.js frontend. For workspace-level tooling and tasks the Nx documentation is still useful — e.g. `npx nx graph` to explore the project graph, `npx nx <target> <project>` to run tasks, or `npx nx sync` to refresh TypeScript project references.

Basic commands:

```sh
# bootstrap validation (env + prisma client)
npm run doctor

# run the API in development (with doctor precheck)
npm run start:api

# run the API in development
npm --prefix api run start:dev

# start the frontend in dev mode (from workspace root)
npx nx run apps:dev

# generate or build packages using nx generators or build targets
npx nx build <project>
```

See the rest of the workspace documentation files for setup, run guides, and developer tooling tips.
