"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import type { Address } from "@solana/kit";
import { RingRpc, type RingRpcHealth } from "@heliuslabs/zolana/ring";
import { RING_RPC_URL, SOLANA_RPC_URL, type Ring, type RingSelection } from "@/lib/config";
import { useShielded } from "@/lib/shielded";
import { Badge, Button, Card, Field, Mono } from "./ui";

export function Connection({
  selection,
  onChange,
}: {
  selection: RingSelection;
  onChange: (selection: RingSelection) => void;
}) {
  const wallet = useWallet();
  const shielded = useShielded();
  const [status, setStatus] = useState<RingRpcHealth | string>("probing");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Ring>({ name: "", id: "" });
  const [amount, setAmount] = useState("0.05");
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const ring = selection.selected as Address;

  useEffect(() => {
    let live = true;
    new RingRpc(RING_RPC_URL)
      .health()
      .then((h) => live && setStatus(h))
      .catch((e: Error) => live && setStatus(e.message));
    return () => {
      live = false;
    };
  }, []);

  function add() {
    const ring = { name: draft.name.trim(), id: draft.id.trim() };
    if (!ring.name || !ring.id) return;
    onChange({ rings: [...selection.rings, ring], selected: ring.id });
    setDraft({ name: "", id: "" });
    setAdding(false);
  }

  // The wallet's notes on this ring, and the two moves that change them: a
  // deposit from the wallet, a transfer inside the ring to a fresh recipient.
  async function act(label: string, action: () => Promise<string>) {
    setBusy(label);
    setNote(undefined);
    try {
      setNote(await action());
    } catch (e) {
      const details = (e as { details?: { message?: string } }).details;
      setNote(details?.message ?? (e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }
  const lamports = () => BigInt(Math.round(Number(amount) * 1_000_000_000));
  const canAct = !busy && !!selection.selected && !!wallet.publicKey;

  return (
    <Card title="Ring">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted uppercase tracking-wide text-xs">Name</span>
          <select
            value={selection.selected}
            onChange={(e) => onChange({ ...selection, selected: e.target.value })}
            className="rounded border border-line bg-bg px-3 py-2 text-sm text-text"
          >
            {selection.rings.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded border border-line px-3 py-2 text-sm text-muted hover:text-text"
          title="Add a ring"
        >
          +
        </button>
      </div>
      {adding && (
        <div className="flex flex-wrap items-end gap-3">
          <Field
            label="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Field
            label="Ring program id"
            value={draft.id}
            onChange={(e) => setDraft({ ...draft, id: e.target.value })}
          />
          <Button onClick={add}>Add</Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>program</span>
        <Mono>{selection.selected}</Mono>
      </div>
      {typeof status === "string" ? (
        <Badge>{status}</Badge>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{status.mode}</Badge>
          <span className="text-xs text-muted">service key</span>
          <Mono>{status.servicePublicKey}</Mono>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted uppercase tracking-wide text-xs">Balance on ring</span>
          <span className="tabular-nums">
            {shielded.balance === undefined
              ? "—"
              : `${(Number(shielded.balance) / 1_000_000_000).toFixed(4)} SOL`}
          </span>
        </div>
        <Button
          onClick={() => act("refresh", () => shielded.refresh(ring).then(() => "synced"))}
          disabled={!canAct}
        >
          {busy === "refresh" ? "Syncing…" : "Refresh"}
        </Button>
        <Field
          label="Amount, SOL"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
        />
        <Button
          onClick={() => act("deposit", () => shielded.deposit(ring, lamports()))}
          disabled={!canAct}
          title="Shield SOL from the wallet into the ring"
        >
          {busy === "deposit" ? "Depositing…" : "Deposit"}
        </Button>
        <Button
          onClick={() => act("transfer", () => shielded.transfer(ring, lamports()))}
          disabled={!canAct}
          title="Audited transfer inside the ring to a fresh recipient"
        >
          {busy === "transfer" ? "Proving…" : "Transfer"}
        </Button>
      </div>
      <p className="text-xs text-muted">
        ring rpc {RING_RPC_URL} · solana {SOLANA_RPC_URL}
      </p>
      {note && <Mono>{note}</Mono>}
    </Card>
  );
}
