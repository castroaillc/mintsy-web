# syntax=docker/dockerfile:1
# Build from the REPO ROOT (the lockfile lives there):
#   docker build -f apps/backend/Dockerfile .
# apps/backend/Dockerfile.dockerignore keeps the context to the backend and the root manifests.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
RUN pnpm install --frozen-lockfile --filter mintsy-backend...
COPY apps/backend/tsconfig.json apps/backend/
COPY apps/backend/src apps/backend/src
# deploy writes package.json + production-only node_modules for the backend to /out
RUN pnpm --filter mintsy-backend build \
  && pnpm --filter mintsy-backend deploy --prod /out

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/package.json ./
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/backend/dist ./dist
USER node
# Cloud Run provides PORT (8080); src/env.ts reads it
EXPOSE 8080
CMD ["node", "dist/index.js"]
