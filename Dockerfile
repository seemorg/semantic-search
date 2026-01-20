ARG NODE_VERSION=22.12.0
FROM node:${NODE_VERSION}-slim AS base

# NestJS app lives here
WORKDIR /app

# Set production environment
ENV PORT=3000
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g corepack@latest
RUN corepack enable

FROM base AS builder

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM base AS runner
COPY --from=builder /app /app
ENV NODE_ENV="production"

EXPOSE ${PORT}

CMD [ "pnpm", "start" ]
