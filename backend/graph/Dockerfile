FROM node:22-slim AS build

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @graph/shared-types build \
 && pnpm --filter @graph/chart-utils build \
 && pnpm --filter @graph/chart-client build \
 && pnpm --filter @graph/api-server build

FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable

COPY --from=build /app /app

EXPOSE 8080

CMD ["node", "apps/api-server/dist/server.js"]
