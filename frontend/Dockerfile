# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (cache layer)
COPY package.json package-lock.json ./
RUN npm install --force

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: serve ───────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

# Remove default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets
COPY --from=builder /app/build /usr/share/nginx/html

# Nginx config: single-page app (redirect 404 → index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
