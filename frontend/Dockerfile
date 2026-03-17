FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/out /usr/share/nginx/html

EXPOSE 10000

CMD ["sh", "-c", "sed -i 's/listen 80;/listen 10000;/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]