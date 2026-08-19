"use client";

import { useEffect, useState } from "react";
import { health, type Health } from "@/lib/ringRpc";
import { Badge, Card, Field, Mono } from "./ui";

export interface Target {
  url: string;
  ring: string;
}

export function Connection({
  target,
  onChange,
}: {
  target: Target;
  onChange: (target: Target) => void;
}) {
  const [status, setStatus] = useState<Health | string>("probing");

  useEffect(() => {
    let live = true;
    health(target.url)
      .then((h) => live && setStatus(h))
      .catch((e: Error) => live && setStatus(e.message));
    return () => {
      live = false;
    };
  }, [target.url]);

  return (
    <Card title="Ring RPC">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="URL"
          value={target.url}
          onChange={(e) => onChange({ ...target, url: e.target.value })}
        />
        <Field
          label="Ring program id"
          value={target.ring}
          onChange={(e) => onChange({ ...target, ring: e.target.value })}
        />
      </div>
      {typeof status === "string" ? (
        <Badge>{status}</Badge>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{status.mode}</Badge>
          <span className="text-xs text-muted">service key</span>
          <Mono>{status.service_pubkey}</Mono>
        </div>
      )}
    </Card>
  );
}
