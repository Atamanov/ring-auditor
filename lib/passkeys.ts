import { base64urlnopad, hex } from "@scure/base";
import { P256PublicKey, type Bytes33 } from "@heliuslabs/zolana/keypair";
import { createPasskey, passkeyReader, type Passkey, type RingReadSigner } from "@heliuslabs/zolana/ring";

// A registered passkey as the page remembers it. Only public data: the
// credential id names the key on the authenticator, the public key is what the
// authority grants.
export interface StoredPasskey {
  label: string;
  credentialId: string;
  publicKey: string;
}

const STORAGE = "ring-auditor.passkeys";

export function loadPasskeys(): StoredPasskey[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) ?? "[]") as StoredPasskey[];
  } catch {
    return [];
  }
}

export function savePasskeys(passkeys: StoredPasskey[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(passkeys));
}

export async function registerPasskey(label: string): Promise<StoredPasskey> {
  const passkey = await createPasskey({ rpName: "Ring Auditor", userName: label });
  return {
    label,
    credentialId: base64urlnopad.encode(passkey.credentialId),
    publicKey: hex.encode(passkey.publicKey.toBytes()),
  };
}

export function passkeyPublicKey(stored: StoredPasskey): P256PublicKey {
  return P256PublicKey.fromBytes(hex.decode(stored.publicKey) as Bytes33);
}

export function passkeySigner(stored: StoredPasskey): RingReadSigner {
  const passkey: Passkey = {
    credentialId: base64urlnopad.decode(stored.credentialId),
    publicKey: passkeyPublicKey(stored),
  };
  return passkeyReader(passkey);
}
