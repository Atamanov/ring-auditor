import type { Address, Signature } from "@solana/kit";
import { fetchTransactionSlots, type TransactionSlots } from "@heliuslabs/zolana";
import type { PrivateTransaction } from "@heliuslabs/zolana/transaction";
import type { ShownOutput, ShownTransaction } from "./transactions";
import type { Synced } from "./shielded";

export interface ParticipantView {
  title: string;
  items: ShownTransaction[];
}

/** The output slots of a transaction, keyed by signature. */
export type SlotsBySignature = ReadonlyMap<string, TransactionSlots>;

/** Owner tags sit in the clear in the slot headers, so this needs no key. */
export async function transactionSlots(synced: Synced): Promise<SlotsBySignature> {
  const signatures = [
    ...new Set(synced.wallet.privateTransactions().map((row) => row.id.signature)),
  ];
  const found = await Promise.all(
    signatures.map(async (signature) => {
      const slots = await fetchTransactionSlots({
        rpc: synced.client,
        signature: signature as Signature,
      }).catch(() => undefined);
      return [signature, slots] as const;
    }),
  );
  return new Map(
    found.flatMap(([signature, slots]) => (slots === undefined ? [] : [[signature, slots]])),
  );
}

/**
 * A wallet holds notes of every ring it used, because the sync follows its view
 * tag. An outbound row is placed by the change note it left.
 */
export function participantViews(
  synced: Synced,
  ring: Address,
  wallet: Address,
  slots: SlotsBySignature,
): ParticipantView[] {
  const rows = synced.wallet.privateTransactions();
  const byLeaf = new Map<bigint, PrivateTransaction>(
    rows.filter((row) => row.direction !== "outbound").map((row) => [row.id.index, row]),
  );
  // The wallet's own tag is its Solana address.
  const other = (signature: string) =>
    [...(slots.get(signature)?.ownerTags.values() ?? [])].find((tag) => tag !== wallet);
  // A send leaves no history row for its change, so a row is tied to the ring
  // by the leaves of its slots, one of which holds a note of this ring.
  const ringLeaves = new Set(
    synced.wallet
      .utxos()
      .filter((entry) => entry.utxo.zoneProgramId === ring)
      .map((entry) => entry.outputContext.leafIndex),
  );
  const onRing = (signature: string) =>
    [...(slots.get(signature)?.leaves.values() ?? [])].some((leaf) => ringLeaves.has(leaf));

  const received = new Map<string, ShownTransaction>();
  for (const entry of synced.wallet.utxos()) {
    if (entry.utxo.zoneProgramId !== ring) continue;
    const leaf = entry.outputContext.leafIndex;
    const row = byLeaf.get(leaf);
    if (!row) continue;
    const sender = other(row.id.signature);
    append(
      received,
      row,
      {
        slotIndex: Number(leaf),
        recipient: wallet,
        asset: entry.utxo.asset,
        amount: entry.utxo.amount,
        spent: entry.spent,
      },
      [],
      sender,
    );
  }

  const sent = new Map<string, ShownTransaction>();
  for (const row of rows) {
    if (row.direction !== "outbound") continue;
    if (!onRing(row.id.signature)) continue;
    const recipient = other(row.id.signature);
    append(
      sent,
      row,
      {
        slotIndex: sent.get(row.id.signature)?.outputs.length ?? 0,
        ...(recipient === undefined ? {} : { recipient }),
        asset: row.asset,
        amount: row.amount,
      },
      [wallet],
      wallet,
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
  sender?: string,
): void {
  const tx = into.get(row.id.signature) ?? {
    signature: row.id.signature,
    slot: row.id.slot,
    signers,
    ...(sender === undefined ? {} : { sender }),
    outputs: [],
    undecryptableSlots: [],
    nullifiers: [],
  };
  into.set(row.id.signature, { ...tx, outputs: [...tx.outputs, output] });
}

function newestFirst(items: Map<string, ShownTransaction>): ShownTransaction[] {
  return [...items.values()].sort((a, b) => (a.slot < b.slot ? 1 : a.slot > b.slot ? -1 : 0));
}
