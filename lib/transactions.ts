import { formatAmount, toBase58, toHex } from "./format";

export interface ShownOutput {
  readonly slotIndex: number;
  readonly recipientViewingPublicKey: Uint8Array;
  readonly asset: string;
  readonly amount: bigint;
  readonly spent?: boolean;
}

export interface ShownTransaction {
  readonly signature: string;
  readonly slot: bigint;
  readonly signers: readonly string[];
  readonly outputs: readonly ShownOutput[];
  readonly undecryptableSlots: readonly number[];
  readonly nullifiers: readonly Uint8Array[];
}

export function searchText(tx: ShownTransaction): string {
  return [
    tx.signature,
    tx.slot.toString(),
    ...tx.signers,
    ...tx.outputs.flatMap((o) => [
      toHex(o.recipientViewingPublicKey),
      o.asset,
      o.amount.toString(),
      formatAmount(o.amount, o.asset),
    ]),
    ...tx.nullifiers.map(toBase58),
  ]
    .join(" ")
    .toLowerCase();
}

export function matches(tx: ShownTransaction, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || searchText(tx).includes(needle);
}
