# syntax=docker/dockerfile:1.7

# ---- prod-deps (runtime node_modules only) ----
FROM node:22-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# ---- deps (full, for build) ----
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ---- build ----
FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma.config.ts loads env via Zod; provide a throwaway URL so generate
# doesn't fail — it does not connect at this stage.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000" \
    npx prisma generate
RUN npm run build

# ---- runtime-base (shared) ----
FROM node:22-slim AS runtime-base
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist       ./dist
COPY --from=build --chown=node:node /app/generated  ./generated
COPY --from=build --chown=node:node /app/prisma     ./prisma
# prisma migrate deploy reads prisma.config.ts at runtime; that file imports
# ./src/config/env.js, so ship the compiled env.js at the resolved path.
COPY --from=build --chown=node:node /app/prisma.config.ts       ./prisma.config.ts
COPY --from=build --chown=node:node /app/dist/src/config/env.js ./src/config/env.js
COPY --chown=node:node package.json package-lock.json ./

# ---- runtime-api ----
FROM runtime-base AS runtime-api
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT:-5000}/health" || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/src/app.js"]

# ---- runtime-worker ----
# Use Debian instead of Alpine because Railpack's mise dependency expects glibc
FROM runtime-base AS runtime-worker

ENV RAILPACK_STATE_DIR=/var/lib/railpack
ENV TMPDIR=/var/lib/railpack/tmp
ENV HOME=/var/lib/railpack/home
ENV XDG_CACHE_HOME=/var/lib/railpack/cache
ENV MISE_CACHE_DIR=/var/lib/railpack/mise/cache
ENV MISE_DATA_DIR=/var/lib/railpack/mise/data
ENV MISE_CONFIG_DIR=/var/lib/railpack/mise/config

ARG RAILPACK_VERSION=0.23.0
ARG DOCKER_VERSION=27.3.1
ARG BUILDX_VERSION=0.17.1

# mkdir FIRST — TMPDIR is set via ENV above, so apt-get's ca-certificates
# postinst calls mktemp against a path that must already exist.
RUN mkdir -p \
      "${RAILPACK_STATE_DIR}/tmp" \
      "${RAILPACK_STATE_DIR}/cache" \
      "${RAILPACK_STATE_DIR}/home" \
      "${RAILPACK_STATE_DIR}/mise/cache" \
      "${RAILPACK_STATE_DIR}/mise/data" \
      "${RAILPACK_STATE_DIR}/mise/config" \
    && apt-get update && apt-get install -y --no-install-recommends \
    git \
    bash \
    curl \
    ca-certificates \
    xz-utils \
    && rm -rf /var/lib/apt/lists/* \
    \
    # Detect architecture
    && ARCH="$(dpkg --print-architecture)" \
    && railpack_arch="$(echo $ARCH | sed 's/amd64/x86_64/')-unknown-linux-musl" \
    && docker_arch="$(echo $ARCH | sed -e 's/amd64/x86_64/' -e 's/arm64/aarch64/')" \
    \
    # Install Railpack
    && curl -fsSL \
      "https://github.com/railwayapp/railpack/releases/download/v${RAILPACK_VERSION}/railpack-v${RAILPACK_VERSION}-${railpack_arch}.tar.gz" \
      | tar -xz -C /usr/local/bin railpack \
    \
    # Install Docker CLI (static binary — no daemon)
    && curl -fsSL \
      "https://download.docker.com/linux/static/stable/${docker_arch}/docker-${DOCKER_VERSION}.tgz" \
      | tar -xz --strip-components=1 -C /usr/local/bin docker/docker \
    \
    # Install Docker buildx CLI plugin (system-wide path so it works for any HOME)
    && mkdir -p /usr/local/lib/docker/cli-plugins \
    && curl -fsSL \
      "https://github.com/docker/buildx/releases/download/v${BUILDX_VERSION}/buildx-v${BUILDX_VERSION}.linux-${ARCH}" \
      -o /usr/local/lib/docker/cli-plugins/docker-buildx \
    && chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx \
    \
    # Verify installs
    && railpack --version \
    && docker --version \
    && docker buildx version

CMD ["sh", "-c", "mkdir -p \"$RAILPACK_STATE_DIR/tmp\" \"$RAILPACK_STATE_DIR/cache\" \"$RAILPACK_STATE_DIR/home\" \"$RAILPACK_STATE_DIR/mise/cache\" \"$RAILPACK_STATE_DIR/mise/data\" \"$RAILPACK_STATE_DIR/mise/config\" && exec node dist/src/worker.js"]
