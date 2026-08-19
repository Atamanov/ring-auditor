import { base58, base64 } from "@scure/base";

export type ReadScope = "ring" | "participant";

// Signs the read attestation. `reader` is a 32-byte ed25519 key or a 33-byte
// SEC1 P-256 key, which is how the server tells the two schemes apart.
export interface Signer {
  reader: Uint8Array;
  sign(message: Uint8Array): Promise<Uint8Array>;
}

export interface ReadAuth {
  scope: ReadScope;
  reader: string;
  timestamp: number;
  signature: string;
}

export interface ReadRequest {
  ring_program_id: string;
  cursor?: string;
  limit?: number;
  auth: ReadAuth;
}

export interface DecryptedOutput {
  slot_index: number;
  recipient_viewing_pk: string;
  asset: string;
  amount: number;
  blinding: string;
  ring_program_id?: string | null;
}

export interface DecryptedTransaction {
  slot: number;
  tx_signature: string;
  signers: string[];
  tx_viewing_pk: string;
  outputs: DecryptedOutput[];
  undecryptable_slots: number[];
  nullifiers: string[];
}

export interface SkippedTransaction {
  slot: number;
  tx_signature: string;
  reason: string;
}

export interface ReadResponse {
  context: { slot: number; blockTime?: number | null };
  value: {
    items: DecryptedTransaction[];
    skipped: SkippedTransaction[];
    cursor?: string | null;
  };
}

export interface Health {
  mode: string;
  service_pubkey: string;
  auditor_view_tag?: string;
}

export class RpcError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

const READ_DOMAIN = new TextEncoder().encode("zolana/ring-rpc-read/v1");
const SCOPE_TAG: Record<ReadScope, number> = { ring: 0, participant: 1 };

// Bytes the reader signs. The layout binds scope, ring, time, page size and
// cursor, so a captured signature opens no other ring, page or scope, and the
// server rejects timestamps older than a minute.
export function readAttestation(
  scope: ReadScope,
  ring: Uint8Array,
  timestamp: number,
  cursor?: Uint8Array,
  limit?: number,
): Uint8Array {
  const body = new Uint8Array(16 + (cursor?.length ?? 0));
  const view = new DataView(body.buffer);
  view.setBigUint64(0, BigInt(timestamp), true);
  view.setBigUint64(8, BigInt(limit ?? 0), true);
  if (cursor) body.set(cursor, 16);
  return concat(READ_DOMAIN, Uint8Array.of(SCOPE_TAG[scope]), ring, body);
}

// Builds a signed request. Sign right before sending, and again for every
// page, because the cursor and the timestamp are both part of the signature.
export async function signRead(
  scope: ReadScope,
  ringProgramId: string,
  signer: Signer,
  cursor?: string,
  limit?: number,
): Promise<ReadRequest> {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = readAttestation(
    scope,
    base58.decode(ringProgramId),
    timestamp,
    cursor ? base64.decode(cursor) : undefined,
    limit,
  );
  const signature = await signer.sign(message);
  return {
    ring_program_id: ringProgramId,
    cursor,
    limit,
    auth: {
      scope,
      reader: base64.encode(signer.reader),
      timestamp,
      signature: base64.encode(signature),
    },
  };
}

export function getDecryptedTransactions(url: string, request: ReadRequest) {
  return call<ReadResponse>(url, "getDecryptedTransactions", request);
}

export function health(url: string) {
  return call<Health>(url, "health");
}

// The server parses `params` as the request object itself, not as a list.
async function call<T>(url: string, method: string, params?: object): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new RpcError(response.status, response.statusText);
  const body = (await response.json()) as {
    result?: T;
    error?: { code: number; message: string };
  };
  if (body.error) throw new RpcError(body.error.code, body.error.message);
  return body.result as T;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
