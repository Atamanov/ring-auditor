import { createZolanaClient } from "@heliuslabs/zolana";
import { RingRpc } from "@heliuslabs/zolana/ring";
import { INDEXER_URL, PROVER_URL, SOLANA_RPC_URL, TREE } from "./config";

export type ZolanaClient = Awaited<ReturnType<typeof createZolanaClient>>;

let client: Promise<ZolanaClient> | undefined;

/** The first call loads the hasher. */
export function zolanaClient(): Promise<ZolanaClient> {
  client ??= createZolanaClient({
    solanaRpcUrl: SOLANA_RPC_URL,
    indexerUrl: INDEXER_URL,
    proverUrl: PROVER_URL,
    tree: TREE,
    allowInsecureHttp: true,
  });
  return client;
}

export function ringRpc(url: string): RingRpc {
  return new RingRpc(url, { allowInsecureHttp: true });
}
