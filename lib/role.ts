import { createSolanaRpc, getBase64Encoder, type Address } from "@solana/kit";
import {
  auditorViewTag,
  decodeReaderRecord,
  decodeRingProgramConfig,
  readerKeyEquals,
  readerRecordAddress,
  ringConfigAddress,
  type ReaderKey,
  type RingRpcHealth,
} from "@heliuslabs/zolana/ring";

// What the ring RPC grants a key on the ring scope, read from chain.
export type RingRole = "authority" | "delegated reader" | "participant only";

export async function ringRole(
  solanaRpcUrl: string,
  ring: Address,
  reader: ReaderKey,
): Promise<RingRole> {
  const rpc = createSolanaRpc(solanaRpcUrl);
  const [config, record] = await Promise.all([
    ringConfigAddress(ring),
    readerRecordAddress(ring, reader),
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
  if (readerKeyEquals(authority, reader)) return "authority";
  if (
    recordAccount &&
    recordAccount.owner === ring &&
    readerKeyEquals(
      decodeReaderRecord(new Uint8Array(base64.encode(recordAccount.data[0]))).reader,
      reader,
    )
  ) {
    return "delegated reader";
  }
  return "participant only";
}

// A local-mode ring RPC serves one ring and ignores the ring id in requests,
// so a page pointed at the wrong RPC would show another ring's transactions.
// The auditor tag the RPC reports has to be the one the ring's config names.
export async function servesRing(
  solanaRpcUrl: string,
  ring: Address,
  health: RingRpcHealth,
): Promise<boolean> {
  if (!health.auditorViewTag) return true;
  const rpc = createSolanaRpc(solanaRpcUrl);
  const { value } = await rpc.getAccountInfo(await ringConfigAddress(ring), { encoding: "base64" }).send();
  if (!value || value.owner !== ring) return false;
  const config = decodeRingProgramConfig(new Uint8Array(getBase64Encoder().encode(value.data[0])));
  const expected = auditorViewTag(config.auditorPublicKey);
  return expected.every((byte, index) => byte === health.auditorViewTag![index]);
}
