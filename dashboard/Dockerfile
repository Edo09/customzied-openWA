# Debian/glibc base (node:20-alpine/musl breaks Vite/Rollup native binaries on ARM)
FROM node:22-slim AS builder

WORKDIR /app

# Build tools for native deps — mirrors the API Dockerfile, which builds fine on the VPS
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install deps. --legacy-peer-deps: vite@8 vs @vitejs/plugin-react peer(^7) conflict
# (works fine at runtime; npm 10 in the image is stricter than the npm 11 that wrote the lockfile)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
