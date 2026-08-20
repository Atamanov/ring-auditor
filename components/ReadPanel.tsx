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
import { passkeyPublicKey, passkeySigner, type StoredPasskey } from "@/lib/passkeys";
import { ringRole, type RingRole } from "@/lib/role";
import { derivedViewingKeySigner, walletSigner } from "@/lib/signers";
import type { Target } from "./Connection";
import { TransactionCard } from "./TransactionCard";
import { Badge, Button, Card } from "./ui";

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

const PAGE = 10n;

interface View {
  title: string;
  signer: RingReadSigner;
  items: DecryptedRingTransaction[];
  skipped: DecryptedRingTransactionsPage["skipped"];
  cursor?: Uint8Array;
}

function errorMessage(e: unknown): string {
  const details = (e as { details?: { message?: string } }).details;
  return details?.message ?? (e as Error).message;
}

export function ReadPanel({ target, passkeys }: { target: Target; passkeys: StoredPasskey[] }) {
  const wallet = useWallet();
  const [mode, setMode] = useState<Mode>("auditor");
  // Auditor mode signs with the wallet or one of the stored passkeys.
  const [signerId, setSignerId] = useState("wallet");
  const [views, setViews] = useState<View[]>([]);
  const [role, setRole] = useState<RingRole | string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const { hint } = MODES.find((m) => m.id === mode)!;
  const walletAddress = wallet.publicKey?.toBase58() as Address | undefined;
  const passkey = mode === "auditor" ? passkeys.find((p) => p.credentialId === signerId) : undefined;
  const readerKey = useMemo(
    () => (passkey ? passkeyPublicKey(passkey) : walletAddress),
    [passkey, walletAddress],
  );

  useEffect(() => {
    if (!readerKey || !target.ring) return;
    let live = true;
    ringRole(target.solanaRpc, target.ring as Address, readerKey)
      .then((r) => live && setRole(r))
      .catch((e: unknown) => live && setRole(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [target.solanaRpc, target.ring, readerKey]);

  // Signed per request: the cursor and the time are in the attestation.
  async function page(view: View, from?: Uint8Array): Promise<View> {
    const result = await new RingRpc(target.url).getDecryptedTransactions({
      ringProgramId: target.ring as Address,
      scope: mode === "auditor" ? "ring" : "participant",
      signer: view.signer,
      limit: PAGE,
      ...(from === undefined ? {} : { cursor: from }),
    });
    return {
      ...view,
      items: from ? [...view.items, ...result.items] : [...result.items],
      skipped: [...result.skipped],
      cursor: result.cursor,
    };
  }

  async function read() {
    setBusy(true);
    setError(undefined);
    try {
      if (passkey) {
        setViews([await page({ title: "Ring", signer: passkeySigner(passkey), items: [], skipped: [] })]);
        return;
      }
      const sender = walletSigner(wallet);
      if (!sender) throw new Error("connect a wallet first");
      const fresh: View[] =
        mode === "auditor"
          ? [{ title: "Ring", signer: sender, items: [], skipped: [] }]
          : [
              { title: "Sent", signer: sender, items: [], skipped: [] },
              {
                title: "Received",
                signer: (await derivedViewingKeySigner(wallet))!,
                items: [],
                skipped: [],
              },
            ];
      const loaded: View[] = [];
      for (const view of fresh) loaded.push(await page(view));
      setViews(loaded);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
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
        {role && readerKey && target.ring && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{passkey ? "passkey is" : "wallet is"}</span>
            <Badge>{role}</Badge>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button onClick={read} disabled={busy || !target.ring || (!passkey && !walletAddress)}>
            {busy ? "Signing…" : "Sign and read"}
          </Button>
          {error && <span className="text-sm text-accent-hover">{error}</span>}
        </div>
      </Card>
      {views.map((view, index) => (
        <section key={view.title} className="flex flex-col gap-3">
          {views.length > 1 && (
            <h2 className="text-sm font-medium">
              {view.title} <span className="text-muted">{view.items.length}</span>
            </h2>
          )}
          {view.items.map((tx) => (
            <TransactionCard key={tx.signature} tx={tx} />
          ))}
          {view.skipped.length > 0 && (
            <Card title={`Skipped ${view.skipped.length}`}>
              {view.skipped.map((entry) => (
                <p key={entry.signature} className="text-xs text-muted">
                  <span className="font-mono">{entry.signature}</span> {entry.reason}
                </p>
              ))}
            </Card>
          )}
          {view.cursor && (
            <Button onClick={() => older(index)} disabled={busy}>
              Older
            </Button>
          )}
        </section>
      ))}
    </>
  );
}
