import type { WalletContextState } from "@solana/wallet-adapter-react";
import { readerKeyBytes, type RingReadSigner } from "@heliuslabs/zolana/ring";
import { walletAddress } from "./chain";

export function walletSigner(wallet: WalletContextState): RingReadSigner | undefined {
  const address = walletAddress(wallet);
  const { signMessage } = wallet;
  if (!address || !signMessage) return undefined;
  return { reader: readerKeyBytes(address), sign: signMessage };
}
