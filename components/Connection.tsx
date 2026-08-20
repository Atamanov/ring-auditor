"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import type { Address } from "@solana/kit";
import { RingRpc, type RingRpcHealth } from "@heliuslabs/zolana/ring";
import {
  RING_RPC_URL,
  SOLANA_RPC_URL,
  ringRpcUrl,
  selectedRing,
  type Ring,
  type RingSelection,
} from "@/lib/config";
import { servesRing } from "@/lib/role";
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
  const rpcUrl = ringRpcUrl(selectedRing(selection));
  // Keyed by URL, so switching rings shows "probing" until the new RPC answers.
  const [health, setHealth] = useState<{ url: string; status: RingRpcHealth | string }>();
  const status = health?.url === rpcUrl ? health.status : "probing";
  const [adding, setAdding] = useState(selection.rings.length === 0);
  const [draft, setDraft] = useState<Ring>({ name: "", id: "", rpc: "", lookupTable: "" });
  const [amount, setAmount] = useState("0.05");
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const ring = selection.selected as Address;

  useEffect(() => {
    let live = true;
    const ringId = selection.selected as Address;
    if (!ringId) return;
    new RingRpc(rpcUrl)
      .health()
      .then(async (s) => {
        const ok = await servesRing(SOLANA_RPC_URL, ringId, s).catch(() => true);
        if (live) {
          setHealth({
            url: rpcUrl,
            status: ok ? s : `the RPC at ${rpcUrl} serves another ring's auditor key`,
          });
        }
      })
      .catch(
        () => live && setHealth({ url: rpcUrl, status: `no ring RPC answering at ${rpcUrl}` }),
      );
    return () => {
      live = false;
    };
  }, [rpcUrl, selection.selected]);

  function add() {
    const ring: Ring = { name: draft.name.trim(), id: draft.id.trim() };
    if (draft.rpc?.trim()) ring.rpc = draft.rpc.trim();
    if (draft.lookupTable?.trim()) ring.lookupTable = draft.lookupTable.trim();
    if (!ring.name || !ring.id) return;
    onChange({
      rings: [...selection.rings.filter((r) => r.id !== ring.id), ring],
      selected: ring.id,
    });
    setDraft({ name: "", id: "", rpc: "", lookupTable: "" });
    setAdding(false);
  }

  function remove() {
    const rings = selection.rings.filter((r) => r.id !== selection.selected);
    onChange({ rings, selected: rings[0]?.id ?? "" });
    if (rings.length === 0) setAdding(true);
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
        {selection.selected && (
          <button
            onClick={remove}
            className="rounded border border-line px-3 py-2 text-sm text-muted hover:text-text"
            title="Remove this ring from the list"
          >
            ×
          </button>
        )}
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
          <Field
            label="Ring RPC URL"
            value={draft.rpc ?? ""}
            placeholder={RING_RPC_URL}
            onChange={(e) => setDraft({ ...draft, rpc: e.target.value })}
          />
          <Field
            label="Lookup table, optional"
            value={draft.lookupTable ?? ""}
            placeholder="created on first transfer"
            onChange={(e) => setDraft({ ...draft, lookupTable: e.target.value })}
          />
          <Button onClick={add}>Add</Button>
        </div>
      )}
      {selection.selected && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>program</span>
          <Mono>{selection.selected}</Mono>
        </div>
      )}
      {!selection.selected ? (
        <p className="text-xs text-muted">Add a ring to start: a name, its program id, and its RPC.</p>
      ) : typeof status === "string" ? (
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
          onClick={() =>
            act("transfer", () => shielded.transfer(selectedRing(selection)!, rpcUrl, lamports()))
          }
          disabled={!canAct}
          title="Audited transfer inside the ring to a fresh recipient"
        >
          {busy === "transfer" ? "Proving…" : "Transfer"}
        </Button>
      </div>
      <p className="text-xs text-muted">
        ring rpc {rpcUrl} · solana {SOLANA_RPC_URL}
      </p>
      {note && <Mono>{note}</Mono>}
    </Card>
  );
}
