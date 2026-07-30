FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/bot/package.json apps/bot/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/openai-realtime/package.json packages/openai-realtime/package.json
RUN npm install
COPY apps/dashboard apps/dashboard
ARG VITE_BOT_HEALTH_URL=http://localhost:3001/health
ENV VITE_BOT_HEALTH_URL=$VITE_BOT_HEALTH_URL
RUN npm run build -w @roomate-voice/dashboard

FROM nginx:1.27-alpine
COPY --from=build /app/apps/dashboard/dist /usr/share/nginx/html
EXPOSE 80
