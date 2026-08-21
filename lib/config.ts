import { isAddress, type Address } from "@solana/kit";
import { asRecord } from "./storage";

// Service URLs are deployment settings, not page input. `.env.local` sets them.
export const RING_RPC_URL = process.env.NEXT_PUBLIC_RING_RPC_URL ?? "http://127.0.0.1:9485";
export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "http://127.0.0.1:9599";
export const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://127.0.0.1:9484";
export const PROVER_URL = process.env.NEXT_PUBLIC_PROVER_URL ?? "http://127.0.0.1:3701";
export const TREE = (process.env.NEXT_PUBLIC_ZOLANA_TREE ??
  "trEEbaNobcTESNmtsPBj3FX27q5sDCQePV2kb12FYho") as Address;

export interface Ring {
  readonly name: string;
  readonly id: Address;
  /** Overrides RING_RPC_URL. */
  readonly rpc?: string;
  /** Operator table, else one is created on first transfer. */
  readonly lookupTable?: Address;
}

export interface RingSelection {
  readonly rings: readonly Ring[];
  readonly selected: Address | undefined;
}

export const NO_RINGS: RingSelection = { rings: [], selected: undefined };

export function ringRpcUrl(ring: Ring | undefined): string {
  return ring?.rpc ?? RING_RPC_URL;
}

export function selectedRing(selection: RingSelection): Ring | undefined {
  return selection.rings.find((r) => r.id === selection.selected);
}

export function withRing(selection: RingSelection, ring: Ring): RingSelection {
  return { rings: [...selection.rings.filter((r) => r.id !== ring.id), ring], selected: ring.id };
}

export function withoutRing(selection: RingSelection, id: Address): RingSelection {
  const rings = selection.rings.filter((r) => r.id !== id);
  return { rings, selected: rings[0]?.id };
}

export function parseRingSelection(stored: unknown): RingSelection {
  const raw = asRecord(stored);
  const rings = (Array.isArray(raw.rings) ? raw.rings : []).flatMap((entry) => {
    const r = asRecord(entry);
    if (typeof r.name !== "string" || !r.name || typeof r.id !== "string" || !isAddress(r.id)) {
      return [];
    }
    const ring: Ring = {
      name: r.name,
      id: r.id,
      ...(typeof r.rpc === "string" && r.rpc ? { rpc: r.rpc } : {}),
      ...(typeof r.lookupTable === "string" && isAddress(r.lookupTable)
        ? { lookupTable: r.lookupTable }
        : {}),
    };
    return [ring];
  });
  const selected = rings.find((r) => r.id === raw.selected)?.id ?? rings[0]?.id;
  return { rings, selected };
}

/** Solana Explorer link for a transaction on the configured cluster. */
export function explorerTxUrl(signature: string): string {
  const url = new URL(`https://explorer.solana.com/tx/${signature}`);
  if (/devnet/.test(SOLANA_RPC_URL)) url.searchParams.set("cluster", "devnet");
  else if (/testnet/.test(SOLANA_RPC_URL)) url.searchParams.set("cluster", "testnet");
  else if (!/mainnet/.test(SOLANA_RPC_URL)) {
    url.searchParams.set("cluster", "custom");
    url.searchParams.set("customUrl", SOLANA_RPC_URL);
  }
  return url.href;
}
