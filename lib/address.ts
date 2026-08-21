import { base58 } from "@scure/base";
import { isAddress, type Address } from "@solana/kit";
import {
  P256PublicKey,
  ShieldedAddress,
  ShieldedPublicKey,
  type Bytes32,
  type Bytes33,
  type Bytes34,
} from "@heliuslabs/zolana/keypair";

const SIGNING = 34;
const NULLIFIER = 32;
const VIEWING = 33;
const LENGTH = SIGNING + NULLIFIER + VIEWING;

/** Base58 of `signing key || nullifier key || viewing key`, the page's own wire form. */
export function encodeShieldedAddress(address: ShieldedAddress): string {
  const bytes = new Uint8Array(LENGTH);
  bytes.set(address.signingPublicKey.toBytes(), 0);
  bytes.set(address.nullifierPublicKey, SIGNING);
  bytes.set(address.viewingPublicKey.toBytes(), SIGNING + NULLIFIER);
  return base58.encode(bytes);
}

export function decodeShieldedAddress(text: string): ShieldedAddress | undefined {
  let bytes: Uint8Array;
  try {
    bytes = base58.decode(text);
  } catch {
    return undefined;
  }
  if (bytes.length !== LENGTH) return undefined;
  try {
    return ShieldedAddress.fromPublicKeys(
      ShieldedPublicKey.fromBytes(bytes.slice(0, SIGNING) as Bytes34),
      bytes.slice(SIGNING, SIGNING + NULLIFIER) as Bytes32,
      P256PublicKey.fromBytes(bytes.slice(SIGNING + NULLIFIER) as Bytes33),
    );
  } catch {
    return undefined;
  }
}

export type Recipient = Address | ShieldedAddress;

/** A shielded address works unregistered, a Solana address must be registered on chain. */
export function parseRecipient(text: string): Recipient | undefined {
  const trimmed = text.trim();
  return decodeShieldedAddress(trimmed) ?? (isAddress(trimmed) ? trimmed : undefined);
}
