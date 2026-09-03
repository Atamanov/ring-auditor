"use client";

import { useState } from "react";
import { ringStore } from "@/lib/rings";
import { ringRpcUrl, selectedRing } from "@/lib/config";
import { useStored } from "@/lib/hooks";
import { passkeyStore } from "@/lib/passkeys";
import { ShieldedProvider } from "@/lib/shielded";
import { Passkeys } from "./Passkeys";
import { PolicyPanel } from "./PolicyPanel";
import { ReadPanel } from "./ReadPanel";
import { RingCard } from "./RingCard";
import { Pills } from "./ui";

type Tab = "transactions" | "policies";

const TABS = [
  { id: "transactions", label: "Transactions" },
  { id: "policies", label: "Policies" },
] as const satisfies readonly { id: Tab; label: string }[];

export default function Auditor() {
  const [selection, setSelection] = useStored(ringStore);
  const [passkeys, setPasskeys] = useStored(passkeyStore);
  const [tab, setTab] = useState<Tab>("transactions");
  const ring = selectedRing(selection);
  return (
    <ShieldedProvider>
      <RingCard selection={selection} ring={ring} onChange={setSelection} />
      <Pills options={TABS} value={tab} onChange={setTab} />
      {/* Hidden, not unmounted, a tab switch keeps the loaded pages. */}
      <div hidden={tab !== "transactions"} className="contents">
        <Passkeys ring={ring?.id} passkeys={passkeys} onChange={setPasskeys} />
        <ReadPanel ring={ring?.id} rpcUrl={ringRpcUrl(ring)} passkeys={passkeys} />
      </div>
      <div hidden={tab !== "policies"} className="contents">
        <PolicyPanel ring={ring?.id} />
      </div>
    </ShieldedProvider>
  );
}
