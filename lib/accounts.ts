import { createSolanaRpc, getBase64Encoder, type Address } from "@solana/kit";
import type { ZolanaClient } from "@heliuslabs/zolana/client";
import { SOLANA_RPC_URL } from "./config";

/** The SDK reads accounts through this, the page owns only the transport. */
export function accountReader(): Pick<ZolanaClient, "getMultipleAccounts"> {
  const rpc = createSolanaRpc(SOLANA_RPC_URL);
  return {
    getMultipleAccounts: async (addresses: readonly Address[]) => {
      const { value } = await rpc.getMultipleAccounts(addresses, { encoding: "base64" }).send();
      return value.map((account) =>
        account === null
          ? undefined
          : {
              owner: account.owner,
              data: new Uint8Array(getBase64Encoder().encode(account.data[0])),
              lamports: account.lamports,
            },
      );
    },
  } as Pick<ZolanaClient, "getMultipleAccounts">;
}
