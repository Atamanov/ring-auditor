import { base58, hex } from "@scure/base";

export function toHex(bytes: Uint8Array): string {
  return hex.encode(bytes);
}

export function toBase58(bytes: Uint8Array): string {
  return base58.encode(bytes);
}

const SOL_MINT = "11111111111111111111111111111111";

/** The SOL mint reads as SOL, any other mint stays a key. */
export function isSol(mint: string): boolean {
  return mint === SOL_MINT;
}

/** Lamports as SOL with the trailing zeros trimmed, other assets as raw units. */
export function formatAmount(amount: bigint, mint: string): string {
  if (!isSol(mint)) return amount.toString();
  const whole = amount / 1_000_000_000n;
  const frac = (amount % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole}${frac ? `.${frac}` : ""} SOL`;
}
