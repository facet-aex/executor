FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runner
RUN apk add --no-cache docker-cli
WORKDIR /app
ENV NODE_ENV=production FACET_RUN_WORKDIR=/var/lib/facet-runs
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force \
    && mkdir -p /var/lib/facet-runs && chown node:node /var/lib/facet-runs
COPY --from=builder /app/dist ./dist
COPY docker/bootstrap.mjs ./docker/bootstrap.mjs
USER node
EXPOSE 4030
CMD ["node", "dist/server.js"]
