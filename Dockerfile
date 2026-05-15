FROM node:20-slim AS builder
WORKDIR /app

# Copy and build local schemas dependency first
COPY _schemas/ ./_schemas/
RUN cd _schemas && npm ci && npm run build

# Copy and build local tokens dependency (used by UI sub-package CSS imports)
COPY _tokens/ ./_tokens/
RUN cd _tokens && npm ci && npm run build

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm run build:ui

FROM node:20-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-matplotlib python3-numpy \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/ui/dist ./dist-ui
COPY --from=builder /app/_schemas ./_schemas
COPY --from=builder /app/_tokens ./_tokens
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts
COPY package.json ./

ENV PORT=8080
ENV PYTHON_BIN=python3
EXPOSE 8080
CMD ["node", "dist/index.js"]
