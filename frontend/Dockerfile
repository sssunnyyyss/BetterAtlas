FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Development stage
FROM base AS development
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json ./
COPY packages/shared/ ./packages/shared/
COPY frontend/package.json ./frontend/
RUN pnpm config set node-linker hoisted
RUN pnpm install
COPY frontend/ ./frontend/
RUN pnpm --filter @betteratlas/shared build
WORKDIR /app/frontend
CMD ["pnpm", "dev"]

# Build stage for production
FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json ./
COPY packages/shared/ ./packages/shared/
COPY frontend/package.json ./frontend/
RUN pnpm config set node-linker hoisted
RUN pnpm install
COPY frontend/ ./frontend/
RUN pnpm --filter @betteratlas/shared build
RUN pnpm --filter frontend build

# Production stage with nginx
FROM nginx:alpine AS production
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
