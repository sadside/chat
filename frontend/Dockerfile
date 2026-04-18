# ─── Stage 1: development ───────────────────────────────────────────────────
FROM node:20-alpine AS dev

WORKDIR /app

# Install deps first (cached layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

EXPOSE 5173

# Vite must bind to 0.0.0.0 inside container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


# ─── Stage 2: builder ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Accept build-time VITE_API_URL so the bundle bakes in the right URL
ARG VITE_API_URL=http://localhost:8080/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


# ─── Stage 3: production (nginx) ────────────────────────────────────────────
FROM nginx:1.27-alpine AS prod

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/nova.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
