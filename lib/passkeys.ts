import { base64urlnopad, hex } from "@scure/base";
import { P256PublicKey, type Bytes33 } from "@heliuslabs/zolana/keypair";
import { createPasskey, passkeyReader, type Passkey, type RingReadSigner } from "@heliuslabs/zolana/ring";
import { asRecord, stored } from "./storage";

/** Public data only. */
export interface StoredPasskey {
  readonly label: string;
  readonly credentialId: string;
  readonly publicKey: string;
}

const HEX_33_BYTES = /^[0-9a-f]{66}$/;

export const passkeyStore = stored<readonly StoredPasskey[]>("ring-auditor.passkeys", (raw) =>
  (Array.isArray(raw) ? raw : []).flatMap((entry: unknown) => {
    const p = asRecord(entry);
    return typeof p.label === "string" &&
      typeof p.credentialId === "string" &&
      typeof p.publicKey === "string" &&
      HEX_33_BYTES.test(p.publicKey)
      ? [{ label: p.label, credentialId: p.credentialId, publicKey: p.publicKey }]
      : [];
  }),
);

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
