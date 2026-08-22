import type { Address, Signature } from "@solana/kit";
import { fetchOwnerTags } from "@heliuslabs/zolana";
import type { PrivateTransaction } from "@heliuslabs/zolana/transaction";
import type { ShownOutput, ShownTransaction } from "./transactions";
import type { Synced } from "./shielded";

export interface ParticipantView {
  title: string;
  items: ShownTransaction[];
}

/** Owner tags of a transaction, by slot index, keyed by signature. */
export type TagsBySignature = ReadonlyMap<string, ReadonlyMap<number, string>>;

/** Owner tags sit in the clear in the slot headers, so this needs no key. */
export async function ownerTagsBySignature(
  synced: Synced,
  ring: Address,
): Promise<TagsBySignature> {
  const leaves = new Map<string, bigint>();
  const byLeaf = new Map<bigint, PrivateTransaction>(
    synced.wallet
      .privateTransactions()
      .filter((row) => row.direction !== "outbound")
      .map((row) => [row.id.index, row]),
  );
  for (const entry of synced.wallet.utxos()) {
    if (entry.utxo.zoneProgramId !== ring) continue;
    const row = byLeaf.get(entry.outputContext.leafIndex);
    if (row) leaves.set(row.id.signature, entry.outputContext.leafIndex);
  }
  const found = await Promise.all(
    [...leaves].map(async ([signature, leafIndex]) => {
      const tags = await fetchOwnerTags({
        rpc: synced.client,
        signature: signature as Signature,
        leafIndex,
      }).catch(() => undefined);
      return [signature, tags] as const;
    }),
  );
  return new Map(
    found.flatMap(([signature, tags]) => (tags === undefined ? [] : [[signature, tags]])),
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
  tags: TagsBySignature,
): ParticipantView[] {
  const rows = synced.wallet.privateTransactions();
  const byLeaf = new Map<bigint, PrivateTransaction>(
    rows.filter((row) => row.direction !== "outbound").map((row) => [row.id.index, row]),
  );
  // The wallet's own tag is its Solana address.
  const other = (signature: string) =>
    [...(tags.get(signature)?.values() ?? [])].find((tag) => tag !== wallet);

  const onRing = new Set<string>();
  const received = new Map<string, ShownTransaction>();
  for (const entry of synced.wallet.utxos()) {
    if (entry.utxo.zoneProgramId !== ring) continue;
    const leaf = entry.outputContext.leafIndex;
    const row = byLeaf.get(leaf);
    if (!row) continue;
    onRing.add(row.id.signature);
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
  const unplaced: string[] = [];
  for (const row of rows) {
    if (row.direction !== "outbound") continue;
    if (!onRing.has(row.id.signature)) {
      unplaced.push(row.id.signature);
      continue;
    }
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
  trace(ring, unplaced);
  return [
    { title: "Sent", items: newestFirst(sent) },
    { title: "Received", items: newestFirst(received) },
  ];
}

/** A send of this ring that is missing from the list appears here first. */
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
