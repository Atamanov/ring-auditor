import type { Address } from "@solana/kit";
import { parseReaderKey, ringRole as roleOf, type RingRole } from "@heliuslabs/zolana/ring";
import { zolanaClient } from "./client";

export type { RingRole };

export async function ringRole(ring: Address, readerKey: string): Promise<RingRole> {
  return roleOf({ rpc: await zolanaClient(), ring, reader: parseReaderKey(readerKey) });
}
