import { hex } from "@scure/base";
import { ViewingKey, type Bytes32 } from "@heliuslabs/zolana/keypair";
import { viewingKeyReader, type RingReadSigner } from "@heliuslabs/zolana/ring";

export interface MessageWallet {
  publicKey: { toBytes(): Uint8Array } | null;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
}

// The connected wallet is the reader. Its ed25519 key is the ring authority
// for the ring scope, or a transaction signer for the participant scope.
export function walletSigner(wallet: MessageWallet): RingReadSigner | undefined {
  const { publicKey, signMessage } = wallet;
  if (!publicKey || !signMessage) return undefined;
  return { reader: publicKey.toBytes(), sign: signMessage };
}

// A recipient's P-256 viewing secret (32 bytes as hex) sees its own outputs.
export function viewingKeySigner(secretHex: string): RingReadSigner {
  return viewingKeyReader(
    ViewingKey.fromBytes(hex.decode(secretHex.trim().toLowerCase()) as Bytes32),
  );
}
