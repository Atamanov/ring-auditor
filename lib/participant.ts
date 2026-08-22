import { createSolanaRpc, type Address, type Signature } from "@solana/kit";
import { fetchTransactionSlots, type TransactionSlots } from "@heliuslabs/zolana";
import type { PrivateTransaction } from "@heliuslabs/zolana/transaction";
import type { ShownOutput, ShownTransaction, ShownWithdrawal } from "./transactions";
import { SOLANA_RPC_URL } from "./config";
import type { Synced } from "./shielded";

export interface ParticipantView {
  title: string;
  items: ShownTransaction[];
}

/** The account a withdrawal credited, keyed by signature. */
export type WithdrawnTo = ReadonlyMap<string, string>;

/**
 * The account a public withdrawal credited.
 *
 * The pool's SOL interface is debited exactly the amount, and the settlement
 * accounts follow it in the instruction, so this holds when the recipient also
 * pays the fee.
 */
export async function withdrawalRecipients(synced: Synced): Promise<WithdrawnTo> {
  const rpc = createSolanaRpc(SOLANA_RPC_URL);
  const rows = synced.wallet
    .privateTransactions()
    .filter((row) => row.kind === "publicWithdrawal" && row.direction === "outbound");
  const found = await Promise.all(
    rows.map(async (row) => {
      const credited = await rpc
        .getTransaction(row.id.signature as Signature, {
          encoding: "jsonParsed",
          maxSupportedTransactionVersion: 0,
        })
        .send()
        .then((tx) => {
          const keys = (tx?.transaction.message.accountKeys ?? []).map((key) =>
            typeof key === "string" ? key : key.pubkey,
          );
          const pre = tx?.meta?.preBalances ?? [];
          const post = tx?.meta?.postBalances ?? [];
          const paidOut = post.findIndex(
            (after, index) => (pre[index] ?? 0n) - after === row.amount,
          );
          const source = paidOut < 0 ? undefined : keys[paidOut];
          if (source === undefined) return undefined;
          for (const instruction of tx?.transaction.message.instructions ?? []) {
            const accounts = (instruction as { accounts?: readonly string[] }).accounts ?? [];
            const at = accounts.indexOf(source);
            if (at >= 0) return accounts[at + 1];
          }
          return undefined;
        })
        .catch(() => undefined);
      return [row.id.signature, credited] as const;
    }),
  );
  return new Map(
    found.flatMap(([signature, to]) => (to === undefined ? [] : [[signature, to]])),
  );
}

/** The output slots of a transaction, keyed by signature. */
export type SlotsBySignature = ReadonlyMap<string, TransactionSlots>;

/** Owner tags sit in the clear in the slot headers, so this needs no key. */
export async function transactionSlots(synced: Synced): Promise<SlotsBySignature> {
  // One signature can carry several events, and an inbound row's index is the
  // note's leaf, which picks the event the wallet took part in.
  const leaves = new Map<string, bigint>();
  for (const row of synced.wallet.privateTransactions()) {
    if (row.direction !== "outbound") leaves.set(row.id.signature, row.id.index);
  }
  const signatures = [
    ...new Set(synced.wallet.privateTransactions().map((row) => row.id.signature)),
  ];
  const found = await Promise.all(
    signatures.map(async (signature) => {
      const leafIndex = leaves.get(signature);
      const slots = await fetchTransactionSlots({
        rpc: synced.client,
        signature: signature as Signature,
        ...(leafIndex === undefined ? {} : { leafIndex }),
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
  withdrawnTo: WithdrawnTo,
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
    // A deposit is the wallet paying itself in, so it has no counterparty.
    const sender = row.kind === "deposit" ? undefined : other(row.id.signature);
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
    const exit = row.kind === "publicWithdrawal";
    const recipient = exit ? withdrawnTo.get(row.id.signature) : other(row.id.signature);
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
      exit && recipient !== undefined ? [{ recipient, amount: row.amount }] : undefined,
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
  withdrawals?: readonly ShownWithdrawal[],
): void {
  const tx = into.get(row.id.signature) ?? {
    signature: row.id.signature,
    slot: row.id.slot,
    signers,
    ...(sender === undefined ? {} : { sender }),
    ...(withdrawals === undefined ? {} : { withdrawals }),
    outputs: [],
    undecryptableSlots: [],
    nullifiers: [],
  };
  into.set(row.id.signature, { ...tx, outputs: [...tx.outputs, output] });
}

function newestFirst(items: Map<string, ShownTransaction>): ShownTransaction[] {
  return [...items.values()].sort((a, b) => (a.slot < b.slot ? 1 : a.slot > b.slot ? -1 : 0));
}
