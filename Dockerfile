FROM node:25-bookworm
COPY . /app
WORKDIR /app
RUN npm install -g pnpm@latest-10 && \
  pnpm install && \
  pnpm build && \
  pnpm next build && \
  cp .env.example .env
CMD ["pnpm", "start", "-p", "80"]
