FROM node:21-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY . .

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM ghcr.io/puppeteer/puppeteer:latest
WORKDIR /app
COPY --chown=pptruser:pptruser --from=prod-deps /app/node_modules /app/node_modules
COPY --chown=pptruser:pptruser --from=base /app /app
ENV PORT=3000
EXPOSE $PORT
USER pptruser
ENTRYPOINT [ "node", "index.js" ]
