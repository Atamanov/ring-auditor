import type { DecryptedTransaction } from "@/lib/ringRpc";
import { Mono } from "./ui";

export function TransactionCard({ tx }: { tx: DecryptedTransaction }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <Mono>{tx.tx_signature}</Mono>
        <span className="text-xs text-muted tabular-nums">slot {tx.slot}</span>
      </header>
      <Row label="signers">
        {tx.signers.map((s) => (
          <Mono key={s}>{s}</Mono>
        ))}
      </Row>
      <table className="w-full text-xs">
        <thead className="text-left text-muted">
          <tr>
            <th className="font-normal">slot</th>
            <th className="font-normal">recipient viewing key</th>
            <th className="font-normal">asset</th>
            <th className="text-right font-normal">amount</th>
          </tr>
        </thead>
        <tbody>
          {tx.outputs.map((o) => (
            <tr key={o.slot_index} className="border-t border-line">
              <td className="py-1 tabular-nums">{o.slot_index}</td>
              <td className="py-1">
                <Mono>{o.recipient_viewing_pk}</Mono>
              </td>
              <td className="py-1">
                <Mono>{o.asset}</Mono>
              </td>
              <td className="py-1 text-right tabular-nums">{o.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {tx.undecryptable_slots.length > 0 && (
        <Row label="undecryptable">
          <span className="tabular-nums">{tx.undecryptable_slots.join(", ")}</span>
        </Row>
      )}
      {tx.nullifiers.length > 0 && (
        <Row label="nullifiers">
          {tx.nullifiers.map((n) => (
            <Mono key={n}>{n}</Mono>
          ))}
        </Row>
      )}
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}
