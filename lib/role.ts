import { createSolanaRpc, getBase64Encoder, type Address } from "@solana/kit";
import {
  decodeReaderRecord,
  decodeRingProgramConfig,
  readerRecordAddress,
  ringConfigAddress,
} from "@heliuslabs/zolana/ring";

// What the ring RPC will grant the wallet on the ring scope, read from chain.
export type RingRole = "authority" | "delegated reader" | "participant only";

export async function ringRole(
  solanaRpcUrl: string,
  ring: Address,
  wallet: Address,
): Promise<RingRole> {
  const rpc = createSolanaRpc(solanaRpcUrl);
  const [config, record] = await Promise.all([
    ringConfigAddress(ring),
    readerRecordAddress(ring, wallet),
  ]);
  const { value } = await rpc
    .getMultipleAccounts([config, record], { encoding: "base64" })
    .send();
  const [configAccount, recordAccount] = value;
  if (!configAccount || configAccount.owner !== ring) {
    throw new Error("ring has no config on chain");
  }
  const base64 = getBase64Encoder();
  const authority = decodeRingProgramConfig(
    new Uint8Array(base64.encode(configAccount.data[0])),
  ).authority;
  if (authority === wallet) return "authority";
  if (
    recordAccount &&
    recordAccount.owner === ring &&
    decodeReaderRecord(new Uint8Array(base64.encode(recordAccount.data[0]))).reader === wallet
  ) {
    return "delegated reader";
  }
  return "participant only";
}
