"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useState } from "react";
import type { Address } from "@solana/kit";
import {
  RING_READ_PAGE_LIMIT,
  parseReaderKey,
  type RingReadSigner,
  type SkippedRingTransaction,
} from "@heliuslabs/zolana/ring";
import { walletAddress } from "@/lib/chain";
import { ringRpcErrorMessage } from "@/lib/errors";
import { shortKey } from "@/lib/format";
import { useAction, useLoaded } from "@/lib/hooks";
import { participantViews } from "@/lib/participant";
import { passkeySigner, type StoredPasskey } from "@/lib/passkeys";
import { ringRpc } from "@/lib/ring-rpc";
import { ringRole } from "@/lib/role";
import { useShielded } from "@/lib/shielded";
import { walletSigner } from "@/lib/signers";
import type { ShownTransaction } from "@/lib/transactions";
import { GrantRequest } from "./GrantRequest";
import { TransactionList } from "./TransactionList";
import { Badge, Button, Card, Field, Hint, Select, Success } from "./ui";

type Mode = "auditor" | "participant";

const MODES: Record<Mode, { label: string; hint: string }> = {
  auditor: {
    label: "Ring auditor",
    hint: "The wallet must be the ring's authority or a reader it granted. It sees every transaction.",
  },
  participant: {
    label: "Participant",
    hint: "The wallet's own view from its local sync, the outputs it received and the transfers it sent. The ring RPC is not called.",
  },
};
const MODE_ORDER = ["auditor", "participant"] as const satisfies readonly Mode[];

const WALLET = "wallet";

/** Per signature, the RPC's page bound. */
const FETCH = RING_READ_PAGE_LIMIT;

interface View {
  readonly title: string;
  readonly items: readonly ShownTransaction[];
  readonly skipped: readonly SkippedRingTransaction[];
  /** Present while the RPC holds older pages. */
  readonly older: { readonly signer: RingReadSigner; readonly cursor: Uint8Array } | undefined;
}

export function ReadPanel({
  ring,
  rpcUrl,
  passkeys,
}: {
  ring: Address | undefined;
  rpcUrl: string;
  passkeys: readonly StoredPasskey[];
}) {
  const wallet = useWallet();
  const shielded = useShielded();
  const [mode, setMode] = useState<Mode>("auditor");
  const [signerId, setSignerId] = useState(WALLET);
  const [views, setViews] = useState<readonly View[]>([]);
  const [fetchedBy, setFetchedBy] = useState<string>();
  const [query, setQuery] = useState("");
  // A read re-checks the role and remounts the lists.
  const [reads, setReads] = useState(0);

  const { hint } = MODES[mode];
  const address = walletAddress(wallet);
  const passkey = mode === "auditor" ? passkeys.find((p) => p.credentialId === signerId) : undefined;
  const readerKey = passkey?.publicKey ?? address;
  const role = useLoaded(
    ring && readerKey ? { ring, readerKey, reads } : undefined,
    ({ ring, readerKey }) => ringRole(ring, parseReaderKey(readerKey)),
  );

  async function fetchPage(signer: RingReadSigner, cursor?: Uint8Array): Promise<Omit<View, "title">> {
    if (!ring) throw new Error("add a ring first");
    const page = await ringRpc(rpcUrl).getDecryptedTransactions({
      ringProgramId: ring,
      signer,
      limit: FETCH,
      ...(cursor === undefined ? {} : { cursor }),
    });
    return {
      items: page.items.map((item) => ({
        ...item,
        signers: [],
        outputs: item.outputs.map((output) => ({
          ...output,
          recipientViewingPublicKey: output.recipientViewingPublicKey.toBytes(),
        })),
      })),
      skipped: page.skipped,
      older: page.cursor ? { signer, cursor: page.cursor } : undefined,
    };
  }

  const { busy, run } = useAction<"read" | "older">(
    useCallback((e: unknown) => ringRpcErrorMessage(e, rpcUrl), [rpcUrl]),
  );

  const read = () =>
    run("read", async () => {
      setViews([]);
      setFetchedBy(undefined);
      setReads((n) => n + 1);
      if (mode === "participant") {
        if (!ring || !address) throw new Error("connect a wallet first");
        const synced = await shielded.sync();
        setViews(
        participantViews(synced, ring, address).map((v) => ({ ...v, skipped: [], older: undefined })),
      );
        setFetchedBy(`from local wallet sync at block ${synced.slot}`);
        return;
      }
      const signer = passkey ? passkeySigner(passkey) : walletSigner(wallet);
      if (!signer) throw new Error("connect a wallet first");
      setViews([{ title: "Ring", ...(await fetchPage(signer)) }]);
      setFetchedBy(
        `signed by ${passkey ? `passkey ${passkey.label} ${shortKey(passkey.publicKey, 6, 4)}` : `wallet ${shortKey(address ?? "")}`}`,
      );
    });

  const older = (index: number, from: NonNullable<View["older"]>) =>
    run("older", async () => {
      const next = await fetchPage(from.signer, from.cursor);
      setViews((prev) =>
        prev.map((v, i) => (i === index ? { ...next, title: v.title, items: [...v.items, ...next.items] } : v)),
      );
    });

  return (
    <>
      <Card title="Read as">
        <div className="flex flex-wrap gap-2">
          {MODE_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              aria-pressed={id === mode}
              className={`rounded-full border px-3 py-1 text-sm ${
                id === mode ? "border-accent bg-accent-ground text-text" : "border-line text-muted hover:text-text"
              }`}
            >
              {MODES[id].label}
            </button>
          ))}
        </div>
        <Hint>{hint}</Hint>
        {mode === "auditor" && passkeys.length > 0 && (
          <Select
            label="Sign with"
            value={passkey?.credentialId ?? WALLET}
            onChange={(e) => setSignerId(e.target.value)}
          >
            <option value={WALLET}>wallet</option>
            {passkeys.map((p) => (
              <option key={p.credentialId} value={p.credentialId}>
                passkey · {p.label}
              </option>
            ))}
          </Select>
        )}
        {readerKey && role.status !== "loading" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{passkey ? "passkey is" : "wallet is"}</span>
            <Badge>{role.status === "ready" ? role.value : role.error}</Badge>
            {mode === "auditor" && role.status === "ready" && role.value === "participant only" && (
              <GrantRequest label={passkey?.label ?? "wallet"} readerKey={readerKey} />
            )}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button onClick={read} disabled={!!busy || !ring || !readerKey}>
            {mode === "participant"
              ? busy
                ? "Syncing…"
                : "Sync and read"
              : busy
                ? "Signing…"
                : "Sign and read"}
          </Button>
          {fetchedBy && <Success>fetched · {fetchedBy}</Success>}
        </div>
      </Card>
      {views.length > 0 && (
        <Field
          label="Search signature, block, signer, recipient, asset, amount, nullifier"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="…"
        />
      )}
      {views.map(({ title, items, skipped, older: from }, index) => (
        <TransactionList
          key={`${title}-${reads}`}
          title={title}
          items={items}
          skipped={skipped}
          query={query}
          loadedSoFar={from !== undefined}
          footer={
            from && (
              <Button onClick={() => older(index, from)} disabled={!!busy}>
                Load older (sign)
              </Button>
            )
          }
        />
      ))}
    </>
  );
}
