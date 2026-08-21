import { SOL_MINT } from "@heliuslabs/zolana";
import { base58, hex } from "@scure/base";

const LAMPORTS_PER_SOL = 1_000_000_000n;

export function toHex(bytes: Uint8Array): string {
  return hex.encode(bytes);
}

export function toBase58(bytes: Uint8Array): string {
  return base58.encode(bytes);
}

export function isSol(mint: string): boolean {
  return mint === SOL_MINT;
}

/** Lamports as SOL with the trailing zeros trimmed, other assets as raw units. */
export function formatAmount(amount: bigint, mint: string = SOL_MINT): string {
  if (!isSol(mint)) return amount.toString();
  const whole = amount / LAMPORTS_PER_SOL;
  const frac = (amount % LAMPORTS_PER_SOL).toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole}${frac ? `.${frac}` : ""} SOL`;
}

/** Zero is rejected. */
export function parseSol(text: string): bigint | undefined {
  const match = /^(\d+)(?:\.(\d{1,9}))?$/.exec(text.trim());
  if (!match) return undefined;
  const [, whole = "0", frac = ""] = match;
  const lamports = BigInt(whole) * LAMPORTS_PER_SOL + BigInt(frac.padEnd(9, "0"));
  return lamports > 0n ? lamports : undefined;
}

export function shortKey(value: string, head = 4, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${tail ? value.slice(-tail) : ""}`;
}
