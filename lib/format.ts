import { base58, hex } from "@scure/base";

export function toHex(bytes: Uint8Array): string {
  return hex.encode(bytes);
}

export function toBase58(bytes: Uint8Array): string {
  return base58.encode(bytes);
}
