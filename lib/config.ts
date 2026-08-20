import type { Address } from "@solana/kit";

// Service URLs are deployment settings, not page input. `.env.local` sets them.
export const RING_RPC_URL = process.env.NEXT_PUBLIC_RING_RPC_URL ?? "http://127.0.0.1:9485";
export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "http://127.0.0.1:9599";
export const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://127.0.0.1:9484";
export const PROVER_URL = process.env.NEXT_PUBLIC_PROVER_URL ?? "http://127.0.0.1:3701";
export const TREE = (process.env.NEXT_PUBLIC_ZOLANA_TREE ??
  "trEEbaNobcTESNmtsPBj3FX27q5sDCQePV2kb12FYho") as Address;
/** The ring's address lookup table, created once by the operator. */
export const RING_LOOKUP_TABLE = process.env.NEXT_PUBLIC_RING_LOOKUP_TABLE as Address | undefined;

export interface Ring {
  name: string;
  id: string;
  /** This ring's RPC. A local-mode RPC serves one ring, so each ring names its own. */
  rpc?: string;
}

export function ringRpcUrl(ring: Ring | undefined): string {
  return ring?.rpc?.trim() || RING_RPC_URL;
}

export function selectedRing(selection: RingSelection): Ring | undefined {
  return selection.rings.find((r) => r.id === selection.selected);
}

// The ring the page starts on. Others are added on the page and kept locally.
export const DEFAULT_RING: Ring = {
  name: process.env.NEXT_PUBLIC_RING_NAME ?? "Rings.fun",
  id: process.env.NEXT_PUBLIC_RING_PROGRAM_ID ?? "",
};

const STORAGE = "ring-auditor.rings";

export interface RingSelection {
  rings: Ring[];
  selected: string;
}

export function loadRings(): RingSelection {
  let stored: Partial<RingSelection> = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE) ?? "{}") as Partial<RingSelection>;
  } catch {
    // A corrupt entry falls back to the default ring.
  }
  const rings = [DEFAULT_RING, ...(stored.rings ?? []).filter((r) => r.id !== DEFAULT_RING.id)];
  const selected = rings.some((r) => r.id === stored.selected) ? stored.selected! : DEFAULT_RING.id;
  return { rings, selected };
}

export function saveRings(selection: RingSelection): void {
  localStorage.setItem(STORAGE, JSON.stringify(selection));
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
