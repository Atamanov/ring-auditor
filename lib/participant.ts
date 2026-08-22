import type { Address } from "@solana/kit";
import type { PrivateTransaction } from "@heliuslabs/zolana/transaction";
import type { ShownOutput, ShownTransaction } from "./transactions";
import type { Synced } from "./shielded";

export interface ParticipantView {
  title: string;
  items: ShownTransaction[];
}

/**
 * Received rows join a note to its history row by leaf index, sent rows are the
 * outbound history.
 *
 * The sync is keyed by the wallet's view tag, not by a ring, so one wallet holds
 * the notes and the history of every ring it ever used. `zoneProgramId` on a
 * note names its ring. An outbound row carries no ring of its own, so it is
 * placed by the notes of the same transaction, the change a send leaves in the
 * ring it spent from. A send that leaves no such note cannot be placed and is
 * dropped, which `TRACE` reports.
 */
export function participantViews(synced: Synced, ring: Address, wallet: Address): ParticipantView[] {
  const rows = synced.wallet.privateTransactions();
  const byLeaf = new Map<bigint, PrivateTransaction>(
    rows.filter((row) => row.direction !== "outbound").map((row) => [row.id.index, row]),
  );
  const onRing = new Set<string>();
  const received = new Map<string, ShownTransaction>();
  for (const entry of synced.wallet.utxos()) {
    if (entry.utxo.zoneProgramId !== ring) continue;
    const leaf = entry.outputContext.leafIndex;
    const row = byLeaf.get(leaf);
    if (!row) continue;
    onRing.add(row.id.signature);
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
  const unplaced: string[] = [];
  for (const row of rows) {
    if (row.direction !== "outbound") continue;
    if (!onRing.has(row.id.signature)) {
      unplaced.push(row.id.signature);
      continue;
    }
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
  trace(ring, unplaced);
  return [
    { title: "Sent", items: newestFirst(sent) },
    { title: "Received", items: newestFirst(received) },
  ];
}

/**
 * A send of this ring that is missing from the list appears here first.
 *
 * The change note is the only thing that ties an outbound row to a ring. A ring
 * whose transfer stops leaving the sender a note, or a wallet that stops
 * recording that note as its own row, makes every send of the ring unplaceable,
 * and the whole Sent list empties out with one line per transaction here. Give
 * the outbound row a ring of its own before that happens.
 */
function trace(ring: Address, unplaced: readonly string[]): void {
  if (unplaced.length === 0) return;
  console.warn(
    `participant view: ${unplaced.length} sent transaction(s) left no note of ring ${ring} and are hidden`,
    unplaced,
  );
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
