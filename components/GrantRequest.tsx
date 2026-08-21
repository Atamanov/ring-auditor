"use client";

import { useState } from "react";
import { Copyable, Hint, Modal } from "./ui";

export function GrantRequest({ label, readerKey }: { label: string; readerKey: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Request a grant from the ring operator"
        aria-label="Request a grant from the ring operator"
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
          <Hint>
            An operator with the authority wallet can also open this page and grant the key from the
            Passkeys card. Once granted, Ring auditor → Sign and read.
          </Hint>
        </Modal>
      )}
    </>
  );
}
