# The SDK dependency is a pinned zolana commit built from source on install.
FROM public.ecr.aws/docker/library/node:24-bookworm@sha256:934240a162082fd8b8a2f90cd5114446443f1eba1c5378f6687167ca405e6584 AS builder

ARG NEXT_PUBLIC_RING_RPC_URL
ARG NEXT_PUBLIC_SOLANA_RPC_URL
ARG NEXT_PUBLIC_INDEXER_URL
ARG NEXT_PUBLIC_PROVER_URL
ARG NEXT_PUBLIC_ZOLANA_TREE
ENV NEXT_PUBLIC_RING_RPC_URL=$NEXT_PUBLIC_RING_RPC_URL \
    NEXT_PUBLIC_SOLANA_RPC_URL=$NEXT_PUBLIC_SOLANA_RPC_URL \
    NEXT_PUBLIC_INDEXER_URL=$NEXT_PUBLIC_INDEXER_URL \
    NEXT_PUBLIC_PROVER_URL=$NEXT_PUBLIC_PROVER_URL \
    NEXT_PUBLIC_ZOLANA_TREE=$NEXT_PUBLIC_ZOLANA_TREE \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1

RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./
# Next standalone traces real paths, pnpm symlinks break it.
RUN echo "node-linker=hoisted" >> .npmrc && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM public.ecr.aws/docker/library/node:24-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
