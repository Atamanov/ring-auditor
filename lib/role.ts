import { createSolanaRpc, getBase64Encoder, type Address } from "@solana/kit";
import {
  auditorViewTag,
  decodeReaderRecord,
  decodeRingProgramConfig,
  readerKeyEquals,
  readerRecordAddress,
  ringConfigAddress,
  type ReaderKey,
  type RingProgramConfig,
  type RingRpcHealth,
} from "@heliuslabs/zolana/ring";
import { SOLANA_RPC_URL } from "./config";

export type RingRole = "authority" | "delegated reader" | "participant only";

type Rpc = ReturnType<typeof createSolanaRpc>;
type EncodedAccount = { readonly owner: Address; readonly data: readonly [string, string] } | null | undefined;

export async function ringRole(ring: Address, reader: ReaderKey): Promise<RingRole> {
  const rpc = createSolanaRpc(SOLANA_RPC_URL);
  const [configAddress, recordAddress] = await Promise.all([
    ringConfigAddress(ring),
    readerRecordAddress(ring, reader),
  ]);
  const { value } = await rpc
    .getMultipleAccounts([configAddress, recordAddress], { encoding: "base64" })
    .send();
  const [configAccount, recordAccount] = value;
  const config = decodeRingProgramConfig(requireConfig(ownedData(configAccount, ring)));
  if (readerKeyEquals(config.authority, reader)) return "authority";
  const record = ownedData(recordAccount, ring);
  if (record && readerKeyEquals(decodeReaderRecord(record).reader, reader)) {
    return "delegated reader";
  }
  return "participant only";
}

/** The RPC's auditor tag must match the ring config. */
export async function servesRing(ring: Address, health: RingRpcHealth): Promise<boolean> {
  const tag = health.auditorViewTag;
  if (!tag) return true;
  const config = await ringConfig(createSolanaRpc(SOLANA_RPC_URL), ring);
  return auditorViewTag(config.auditorPublicKey).every((byte, index) => byte === tag[index]);
}

async function ringConfig(rpc: Rpc, ring: Address): Promise<RingProgramConfig> {
  const { value } = await rpc.getAccountInfo(await ringConfigAddress(ring), { encoding: "base64" }).send();
  return decodeRingProgramConfig(requireConfig(ownedData(value, ring)));
}

function ownedData(account: EncodedAccount, owner: Address): Uint8Array | undefined {
  if (!account || account.owner !== owner) return undefined;
  return new Uint8Array(getBase64Encoder().encode(account.data[0]));
}

function requireConfig(data: Uint8Array | undefined): Uint8Array {
  if (!data) throw new Error("ring has no config on chain");
  return data;
}
