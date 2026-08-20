"use client";

import { useState } from "react";
import { Connection, type Target } from "./Connection";
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

  function update(next: Target) {
    setTarget(next);
    localStorage.setItem(STORAGE, JSON.stringify(next));
  }

  return (
    <>
      <Connection target={target} onChange={update} />
      <ReadPanel target={target} />
    </>
  );
}
