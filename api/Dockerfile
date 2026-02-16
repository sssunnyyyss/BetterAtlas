FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Development stage
FROM base AS development
# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json ./
COPY packages/shared/ ./packages/shared/
COPY api/package.json ./api/
# Install with hoisted node_modules (no symlinks to external store)
RUN pnpm config set node-linker hoisted
RUN pnpm install
# Copy remaining source
COPY api/ ./api/
# Build shared package
RUN pnpm --filter @betteratlas/shared build
WORKDIR /app/api
CMD ["pnpm", "dev"]

# Production stage
FROM base AS production
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json ./
COPY packages/shared/ ./packages/shared/
COPY api/package.json ./api/
RUN pnpm config set node-linker hoisted
# Need dev deps (tsc) to build shared and api packages inside the image.
RUN pnpm install
COPY api/ ./api/
RUN pnpm --filter @betteratlas/shared build
RUN pnpm --filter api build
WORKDIR /app/api
CMD ["node", "dist/index.js"]
