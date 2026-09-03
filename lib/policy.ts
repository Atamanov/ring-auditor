import { getAddressEncoder, isAddress, type Address } from "@solana/kit";
import {
  ListId,
  RingError,
  decodeRuleTable,
  fetchRingConfigs,
  memberOfTag,
  readRingEntries,
  readRingEntry,
  referencedLists,
  ringPolicyNamespaceAddress,
  type LiveEntry,
  type Rule,
  type RuleTable,
  type RingPolicyConfig,
} from "@heliuslabs/zolana/ring";
import { zolanaClient } from "./client";

export type DecodedTable =
  | { readonly status: "decoded"; readonly table: RuleTable }
  | { readonly status: "undecodable"; readonly reason: string };

export interface ListSource {
  readonly listId: ListId;
  readonly namespace: Address | undefined;
  readonly own: boolean;
}

export type PolicyView =
  | { readonly hasPolicy: false }
  | {
      readonly hasPolicy: true;
      readonly policy: RingPolicyConfig;
      readonly table: DecodedTable;
      readonly sources: readonly ListSource[];
    };

export async function loadPolicy(ring: Address): Promise<PolicyView> {
  const configs = await fetchRingConfigs(await zolanaClient(), ring);
  if (!configs.hasPolicy) return { hasPolicy: false };
  const { policy } = configs;
  const table = decodeTable(policy);
  const own = await ringPolicyNamespaceAddress(ring);
  const referenced = table.status === "decoded" ? referencedLists(table.table.rules) : [];
  const sources = referenced.map((listId): ListSource => {
    const slot = policy.sources[listId - 1];
    const namespace = slot === undefined || slot.listId === 0 ? undefined : slot.namespace;
    return { listId, namespace, own: namespace === own };
  });
  return { hasPolicy: true, policy, table, sources };
}

function decodeTable(policy: RingPolicyConfig): DecodedTable {
  try {
    return { status: "decoded", table: decodeRuleTable(policy) };
  } catch (e) {
    if (e instanceof RingError && e.code === "RING_RULE_TABLE_INVALID") {
      return { status: "undecodable", reason: String(e.details?.["reason"]) };
    }
    throw e;
  }
}

const LIST_NAMES: Record<ListId, string> = {
  [ListId.allow]: "allow",
  [ListId.block]: "block",
  [ListId.frozen]: "frozen",
  [ListId.ringViewing]: "ring-viewing",
  [ListId.recovery]: "recovery",
  [ListId.reader]: "reader",
  [ListId.approval]: "approval",
  [ListId.escrow]: "escrow",
};

export function listName(listId: ListId): string {
  return LIST_NAMES[listId];
}

const SUBJECTS = {
  outputOwner: "each output owner",
  sender: "the sender",
  asset: "each asset",
  exitDestination: "each exit destination",
} as const;

/** The wording of `zolana-ring policy show`. */
export function describeRule(rule: Rule): string {
  const condition =
    rule.source.kind === "inlineAssets"
      ? "must be one of the listed assets"
      : [
          ...rule.source.present.map((id) => `must be on the ${listName(id)} list`),
          ...rule.source.absent.map((id) => `must not be on the ${listName(id)} list`),
        ].join(" or ");
  const guard =
    rule.guard.kind === "aboveAmount" ? ` when the amount is above ${rule.guard.amount}` : "";
  return `${SUBJECTS[rule.subject]} ${condition}${guard}`;
}

export function sourceLabel(source: ListSource): string {
  if (source.namespace === undefined) return "no source";
  return source.own ? "own entries" : `curator namespace ${source.namespace}`;
}

export interface ListEntries {
  readonly listId: ListId;
  readonly entries: readonly LiveEntry[];
}

export async function scanEntries(
  view: Extract<PolicyView, { hasPolicy: true }>,
): Promise<readonly ListEntries[]> {
  const indexer = await zolanaClient();
  const namespaces = [...new Set(view.sources.flatMap((s) => (s.namespace ? [s.namespace] : [])))];
  const scanned = new Map(
    await Promise.all(
      namespaces.map(
        async (namespace) =>
          [
            namespace,
            await readRingEntries({ indexer, entriesTree: view.policy.entriesTree, namespace }),
          ] as const,
      ),
    ),
  );
  return view.sources.map(({ listId, namespace }) => ({
    listId,
    entries: (namespace ? (scanned.get(namespace) ?? []) : []).filter(
      (live) => live.entry.listId === listId,
    ),
  }));
}

export interface MemberState {
  readonly listId: ListId;
  readonly state: "active" | "cleared" | "unclaimed";
  readonly version: bigint | undefined;
}

export async function lookupMember(
  view: Extract<PolicyView, { hasPolicy: true }>,
  text: string,
): Promise<readonly MemberState[]> {
  const tag = text.trim();
  if (!isAddress(tag)) throw new Error("the owner tag is not a base58 address");
  const member = memberOfTag(new Uint8Array(getAddressEncoder().encode(tag)));
  const indexer = await zolanaClient();
  return Promise.all(
    view.sources.map(async ({ listId, namespace }): Promise<MemberState> => {
      if (namespace === undefined) return { listId, state: "unclaimed", version: undefined };
      const live = await readRingEntry({
        indexer,
        entriesTree: view.policy.entriesTree,
        namespace,
        listId,
        member,
      });
      return live === undefined
        ? { listId, state: "unclaimed", version: undefined }
        : { listId, state: live.entry.state, version: live.entry.version };
    }),
  );
}
