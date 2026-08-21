"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { toast } from "sonner";
import { address, isAddress, type Address } from "@solana/kit";
import { RingRpc } from "@heliuslabs/zolana/ring";
import { walletAddress } from "@/lib/chain";
import {
  RING_RPC_URL,
  SOLANA_RPC_URL,
  ringRpcUrl,
  withRing,
  withoutRing,
  type Ring,
  type RingSelection,
} from "@/lib/config";
import { formatAmount, parseSol, shortKey } from "@/lib/format";
import { useAction, useLoaded } from "@/lib/hooks";
import { servesRing } from "@/lib/role";
import { useShielded } from "@/lib/shielded";
import { Badge, Button, Caption, Card, Field, Hint, IconButton, Mono, Select } from "./ui";

export function RingCard({
  selection,
  ring,
  onChange,
}: {
  selection: RingSelection;
  ring: Ring | undefined;
  onChange: (selection: RingSelection) => void;
}) {
  const [adding, setAdding] = useState(selection.rings.length === 0);
  const rpcUrl = ringRpcUrl(ring);

  function add(added: Ring) {
    onChange(withRing(selection, added));
    setAdding(false);
  }

  function remove(id: Address) {
    const next = withoutRing(selection, id);
    onChange(next);
    if (next.rings.length === 0) setAdding(true);
  }

  return (
    <Card title="Ring">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Name"
          value={selection.selected ?? ""}
          onChange={(e) =>
            onChange({
              ...selection,
              selected: selection.rings.find((r) => r.id === e.target.value)?.id,
            })
          }
        >
          {selection.rings.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <IconButton framed title="Add a ring" onClick={() => setAdding((v) => !v)}>
          +
        </IconButton>
        {ring && (
          <IconButton framed title="Remove this ring from the list" onClick={() => remove(ring.id)}>
            ×
          </IconButton>
        )}
      </div>
      {adding && <AddRing onAdd={add} />}
      {ring ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>program</span>
            <Mono>{ring.id}</Mono>
          </div>
          <RingHealth ring={ring.id} rpcUrl={rpcUrl} />
          <ShieldedActions ring={ring} />
        </>
      ) : (
        <Hint>Add a ring to start, a name, its program id and its RPC.</Hint>
      )}
      <Hint>
        ring rpc {rpcUrl} · solana {SOLANA_RPC_URL}
      </Hint>
    </Card>
  );
}

interface Draft {
  name: string;
  id: string;
  rpc: string;
  lookupTable: string;
}

const EMPTY: Draft = { name: "", id: "", rpc: "", lookupTable: "" };

function AddRing({ onAdd }: { onAdd: (ring: Ring) => void }) {
  const [draft, setDraft] = useState(EMPTY);
  const set = (field: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [field]: e.target.value }));

  function submit() {
    const name = draft.name.trim();
    const id = draft.id.trim();
    const rpc = draft.rpc.trim();
    const lookupTable = draft.lookupTable.trim();
    if (!name) return toast.error("a name is required");
    if (!isAddress(id)) return toast.error("the ring program id is not a Solana address");
    if (lookupTable && !isAddress(lookupTable)) return toast.error("the lookup table is not a Solana address");
    onAdd({
      name,
      id,
      ...(rpc ? { rpc } : {}),
      ...(lookupTable ? { lookupTable: address(lookupTable) } : {}),
    });
    setDraft(EMPTY);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Name" value={draft.name} onChange={set("name")} />
      <Field label="Ring program id" value={draft.id} onChange={set("id")} />
      <Field label="Ring RPC URL" value={draft.rpc} placeholder={RING_RPC_URL} onChange={set("rpc")} />
      <Field
        label="Lookup table, optional"
        value={draft.lookupTable}
        placeholder="created on first transfer"
        onChange={set("lookupTable")}
      />
      <Button onClick={submit}>Add</Button>
    </div>
  );
}

function RingHealth({ ring, rpcUrl }: { ring: Address; rpcUrl: string }) {
  const health = useLoaded({ ring, rpcUrl }, async ({ ring, rpcUrl }) => {
    const status = await new RingRpc(rpcUrl).health().catch(() => {
      throw new Error(`no ring RPC answering at ${rpcUrl}`);
    });
    const ok = await servesRing(ring, status).catch(() => true);
    if (!ok) throw new Error(`the RPC at ${rpcUrl} serves another ring's auditor key`);
    return status;
  });
  switch (health.status) {
    case "loading":
      return <Badge>probing</Badge>;
    case "failed":
      return <Badge>{health.error}</Badge>;
    case "ready":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{health.value.mode}</Badge>
          <span className="text-xs text-muted">service key</span>
          <Mono>{health.value.servicePublicKey}</Mono>
        </div>
      );
  }
}

type Move = "refresh" | "deposit" | "transfer" | "burn";

function ShieldedActions({ ring }: { ring: Ring }) {
  const wallet = useWallet();
  const shielded = useShielded();
  const [amount, setAmount] = useState("0.05");
  const [recipient, setRecipient] = useState("");
  const { busy, run } = useAction<Move>();
  const lamports = parseSol(amount);
  const to = recipient.trim();
  const canAct = !busy && !!walletAddress(wallet);
  const canMove = canAct && lamports !== undefined;

  const sent = (verb: string) => (signature: string) => `${verb}, ${shortKey(signature, 8, 8)}`;
  const move = (label: Move, action: () => Promise<string>) =>
    run(label, async () => {
      toast.success(await action());
    });

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 text-sm">
          <Caption>Balance on ring</Caption>
          <span className="tabular-nums">
            {shielded.balance === undefined ? "—" : formatAmount(shielded.balance)}
          </span>
        </div>
        <Button
          onClick={() => move("refresh", () => shielded.refresh(ring.id).then(() => "synced"))}
          disabled={!canAct}
        >
          {busy === "refresh" ? "Syncing…" : "Refresh"}
        </Button>
        <Field label="Amount, SOL" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        <Button
          onClick={() => lamports && move("deposit", () => shielded.deposit(ring.id, lamports).then(sent("deposited")))}
          disabled={!canMove}
          title="Shield SOL from the wallet into the ring"
        >
          {busy === "deposit" ? "Depositing…" : "Deposit"}
        </Button>
        <Button
          onClick={() => lamports && move("burn", () => shielded.burn(ring, lamports).then(sent("burned")))}
          disabled={!canMove}
          title="Audited transfer inside the ring to a key nobody holds"
        >
          {busy === "burn" ? "Proving…" : "Burn"}
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field
          label="Recipient, Solana address"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="a registered shielded user"
        />
        <Button
          onClick={() =>
            lamports &&
            move("transfer", () =>
              isAddress(to)
                ? shielded.transfer(ring, lamports, to).then(sent("transferred"))
                : Promise.reject(new Error("the recipient is not a Solana address")),
            )
          }
          disabled={!canMove || !to}
          title="Audited transfer inside the ring to the recipient's shielded address"
        >
          {busy === "transfer" ? "Proving…" : "Transfer"}
        </Button>
      </div>
    </>
  );
}
