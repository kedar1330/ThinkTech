# syntax=docker/dockerfile:1
# StyleMe API image (DEPLOYMENT.md §4). Build from the repository root, because the API depends on
# packages/contracts:   docker build -f apps/api/Dockerfile -t styleme-api .
# Secrets are runtime environment variables and are never baked into the image.

FROM node:24.20.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
# The API tests' MongoDB binary isn't needed to build the image.
ENV MONGOMS_DISABLE_POSTINSTALL=1
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile --filter @styleme/api...
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @styleme/api build \
 && pnpm --filter @styleme/api deploy --prod --legacy /prod/api

FROM node:24.20.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /prod/api/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
COPY --from=build --chown=node:node /repo/apps/api/package.json ./package.json
USER node
# Render provides PORT; the server binds 0.0.0.0. 4000 is the local default.
EXPOSE 4000
CMD ["node", "dist/server.js"]
