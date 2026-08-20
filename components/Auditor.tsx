"use client";

import { useState } from "react";
import { loadPasskeys, savePasskeys, type StoredPasskey } from "@/lib/passkeys";
import { Connection, type Target } from "./Connection";
import { Passkeys } from "./Passkeys";
import { ReadPanel } from "./ReadPanel";

const STORAGE = "ring-auditor.target";
const DEFAULT: Target = {
  url: "http://127.0.0.1:9485",
  ring: "",
  solanaRpc: "http://127.0.0.1:9599",
};

// Client only, so the saved target can seed the state without a server render
// that disagrees with it.
export default function Auditor() {
  const [target, setTarget] = useState<Target>(() => ({
    ...DEFAULT,
    ...JSON.parse(localStorage.getItem(STORAGE) ?? "{}"),
  }));

  const [passkeys, setPasskeys] = useState<StoredPasskey[]>(loadPasskeys);

  function update(next: Target) {
    setTarget(next);
    localStorage.setItem(STORAGE, JSON.stringify(next));
  }

  function updatePasskeys(next: StoredPasskey[]) {
    setPasskeys(next);
    savePasskeys(next);
  }

  return (
    <>
      <Connection target={target} onChange={update} />
      <Passkeys target={target} passkeys={passkeys} onChange={updatePasskeys} />
      <ReadPanel target={target} passkeys={passkeys} />
    </>
  );
}
