# Multi-stage: build the SPA with Node, serve the static output with nginx.
# Built from the repo root (see docker-compose.yml's `context: .`) because
# this is an npm workspace — the frontend needs its sibling packages/shared.
FROM node:22-slim AS build
WORKDIR /repo

COPY package.json ./
COPY frontend/package.json frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY extension/package.json extension/package.json
# No package-lock.json here on purpose: it was generated on Windows, and its
# pinned optional platform-specific binaries (Tailwind's native oxide
# engine) don't include the linux-x64 build this container needs. A fresh
# install correctly resolves them for whatever platform is actually building.
RUN npm install

COPY frontend/ frontend/
COPY packages/shared/ packages/shared/
WORKDIR /repo/frontend
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
