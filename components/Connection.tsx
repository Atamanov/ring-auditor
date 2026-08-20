"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import type { Address } from "@solana/kit";
import { RingRpc, type RingRpcHealth } from "@heliuslabs/zolana/ring";
import { RING_RPC_URL, SOLANA_RPC_URL, type Ring, type RingSelection } from "@/lib/config";
import { testTransact } from "@/lib/transact";
import { Badge, Button, Card, Field, Mono } from "./ui";

export function Connection({
  selection,
  onChange,
}: {
  selection: RingSelection;
  onChange: (selection: RingSelection) => void;
}) {
  const wallet = useWallet();
  const [status, setStatus] = useState<RingRpcHealth | string>("probing");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Ring>({ name: "", id: "" });
  const [transact, setTransact] = useState<string>();
  const [busy, setBusy] = useState(false);

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

  // A demo transfer on the selected ring from the connected wallet, so the
  // Participant view has something of its own to show.
  async function transactFromWallet() {
    setBusy(true);
    try {
      const signature = await testTransact(wallet, selection.selected as Address, setTransact);
      setTransact(`sent ${signature}`);
    } catch (e) {
      const details = (e as { details?: { message?: string } }).details;
      setTransact(details?.message ?? (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
        <Button
          onClick={transactFromWallet}
          disabled={busy || !selection.selected || !wallet.publicKey}
          title="Two deposits and one audited transfer from the connected wallet"
        >
          {busy ? "Transacting…" : "Test transact"}
        </Button>
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
      <p className="text-xs text-muted">
        ring rpc {RING_RPC_URL} · solana {SOLANA_RPC_URL}
      </p>
      {transact && <Mono>{transact}</Mono>}
    </Card>
  );
}
