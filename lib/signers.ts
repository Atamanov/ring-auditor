import { hex } from "@scure/base";
import { ViewingKey, ed25519DerivationPayload, type Bytes32 } from "@heliuslabs/zolana/keypair";
import { viewingKeyReader, type RingReadSigner } from "@heliuslabs/zolana/ring";

export interface MessageWallet {
  publicKey: { toBytes(): Uint8Array } | null;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
}

// The connected wallet is the reader. Its ed25519 key is the ring authority or a
// granted reader for the ring scope, or a transaction signer for the participant
// scope.
export function walletSigner(wallet: MessageWallet): RingReadSigner | undefined {
  const { publicKey, signMessage } = wallet;
  if (!publicKey || !signMessage) return undefined;
  return { reader: publicKey.toBytes(), sign: signMessage };
}

// The wallet's shielded viewing key: one signature over the bare derivation
// payload, the form browser wallets accept (Phantom refuses the off-chain
// envelope). ed25519 signatures are deterministic, so the key is stable across
// sessions, and nothing is persisted.
export async function derivedViewingKeySigner(
  wallet: MessageWallet,
): Promise<RingReadSigner | undefined> {
  const { publicKey, signMessage } = wallet;
  if (!publicKey || !signMessage) return undefined;
  return viewingKeyReader(ViewingKey.fromDerivationSeed(await signMessage(ed25519DerivationPayload())));
}

// A recipient's P-256 viewing secret (32 bytes as hex) sees its own outputs.
// Command line only, the page derives the key from the wallet instead.
export function viewingKeySigner(secretHex: string): RingReadSigner {
  return viewingKeyReader(
    ViewingKey.fromBytes(hex.decode(secretHex.trim().toLowerCase()) as Bytes32),
  );
}
