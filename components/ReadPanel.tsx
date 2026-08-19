"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import type { Address } from "@solana/kit";
import {
  RingRpc,
  type DecryptedRingTransaction,
  type DecryptedRingTransactionsPage,
  type RingReadScope,
  type RingReadSigner,
} from "@heliuslabs/zolana/ring";
import { viewingKeySigner, walletSigner } from "@/lib/signers";
import type { Target } from "./Connection";
import { TransactionCard } from "./TransactionCard";
import { Button, Card, Field } from "./ui";

type Mode = "auditor" | "sender" | "recipient";

const MODES: { id: Mode; scope: RingReadScope; label: string; hint: string }[] = [
  {
    id: "auditor",
    scope: "ring",
    label: "Ring authority",
    hint: "The wallet must be the ring's authority. It sees every transaction.",
  },
  {
    id: "sender",
    scope: "participant",
    label: "Participant, wallet",
    hint: "The wallet sees the transactions it signed.",
  },
  {
    id: "recipient",
    scope: "participant",
    label: "Participant, viewing key",
    hint: "A recipient's viewing secret sees the outputs encrypted to it.",
  },
];

const PAGE = 10n;

export function ReadPanel({ target }: { target: Target }) {
  const wallet = useWallet();
  const [mode, setMode] = useState<Mode>("auditor");
  const [secret, setSecret] = useState("");
  const [items, setItems] = useState<DecryptedRingTransaction[]>([]);
  const [skipped, setSkipped] = useState<DecryptedRingTransactionsPage["skipped"]>([]);
  const [cursor, setCursor] = useState<Uint8Array>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const { scope, hint } = MODES.find((m) => m.id === mode)!;
  const signer = (): RingReadSigner | undefined =>
    mode === "recipient" ? viewingKeySigner(secret) : walletSigner(wallet);

  async function read(from?: Uint8Array) {
    setBusy(true);
    setError(undefined);
    try {
      const s = signer();
      if (!s) throw new Error("connect a wallet first");
      // Signed per request: the cursor and the time are in the attestation.
      const page = await new RingRpc(target.url).getDecryptedTransactions({
        ringProgramId: target.ring as Address,
        scope,
        signer: s,
        limit: PAGE,
        ...(from === undefined ? {} : { cursor: from }),
      });
      setItems(from ? (prev) => [...prev, ...page.items] : [...page.items]);
      setSkipped([...page.skipped]);
      setCursor(page.cursor);
    } catch (e) {
      const details = (e as { details?: { message?: string } }).details;
      setError(details?.message ?? (e as Error).message);
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
        {mode === "recipient" && (
          <Field
            label="Viewing secret, hex"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
          />
        )}
        <div className="flex items-center gap-3">
          <Button onClick={() => read()} disabled={busy || !target.ring}>
            {busy ? "Signing…" : "Sign and read"}
          </Button>
          {error && <span className="text-sm text-accent-hover">{error}</span>}
        </div>
      </Card>
      {items.map((tx) => (
        <TransactionCard key={tx.signature} tx={tx} />
      ))}
      {skipped.length > 0 && (
        <Card title={`Skipped ${skipped.length}`}>
          {skipped.map((entry) => (
            <p key={entry.signature} className="text-xs text-muted">
              <span className="font-mono">{entry.signature}</span> {entry.reason}
            </p>
          ))}
        </Card>
      )}
      {cursor && (
        <Button onClick={() => read(cursor)} disabled={busy}>
          Older
        </Button>
      )}
    </>
  );
}
