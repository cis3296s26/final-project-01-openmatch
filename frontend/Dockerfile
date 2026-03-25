FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Remove .env.local to prevent it from overriding production env vars
RUN rm -f .env.local

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_WS_BASE_URL

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_WS_BASE_URL=$NEXT_PUBLIC_WS_BASE_URL

RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/out /usr/share/nginx/html

# Use Render's PORT env var, defaulting to 10000 if not set
CMD sh -c "sed -i 's/listen 80;/listen ${PORT:-10000};/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"