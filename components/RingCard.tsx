"use client";

import { Plus, X } from "@phosphor-icons/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { toast } from "sonner";
import { isAddress, type Address } from "@solana/kit";
import { walletAddress } from "@/lib/chain";
import {
  RING_RPC_URL,
  SOLANA_RPC_URL,
  withRing,
  withoutRing,
  type Ring,
  type RingSelection,
} from "@/lib/config";
import { encodeShieldedAddress, parseRecipient, type Recipient } from "@/lib/address";
import { formatAmount, parseSol, shortKey } from "@/lib/format";
import { useAction, useLoaded } from "@/lib/hooks";
import { isTimeout, ringRpc, RING_RPC_TIMEOUT_MS } from "@/lib/ring-rpc";
import { servesRing } from "@/lib/role";
import { useShielded } from "@/lib/shielded";
import { Setup } from "./Setup";
import { Badge, Button, Caption, Card, Field, Hint, IconButton, Key, Modal, Mono, Select } from "./ui";

export function RingCard({
  selection,
  ring,
  onChange,
}: {
  selection: RingSelection;
  ring: Ring | undefined;
  onChange: (selection: RingSelection) => void;
}) {
  const [adding, setAdding] = useState(false);
  // No ring has ever been added in this browser, the wizard says where one comes from.
  const [setup, setSetup] = useState(selection.rings.length === 0);

  function add(added: Ring) {
    onChange(withRing(selection, added));
    setAdding(false);
    setSetup(false);
  }

  function remove(id: Address) {
    const next = withoutRing(selection, id);
    onChange(next);
    if (next.rings.length === 0) setSetup(true);
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
          <Plus size={14} weight="bold" />
        </IconButton>
        {ring && (
          <IconButton framed title="Remove this ring from the list" onClick={() => remove(ring.id)}>
            <X size={14} weight="bold" />
          </IconButton>
        )}
      </div>
      {adding && <AddRing onAdd={add} />}
      {setup && <Setup onAdd={add} onClose={() => setSetup(false)} />}
      {ring ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>program</span>
            <Mono>{ring.id}</Mono>
          </div>
          <RingHealth ring={ring.id} rpcUrl={RING_RPC_URL} />
          <ShieldedActions ring={ring} />
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setSetup(true)}>Add a ring</Button>
          <Hint>A name and the ring program id, or how to generate a ring.</Hint>
        </div>
      )}
      <Hint>
        ring rpc {RING_RPC_URL} · solana {SOLANA_RPC_URL}
      </Hint>
    </Card>
  );
}

interface Draft {
  name: string;
  id: string;
}

const EMPTY: Draft = { name: "", id: "" };

function AddRing({ onAdd }: { onAdd: (ring: Ring) => void }) {
  const [draft, setDraft] = useState(EMPTY);
  const set = (field: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [field]: e.target.value }));

  function submit() {
    const name = draft.name.trim();
    const id = draft.id.trim();
    if (!name) return toast.error("a name is required");
    if (!isAddress(id)) return toast.error("the ring program id is not a Solana address");
    onAdd({ name, id });
    setDraft(EMPTY);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Name" value={draft.name} onChange={set("name")} />
      <Field label="Ring program id" value={draft.id} onChange={set("id")} />
      <Button onClick={submit}>Add</Button>
    </div>
  );
}

function RingHealth({ ring, rpcUrl }: { ring: Address; rpcUrl: string }) {
  const health = useLoaded({ ring, rpcUrl }, async ({ ring, rpcUrl }) => {
    const status = await ringRpc(rpcUrl)
      .health()
      .catch((e: unknown) => {
        if (isTimeout(e)) {
          throw new Error(`the ring RPC at ${rpcUrl} did not answer in ${RING_RPC_TIMEOUT_MS / 1000}s`);
        }
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
  const [transferring, setTransferring] = useState(false);
  const { busy, run } = useAction<Move>();
  const lamports = parseSol(amount);
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
        {shielded.address && (
          <div className="flex flex-col gap-1 text-sm">
            <Caption>Shielded address</Caption>
            <Key value={encodeShieldedAddress(shielded.address)} head={8} tail={8} />
          </div>
        )}
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
          onClick={() => setTransferring(true)}
          disabled={!canMove}
          title="Audited transfer inside the ring to the recipient's shielded address"
        >
          {busy === "transfer" ? "Proving…" : "Transfer"}
        </Button>
        <Button
          onClick={() => lamports && move("burn", () => shielded.burn(ring, lamports).then(sent("burned")))}
          disabled={!canMove}
          title="Audited transfer inside the ring to a key nobody holds"
        >
          {busy === "burn" ? "Proving…" : "Burn"}
        </Button>
      </div>
      {transferring && lamports !== undefined && (
        <TransferModal
          ring={ring}
          lamports={lamports}
          onClose={() => setTransferring(false)}
          onConfirm={(to, publicly) => {
            setTransferring(false);
            void move("transfer", () =>
              publicly && typeof to === "string"
                ? shielded.withdraw(ring, lamports, to).then(sent("withdrawn publicly"))
                : shielded.transfer(ring, lamports, to).then(sent("transferred")),
            );
          }}
        />
      )}
    </>
  );
}

function TransferModal({
  ring,
  lamports,
  onClose,
  onConfirm,
}: {
  ring: Ring;
  lamports: bigint;
  onClose: () => void;
  onConfirm: (to: Recipient, publicly: boolean) => void;
}) {
  const shielded = useShielded();
  const [recipient, setRecipient] = useState("");
  const to = parseRecipient(recipient);
  // Only a Solana address needs a record. A shielded address carries the keys.
  const record = useLoaded(typeof to === "string" ? { to } : undefined, ({ to }) =>
    shielded.registered(to),
  );
  const exits = typeof to === "string" && record.status === "ready" && !record.value;
  return (
    <Modal title={`Transfer ${formatAmount(lamports)} inside ${ring.name}`} onClose={onClose}>
      <p className="text-sm">
        A shielded address, as shown under the balance, needs no registration. A Solana address
        needs a registry record to receive a note. The note stays in the ring and the auditor can
        read it.
      </p>
      <Field
        label="Recipient, shielded or Solana address"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        autoFocus
      />
      {typeof to === "string" && record.status === "loading" && <Hint>checking the registry…</Hint>}
      {exits && (
        <div className="rounded border border-accent/60 bg-accent-ground p-3 text-sm">
          <p className="font-medium text-accent">This leaves the ring in public.</p>
          <p className="mt-1 text-muted">
            {shortKey(to, 8, 8)} has no registry record, so it cannot hold a shielded note. Sending
            anyway withdraws {formatAmount(lamports)} to it as plain SOL, and the recipient, the
            amount and the asset are visible on chain. Your remaining balance stays hidden and the
            auditor still sees the exit.
          </p>
        </div>
      )}
      <div className="flex justify-end">
        <Button
          onClick={() =>
            to
              ? onConfirm(to, exits)
              : toast.error("the recipient is not a shielded or Solana address")
          }
          disabled={!recipient.trim() || record.status === "loading"}
        >
          {exits ? "Withdraw publicly" : "Sign and transfer"}
        </Button>
      </div>
    </Modal>
  );
}
