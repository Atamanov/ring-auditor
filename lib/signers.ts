import { readerKeyBytes, type RingReadSigner } from "@heliuslabs/zolana/ring";
import type { Address } from "@solana/kit";

export interface MessageWallet {
  publicKey: { toBase58(): string } | null;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
}

export function walletSigner(wallet: MessageWallet): RingReadSigner | undefined {
  const { publicKey, signMessage } = wallet;
  if (!publicKey || !signMessage) return undefined;
  return { reader: readerKeyBytes(publicKey.toBase58() as Address), sign: signMessage };
}
