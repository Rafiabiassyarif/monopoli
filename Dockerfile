# Monopoli 3D — satu container: server WebSocket + web hasil build.
#   docker build -t monopoli .
#   docker run -p 3020:3020 -v monopoli-data:/app/packages/server/data monopoli
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3020
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN npm ci --no-audit --no-fund --omit=dev -w @monopoli/server -w @monopoli/engine && npm cache clean --force
COPY packages/engine packages/engine
COPY packages/server packages/server
COPY --from=build /app/packages/web/dist packages/web/dist
EXPOSE 3020
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3020/health || exit 1
CMD ["npm", "start"]
