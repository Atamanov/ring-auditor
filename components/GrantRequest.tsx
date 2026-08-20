"use client";

import { useState } from "react";
import { Modal, Mono } from "./ui";

// A key that cannot read the ring yet, and what to send the operator so it can.
export function GrantRequest({ label, readerKey }: { label: string; readerKey: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Request a grant from the ring operator"
        className="rounded-full border border-line px-2 py-0.5 text-xs text-muted hover:text-text"
      >
        ✉
      </button>
      {open && (
        <Modal title={`Grant for ${label}`} onClose={() => setOpen(false)}>
          <p className="text-sm">
            Send this key to the ring operator. The ring authority grants it on chain, then it
            reads the whole ring. The key is public.
          </p>
          <Copyable label="Reader key" value={readerKey} />
          <Copyable
            label="What the operator runs in the ring repository"
            value={`just grant-reader ${readerKey}`}
          />
          <p className="text-xs text-muted">
            An operator with the authority wallet can also open this page and grant the key from the
            Passkeys card. Once granted, Ring auditor → Sign and read.
          </p>
        </Modal>
      )}
    </>
  );
}

function Copyable({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted uppercase tracking-wide text-xs">{label}</span>
      <div className="flex items-center gap-2 rounded border border-line bg-bg px-3 py-2">
        <Mono>{value}</Mono>
        <button
          onClick={() => navigator.clipboard.writeText(value)}
          className="shrink-0 text-xs text-muted hover:text-text"
        >
          copy
        </button>
      </div>
    </div>
  );
}
