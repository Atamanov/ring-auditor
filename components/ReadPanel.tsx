"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "@solana/kit";
import {
  RingRpc,
  type DecryptedRingTransaction,
  type DecryptedRingTransactionsPage,
  type RingReadSigner,
} from "@heliuslabs/zolana/ring";
import {
  passkeyPublicKey,
  passkeySigner,
  type StoredPasskey,
} from "@/lib/passkeys";
import { ringRole, type RingRole } from "@/lib/role";
import { useShielded } from "@/lib/shielded";
import { walletSigner } from "@/lib/signers";
import { RING_RPC_URL, SOLANA_RPC_URL } from "@/lib/config";
import { TransactionCard } from "./TransactionCard";
import { toBase58, toHex } from "@/lib/format";
import { GrantRequest } from "./GrantRequest";
import { Badge, Button, Card, Field } from "./ui";

type Mode = "auditor" | "participant";

const MODES: { id: Mode; label: string; hint: string }[] = [
  {
    id: "auditor",
    label: "Ring auditor",
    hint: "The wallet must be the ring's authority or a reader it granted. It sees every transaction.",
  },
  {
    id: "participant",
    label: "Participant",
    hint: "The wallet sees the transactions it signed, and through its derived viewing key the outputs sent to it.",
  },
];

// One signature fetches up to the RPC's page maximum; the table pages locally.
const FETCH = 1000n;
const PAGE = 10;

interface View {
  title: string;
  signer: RingReadSigner;
  items: DecryptedRingTransaction[];
  skipped: DecryptedRingTransactionsPage["skipped"];
  cursor?: Uint8Array;
  page: number;
}

// Every field of a transaction as searchable text, lowercased once per row.
function searchText(tx: DecryptedRingTransaction): string {
  return [
    tx.signature,
    tx.slot.toString(),
    ...tx.signers,
    ...tx.outputs.flatMap((o) => [
      toHex(o.recipientViewingPublicKey),
      o.asset,
      o.amount.toString(),
      (Number(o.amount) / 1_000_000_000).toString(),
    ]),
    ...tx.nullifiers.map(toBase58),
  ]
    .join(" ")
    .toLowerCase();
}

function errorMessage(e: unknown): string {
  const details = (e as { details?: { message?: string } }).details;
  return details?.message ?? (e as Error).message;
}

export function ReadPanel({
  ring,
  passkeys,
}: {
  ring: string;
  passkeys: StoredPasskey[];
}) {
  const wallet = useWallet();
  const shielded = useShielded();
  const [mode, setMode] = useState<Mode>("auditor");
  // Auditor mode signs with the wallet or one of the stored passkeys.
  const [signerId, setSignerId] = useState("wallet");
  const [views, setViews] = useState<View[]>([]);
  const [role, setRole] = useState<RingRole | string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // Bumped after every read so the badge follows a grant or revoke made meanwhile.
  const [reads, setReads] = useState(0);
  // Who signed the page on screen, set on success, cleared when a new read starts.
  const [fetchedBy, setFetchedBy] = useState<string>();
  const [query, setQuery] = useState("");

  const { hint } = MODES.find((m) => m.id === mode)!;
  const walletAddress = wallet.publicKey?.toBase58() as Address | undefined;
  const passkey =
    mode === "auditor"
      ? passkeys.find((p) => p.credentialId === signerId)
      : undefined;
  const readerKey = useMemo(
    () => (passkey ? passkeyPublicKey(passkey) : walletAddress),
    [passkey, walletAddress],
  );

  useEffect(() => {
    if (!readerKey || !ring) return;
    let live = true;
    ringRole(SOLANA_RPC_URL, ring as Address, readerKey)
      .then((r) => live && setRole(r))
      .catch((e: unknown) => live && setRole(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [ring, readerKey, reads]);

  // Signed per request: the cursor and the time are in the attestation.
  async function page(view: View, from?: Uint8Array): Promise<View> {
    const result = await new RingRpc(RING_RPC_URL).getDecryptedTransactions({
      ringProgramId: ring as Address,
      scope: mode === "auditor" ? "ring" : "participant",
      signer: view.signer,
      limit: FETCH,
      ...(from === undefined ? {} : { cursor: from }),
    });
    return {
      ...view,
      items: from ? [...view.items, ...result.items] : [...result.items],
      skipped: [...result.skipped],
      cursor: result.cursor,
      page: 0,
    };
  }

  async function read() {
    setBusy(true);
    setError(undefined);
    setViews([]);
    setFetchedBy(undefined);
    const signedBy = passkey
      ? `passkey ${passkey.label} ${passkey.publicKey.slice(0, 6)}…${passkey.publicKey.slice(-4)}`
      : `wallet ${walletAddress?.slice(0, 4)}…${walletAddress?.slice(-4)}`;
    try {
      if (passkey) {
        setViews([
          await page({
            title: "Ring",
            signer: passkeySigner(passkey),
            items: [],
            skipped: [],
            page: 0,
          }),
        ]);
        setFetchedBy(signedBy);
        return;
      }
      const sender = walletSigner(wallet);
      if (!sender) throw new Error("connect a wallet first");
      const fresh: View[] =
        mode === "auditor"
          ? [{ title: "Ring", signer: sender, items: [], skipped: [], page: 0 }]
          : [
              {
                title: "Sent",
                signer: sender,
                items: [],
                skipped: [],
                page: 0,
              },
              {
                title: "Received",
                signer: await shielded.viewingKeySigner(),
                items: [],
                skipped: [],
                page: 0,
              },
            ];
      const loaded: View[] = [];
      for (const view of fresh) loaded.push(await page(view));
      setViews(loaded);
      setFetchedBy(signedBy);
    } catch (e) {
      setViews([]);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setReads((n) => n + 1);
    }
  }

  async function older(index: number) {
    setBusy(true);
    setError(undefined);
    try {
      const view = views[index];
      const next = await page(view, view.cursor);
      setViews((prev) => prev.map((v, i) => (i === index ? next : v)));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card title="Read as">
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                m.id === mode
                  ? "border-accent bg-accent-ground text-text"
                  : "border-line text-muted hover:text-text"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{hint}</p>
        {mode === "auditor" && passkeys.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted">
            sign with
            <select
              value={signerId}
              onChange={(e) => setSignerId(e.target.value)}
              className="rounded border border-line bg-bg px-2 py-1 text-sm text-text"
            >
              <option value="wallet">wallet</option>
              {passkeys.map((p) => (
                <option key={p.credentialId} value={p.credentialId}>
                  passkey · {p.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {role && readerKey && ring && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">
              {passkey ? "passkey is" : "wallet is"}
            </span>
            <Badge>{role}</Badge>
            {mode === "auditor" && role === "participant only" && (
              <GrantRequest
                label={passkey ? passkey.label : "wallet"}
                readerKey={passkey ? passkey.publicKey : walletAddress!}
              />
            )}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button
            onClick={read}
            disabled={busy || !ring || (!passkey && !walletAddress)}
          >
            {busy ? "Signing…" : "Sign and read"}
          </Button>
          {error && <span className="text-sm text-accent-hover">{error}</span>}
          {fetchedBy && !error && (
            <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
              fetched · signed by {fetchedBy}
            </span>
          )}
        </div>
      </Card>
      {views.length > 0 && (
        <Field
          label="Search signature, block, signer, recipient, asset, amount, nullifier"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setViews((prev) => prev.map((v) => ({ ...v, page: 0 })));
          }}
          placeholder="…"
        />
      )}
      {views.map((view, index) => {
        const needle = query.trim().toLowerCase();
        const items = needle ? view.items.filter((tx) => searchText(tx).includes(needle)) : view.items;
        const pages = Math.max(1, Math.ceil(items.length / PAGE));
        const turn = (to: number) =>
          setViews((prev) =>
            prev.map((v, i) => (i === index ? { ...v, page: to } : v)),
          );
        return (
          <section key={view.title} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <h2 className="font-medium">
                {view.title}{" "}
                <span className="text-muted">
                  {view.items.length} transaction
                  {view.items.length === 1 ? "" : "s"}
                  {view.cursor ? " loaded" : ""}
                </span>
              </h2>
              {pages > 1 && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <button
                    onClick={() => turn(view.page - 1)}
                    disabled={view.page === 0}
                    className="disabled:opacity-40 hover:text-text"
                  >
                    ‹
                  </button>
                  <span className="tabular-nums">
                    {view.page + 1} / {pages}
                  </span>
                  <button
                    onClick={() => turn(view.page + 1)}
                    disabled={view.page >= pages - 1}
                    className="disabled:opacity-40 hover:text-text"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
            {view.items
              .slice(view.page * PAGE, (view.page + 1) * PAGE)
              .map((tx) => (
                <TransactionCard key={tx.signature} tx={tx} />
              ))}
            {view.skipped.length > 0 && (
              <Card title={`Skipped ${view.skipped.length}`}>
                {view.skipped.map((entry) => (
                  <p key={entry.signature} className="text-xs text-muted">
                    <span className="font-mono">{entry.signature}</span>{" "}
                    {entry.reason}
                  </p>
                ))}
              </Card>
            )}
            {view.cursor && (
              <Button onClick={() => older(index)} disabled={busy}>
                Load older (sign)
              </Button>
            )}
          </section>
        );
      })}
    </>
  );
}
