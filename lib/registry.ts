import { createSolanaRpc, getBase64Encoder, type Address } from "@solana/kit";
import { fetchViewingKeyOwners, viewingKeyIndex } from "@heliuslabs/zolana";
import { SOLANA_RPC_URL } from "./config";

/** Viewing key, as `viewingKeyIndex` writes it, to the address that published it. */
export type Owners = ReadonlyMap<string, Address>;

export const NO_OWNERS: Owners = new Map();

export { viewingKeyIndex };

/**
 * The SDK decodes and indexes the registry, the page only reads the accounts.
 *
 * A whole `ZolanaClient` loads the hasher, which an account listing has no use
 * for, so the read goes straight through kit.
 */
export function registeredOwners(): Promise<Owners> {
  const rpc = createSolanaRpc(SOLANA_RPC_URL);
  return fetchViewingKeyOwners({
    rpc: {
      getProgramAccounts: async (programId: Address) =>
        (await rpc.getProgramAccounts(programId, { encoding: "base64" }).send()).map(
          ({ pubkey, account }) => ({
            address: pubkey,
            account: {
              owner: account.owner,
              data: new Uint8Array(getBase64Encoder().encode(account.data[0])),
              lamports: account.lamports,
            },
          }),
        ),
    },
  });
}
