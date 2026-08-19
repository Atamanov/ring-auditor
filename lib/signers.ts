import { p256 } from "@noble/curves/nist.js";
import { hex } from "@scure/base";
import type { Signer } from "./ringRpc.ts";

export interface MessageWallet {
  publicKey: { toBytes(): Uint8Array } | null;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
}

// The connected wallet is the reader. Its ed25519 key is the ring authority
// for the ring scope, or a transaction signer for the participant scope.
export function walletSigner(wallet: MessageWallet): Signer | undefined {
  const { publicKey, signMessage } = wallet;
  if (!publicKey || !signMessage) return undefined;
  return { reader: publicKey.toBytes(), sign: signMessage };
}

// A recipient's P-256 viewing secret (32 bytes as hex). The server verifies
// ECDSA over SHA-256 of the message, so the signature is made over the hash.
export function viewingKeySigner(secretHex: string): Signer {
  const secret = hex.decode(secretHex.trim().toLowerCase());
  return {
    reader: p256.getPublicKey(secret, true),
    sign: async (message) => p256.sign(message, secret, { prehash: true }),
  };
}
