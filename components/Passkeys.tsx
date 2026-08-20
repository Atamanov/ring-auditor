"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import type { Address } from "@solana/kit";
import {
  grantReaderInstruction,
  parseReaderKey,
  readerKeyToString,
  revokeReaderInstruction,
  type ReaderKey,
} from "@heliuslabs/zolana/ring";
import { sendWithWallet } from "@/lib/chain";
import { passkeyPublicKey, registerPasskey, type StoredPasskey } from "@/lib/passkeys";
import { ringRole, type RingRole } from "@/lib/role";
import { SOLANA_RPC_URL } from "@/lib/config";
import { GrantRequest } from "./GrantRequest";
import { Badge, Button, Card, Field, Key } from "./ui";

function errorMessage(e: unknown): string {
  const details = (e as { details?: { message?: string } }).details;
  return details?.message ?? (e as Error).message;
}

// Passkeys this browser registered, and the authority's grant controls. A key
// pasted from another machine can be granted here too, the list stays local.
export function Passkeys({
  ring: ringId,
  passkeys,
  onChange,
}: {
  ring: string;
  passkeys: StoredPasskey[];
  onChange: (passkeys: StoredPasskey[]) => void;
}) {
  const wallet = useWallet();
  const [label, setLabel] = useState("");
  const [pasted, setPasted] = useState("");
  const [roles, setRoles] = useState<Record<string, RingRole>>({});
  const [walletRole, setWalletRole] = useState<RingRole>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // Grants happen elsewhere (terminal, another browser), so the roles reload on
  // demand and whenever the tab comes back into focus.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener("focus", bump);
    return () => window.removeEventListener("focus", bump);
  }, []);

  const walletAddress = wallet.publicKey?.toBase58() as Address | undefined;
  const ring = ringId as Address;
  const keys = passkeys.map((p) => readerKeyToString(passkeyPublicKey(p))).join(",");

  useEffect(() => {
    if (!ringId) return;
    let live = true;
    const readers: ReaderKey[] = keys ? keys.split(",").map(parseReaderKey) : [];
    Promise.all(readers.map((reader) => ringRole(SOLANA_RPC_URL, ring, reader)))
      .then((found) => {
        if (!live) return;
        setRoles(Object.fromEntries(readers.map((r, i) => [readerKeyToString(r), found[i]!])));
      })
      .catch(() => live && setRoles({}));
    if (walletAddress) {
      ringRole(SOLANA_RPC_URL, ring, walletAddress)
        .then((r) => live && setWalletRole(r))
        .catch(() => live && setWalletRole(undefined));
    }
    return () => {
      live = false;
    };
  }, [ringId, ring, keys, walletAddress, busy, tick]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const create = () =>
    run(async () => {
      const passkey = await registerPasskey(label || `passkey ${passkeys.length + 1}`);
      onChange([...passkeys, passkey]);
      setLabel("");
    });

  const grant = (reader: ReaderKey, revoke: boolean) =>
    run(async () => {
      const authority = walletAddress!;
      const instruction = revoke
        ? await revokeReaderInstruction({
            ringProgramId: ring,
            authority,
            reader,
            rentRecipient: authority,
          })
        : await grantReaderInstruction({ ringProgramId: ring, payer: authority, authority, reader });
      await sendWithWallet(wallet, SOLANA_RPC_URL, instruction);
      setPasted("");
    });

  const isAuthority = walletRole === "authority";
  const controls = (reader: ReaderKey) => {
    const granted = roles[readerKeyToString(reader)] === "delegated reader";
    return (
      <div className="flex items-center gap-2">
        <Badge>{roles[readerKeyToString(reader)] ?? "…"}</Badge>
        {isAuthority && (
          <Button onClick={() => grant(reader, granted)} disabled={busy || !ringId}>
            {granted ? "Revoke" : "Grant"}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Passkeys
          <button
            onClick={() => setTick((n) => n + 1)}
            title="Reload grant status"
            className="text-xs text-muted hover:text-text"
          >
            ↻
          </button>
        </span>
      }
    >
      <p className="text-xs text-muted">
        A passkey (Touch ID, YubiKey) reads the ring once the authority grants its key. Copy the
        key to the authority, or grant it here with the authority wallet.
      </p>
      {passkeys.map((p) => (
        <div key={p.credentialId} className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-sm">{p.label}</span>
            <Key value={p.publicKey} />
          </div>
          <div className="flex items-center gap-2">
            {controls(passkeyPublicKey(p))}
            {roles[p.publicKey] !== "delegated reader" && (
              <GrantRequest label={p.label} readerKey={p.publicKey} />
            )}
            <button
              onClick={() => onChange(passkeys.filter((q) => q.credentialId !== p.credentialId))}
              className="text-xs text-muted hover:text-text"
            >
              forget
            </button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Button onClick={create} disabled={busy}>
          Create passkey
        </Button>
      </div>
      {isAuthority && (
        <div className="flex flex-wrap items-end gap-3">
          <Field
            label="Key to grant, base58 or hex"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <Button
            onClick={() => grant(parseReaderKey(pasted), false)}
            disabled={busy || !pasted.trim()}
          >
            Grant
          </Button>
        </div>
      )}
      {error && <span className="text-sm text-accent-hover">{error}</span>}
    </Card>
  );
}
