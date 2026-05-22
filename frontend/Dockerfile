# Stage 1 — сборка React приложения
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2 — nginx раздаёт статику
# Кладём конфиг в /etc/nginx/templates/ — nginx автоматически
# подставляет переменные окружения (в т.ч. $PORT) при старте
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

CMD ["nginx", "-g", "daemon off;"]
