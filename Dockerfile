FROM node:20-slim AS builder
WORKDIR /app

# Copy and build local schemas dependency first
COPY _schemas/ ./_schemas/
RUN cd _schemas && npm ci && npm run build

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
