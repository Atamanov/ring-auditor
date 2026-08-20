"use client";

import { useState } from "react";
import { loadRings, ringRpcUrl, saveRings, selectedRing, type RingSelection } from "@/lib/config";
import { loadPasskeys, savePasskeys, type StoredPasskey } from "@/lib/passkeys";
import { ShieldedProvider } from "@/lib/shielded";
import { Connection } from "./Connection";
import { Passkeys } from "./Passkeys";
import { ReadPanel } from "./ReadPanel";

// Client only, so the saved selection can seed the state without a server
// render that disagrees with it.
export default function Auditor() {
  const [selection, setSelection] = useState<RingSelection>(loadRings);
  const [passkeys, setPasskeys] = useState<StoredPasskey[]>(loadPasskeys);

  function updateSelection(next: RingSelection) {
    setSelection(next);
    saveRings(next);
  }

  function updatePasskeys(next: StoredPasskey[]) {
    setPasskeys(next);
    savePasskeys(next);
  }

  return (
    <ShieldedProvider>
      <Connection selection={selection} onChange={updateSelection} />
      <Passkeys ring={selection.selected} passkeys={passkeys} onChange={updatePasskeys} />
      <ReadPanel
        ring={selection.selected}
        rpcUrl={ringRpcUrl(selectedRing(selection))}
        passkeys={passkeys}
      />
    </ShieldedProvider>
  );
}
