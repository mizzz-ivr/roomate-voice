FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
COPY apps/bot/package.json apps/bot/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/openai-realtime/package.json packages/openai-realtime/package.json
RUN npm install
COPY tsconfig.base.json ./
COPY apps/bot apps/bot
COPY packages packages
RUN npm run build:packages && npm run build -w @roomate-voice/bot

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY apps/bot/package.json apps/bot/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/openai-realtime/package.json packages/openai-realtime/package.json
RUN npm install --omit=dev
COPY --from=build /app/apps/bot/dist apps/bot/dist
COPY --from=build /app/packages/config/dist packages/config/dist
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/openai-realtime/dist packages/openai-realtime/dist
EXPOSE 3001
CMD ["node", "apps/bot/dist/index.js"]
