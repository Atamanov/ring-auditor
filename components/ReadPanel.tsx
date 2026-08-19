"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import {
  getDecryptedTransactions,
  signRead,
  type DecryptedTransaction,
  type ReadResponse,
  type ReadScope,
  type Signer,
} from "@/lib/ringRpc";
import { viewingKeySigner, walletSigner } from "@/lib/signers";
import type { Target } from "./Connection";
import { TransactionCard } from "./TransactionCard";
import { Button, Card, Field } from "./ui";

type Mode = "auditor" | "sender" | "recipient";

const MODES: { id: Mode; scope: ReadScope; label: string; hint: string }[] = [
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

const PAGE = 10;

export function ReadPanel({ target }: { target: Target }) {
  const wallet = useWallet();
  const [mode, setMode] = useState<Mode>("auditor");
  const [secret, setSecret] = useState("");
  const [items, setItems] = useState<DecryptedTransaction[]>([]);
  const [skipped, setSkipped] = useState<ReadResponse["value"]["skipped"]>([]);
  const [cursor, setCursor] = useState<string | null>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const { scope, hint } = MODES.find((m) => m.id === mode)!;
  const signer = (): Signer | undefined =>
    mode === "recipient" ? viewingKeySigner(secret) : walletSigner(wallet);

  async function read(from?: string) {
    setBusy(true);
    setError(undefined);
    try {
      const s = signer();
      if (!s) throw new Error("connect a wallet first");
      const request = await signRead(scope, target.ring, s, from, PAGE);
      const { value } = await getDecryptedTransactions(target.url, request);
      setItems(from ? (prev) => [...prev, ...value.items] : value.items);
      setSkipped(value.skipped);
      setCursor(value.cursor ?? null);
    } catch (e) {
      setError((e as Error).message);
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
        <TransactionCard key={tx.tx_signature} tx={tx} />
      ))}
      {skipped.length > 0 && (
        <Card title={`Skipped ${skipped.length}`}>
          {skipped.map((s) => (
            <p key={s.tx_signature} className="text-xs text-muted">
              <span className="font-mono">{s.tx_signature}</span> {s.reason}
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
