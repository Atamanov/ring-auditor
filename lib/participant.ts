import type { Address } from "@solana/kit";
import type { PrivateTransaction } from "@heliuslabs/zolana/transaction";
import type { ShownOutput, ShownTransaction } from "@/components/TransactionCard";
import type { Synced } from "./shielded";

export interface ParticipantView {
  title: string;
  items: ShownTransaction[];
}

/** Received rows join a note to its history row by leaf index, sent rows are the outbound history. */
export function participantViews(synced: Synced, ring: Address, wallet: Address): ParticipantView[] {
  const rows = synced.wallet.privateTransactions();
  const byLeaf = new Map<bigint, PrivateTransaction>(
    rows.filter((row) => row.direction !== "outbound").map((row) => [row.id.index, row]),
  );
  const received = new Map<string, ShownTransaction>();
  for (const entry of synced.wallet.utxos()) {
    if (entry.utxo.zoneProgramId !== ring) continue;
    const leaf = entry.outputContext.leafIndex;
    const row = byLeaf.get(leaf);
    if (!row) continue;
    const output: ShownOutput = {
      slotIndex: Number(leaf),
      recipientViewingPublicKey: synced.viewingPublicKey,
      asset: entry.utxo.asset,
      amount: entry.utxo.amount,
      spent: entry.spent,
    };
    append(received, row, output, []);
  }
  const sent = new Map<string, ShownTransaction>();
  for (const row of rows) {
    if (row.direction !== "outbound") continue;
    append(
      sent,
      row,
      {
        slotIndex: sent.get(row.id.signature)?.outputs.length ?? 0,
        recipientViewingPublicKey: row.counterpartyViewingPublicKey?.toBytes() ?? new Uint8Array(),
        asset: row.asset,
        amount: row.amount,
      },
      [wallet],
    );
  }
  return [
    { title: "Sent", items: newestFirst(sent) },
    { title: "Received", items: newestFirst(received) },
  ];
}

function append(
  into: Map<string, ShownTransaction>,
  row: PrivateTransaction,
  output: ShownOutput,
  signers: readonly string[],
): void {
  const tx = into.get(row.id.signature) ?? {
    signature: row.id.signature,
    slot: row.id.slot,
    signers,
    outputs: [],
    undecryptableSlots: [],
    nullifiers: [],
  };
  into.set(row.id.signature, { ...tx, outputs: [...tx.outputs, output] });
}

function newestFirst(items: Map<string, ShownTransaction>): ShownTransaction[] {
  return [...items.values()].sort((a, b) => (a.slot < b.slot ? 1 : a.slot > b.slot ? -1 : 0));
}
