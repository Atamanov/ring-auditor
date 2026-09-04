"use client";

import { useState } from "react";
import type { Address } from "@solana/kit";
import type { LiveEntry } from "@heliuslabs/zolana/ring";
import { explorerTxUrl } from "@/lib/config";
import { shortKey, toHex } from "@/lib/format";
import { useAction, useLoaded, useRefreshToken } from "@/lib/hooks";
import {
  describeRule,
  listName,
  loadPolicy,
  lookupMember,
  scanEntries,
  sourceLabel,
  type ListEntries,
  type MemberState,
  type PolicyView,
} from "@/lib/policy";
import { Badge, Button, Caption, Card, Field, Hint, IconButton, Key } from "./ui";

type PolicyRing = Extract<PolicyView, { hasPolicy: true }>;

export function PolicyPanel({ ring }: { ring: Address | undefined }) {
  const [token, reload] = useRefreshToken();
  const view = useLoaded(ring && { ring, token }, ({ ring }) => loadPolicy(ring));
  const policy = view.status === "ready" && view.value.hasPolicy ? view.value : undefined;
  return (
    <>
      <Card
        title={
          <span className="flex items-center gap-2">
            Policy
            <IconButton title="Reload the policy" onClick={reload}>
              ↻
            </IconButton>
          </span>
        }
      >
        {!ring ? (
          <Hint>Add a ring to see its policy.</Hint>
        ) : view.status === "loading" ? (
          <Badge>reading</Badge>
        ) : view.status === "failed" ? (
          <Badge>{view.error}</Badge>
        ) : policy ? (
          <Pinned view={policy} />
        ) : (
          <Hint>An audit-only ring, no policy is pinned.</Hint>
        )}
      </Card>
      {policy && ring && <Lists ring={ring} view={policy} />}
      {policy && <Lookup view={policy} />}
    </>
  );
}

function Pinned({ view }: { view: PolicyRing }) {
  const { policy, table, sources } = view;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <Line label="entries tree">
        <Key value={policy.entriesTree} head={8} tail={8} />
      </Line>
      <Line label="generation">
        <span className="tabular-nums">
          {policy.generation} at slot {policy.generationSlot.toString()}
        </span>
      </Line>
      <Line label="hash">
        <Key value={toHex(policy.policyHash)} head={8} tail={8} />
      </Line>
      {table.status === "undecodable" ? (
        <Line label="rules">undecodable ({table.reason})</Line>
      ) : table.table.rules.length === 0 ? (
        <Line label="rules">none, an empty table</Line>
      ) : (
        table.table.rules.map((rule, index) => (
          <Line key={index} label={`rule ${index + 1}`}>
            {describeRule(rule)}
          </Line>
        ))
      )}
      {table.status === "decoded" && table.table.inlineAssets.length > 0 && (
        <Line label="assets">{table.table.inlineAssets.length} listed inline</Line>
      )}
      {sources.map((source) => (
        <Line key={source.listId} label={`${listName(source.listId)} list`}>
          {sourceLabel(source)}
        </Line>
      ))}
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="w-28 shrink-0">
        <Caption>{label}</Caption>
      </span>
      <span className="break-all">{children}</span>
    </div>
  );
}

function Lists({ ring, view }: { ring: Address; view: PolicyRing }) {
  const [scan, setScan] = useState(0);
  const [query, setQuery] = useState("");
  const lists = useLoaded(
    scan > 0 ? { ring, generation: view.policy.generation, scan } : undefined,
    () => scanEntries(view),
  );
  const readable = view.sources.some((source) => source.namespace !== undefined);
  return (
    <Card title="Lists">
      <Hint>Each entry is walked through the indexer, a large list takes a while.</Hint>
      <div className="flex flex-wrap items-end gap-3">
        <Button onClick={() => setScan((n) => n + 1)} disabled={!readable || (scan > 0 && lists.status === "loading")}>
          {scan > 0 && lists.status === "loading" ? "Reading…" : scan > 0 ? "Read again" : "Read entries"}
        </Button>
        {lists.status === "failed" && <Badge>{lists.error}</Badge>}
        {!readable && <Badge>no list has a source</Badge>}
        {lists.status === "ready" && (
          <div className="min-w-64 grow">
            <Field
              label="Search member or signature"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="…"
            />
          </div>
        )}
      </div>
      {lists.status === "ready" &&
        lists.value.map((list) => <ListTable key={list.listId} list={list} query={query} />)}
    </Card>
  );
}

function ListTable({ list, query }: { list: ListEntries; query: string }) {
  const needle = query.trim().toLowerCase();
  const shown = list.entries.filter(
    (live) => !needle || toHex(live.entry.member).includes(needle) || live.txSignature.toLowerCase().includes(needle),
  );
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">
        {listName(list.listId)}{" "}
        <span className="text-muted">
          {needle ? `${shown.length} of ` : ""}
          {list.entries.length} entr{list.entries.length === 1 ? "y" : "ies"}
        </span>
      </h3>
      {shown.length > 0 && (
        <table className="w-full text-xs">
          <thead className="text-left text-muted">
            <tr>
              <th className="pr-4 pb-1 font-normal">member</th>
              <th className="pr-4 pb-1 font-normal">state</th>
              <th className="pr-4 pb-1 text-right font-normal">version</th>
              <th className="pb-1 font-normal">written by</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((live) => (
              <EntryRow key={toHex(live.entry.member)} live={live} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function EntryRow({ live }: { live: LiveEntry }) {
  return (
    <tr className="border-t border-line">
      <td className="py-1.5 pr-4">
        <Key value={toHex(live.entry.member)} head={8} tail={8} />
      </td>
      <td className="py-1.5 pr-4">
        <Badge>{live.entry.state}</Badge>
      </td>
      <td className="py-1.5 pr-4 text-right tabular-nums">{live.entry.version.toString()}</td>
      <td className="py-1.5 whitespace-nowrap">
        <a
          href={explorerTxUrl(live.txSignature)}
          target="_blank"
          rel="noreferrer"
          title={`${live.txSignature}\nopen in Solana Explorer`}
          className="font-mono underline decoration-line underline-offset-2 hover:text-accent"
        >
          {shortKey(live.txSignature, 8, 8)}
        </a>
      </td>
    </tr>
  );
}

function Lookup({ view }: { view: PolicyRing }) {
  const [tag, setTag] = useState("");
  const [states, setStates] = useState<readonly MemberState[]>();
  const { busy, run } = useAction();
  const look = () =>
    run("lookup", async () => {
      setStates(undefined);
      setStates(await lookupMember(view, tag));
    });
  return (
    <Card title="Lookup">
      <Hint>
        The base58 owner tag or mint as zolana-ring list show takes it. Each referenced list
        answers active, cleared or unclaimed.
      </Hint>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Owner tag or mint" value={tag} onChange={(e) => setTag(e.target.value)} />
        <Button onClick={look} disabled={!!busy || !tag.trim() || view.sources.length === 0}>
          {busy ? "Reading…" : "Look up"}
        </Button>
      </div>
      {states && (
        <div className="flex flex-wrap items-center gap-3">
          {states.map((state) => (
            <span key={state.listId} className="flex items-center gap-1">
              <Caption>{listName(state.listId)}</Caption>
              <Badge>
                {state.state}
                {state.version === undefined ? "" : ` v${state.version}`}
              </Badge>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
