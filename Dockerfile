# Built with the Zolana TS SDK packed into .sdk/ by tools/rings-test-deploy.sh,
# the package.json link to the checkout is rewritten to that tarball.
FROM public.ecr.aws/docker/library/node:24-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03 AS builder

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
COPY package.json ./
COPY .sdk/ .sdk/
# Next standalone traces real paths, pnpm symlinks break it.
RUN echo "node-linker=hoisted" > .npmrc \
    && sed -i 's#"link:[^"]*"#"file:.sdk/heliuslabs-zolana.tgz"#' package.json \
    && pnpm install --no-frozen-lockfile
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
