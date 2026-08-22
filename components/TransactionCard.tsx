import type { ReactNode } from "react";
import { explorerTxUrl } from "@/lib/config";
import { formatAmount, isSol, shortKey, toBase58 } from "@/lib/format";
import type { ShownTransaction } from "@/lib/transactions";
import { Address, Key } from "./ui";

export function TransactionCard({ tx }: { tx: ShownTransaction }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-center gap-2">
          <a
            href={explorerTxUrl(tx.signature)}
            target="_blank"
            rel="noreferrer"
            title={`${tx.signature}\nopen in the explorer`}
            className="font-mono text-xs underline decoration-line underline-offset-2 hover:text-accent"
          >
            {shortKey(tx.signature, 8, 8)}
          </a>
          <Key value={tx.signature} head={0} tail={0} />
        </span>
        <span className="text-xs text-muted tabular-nums">block {tx.slot.toString()}</span>
      </header>
      {tx.sender ? (
        <Row label="sender">
          <Address value={tx.sender} />
        </Row>
      ) : (
        tx.signers.length > 0 && (
          <Row label="signers">
            {tx.signers.map((signer) => (
              <Address key={signer} value={signer} />
            ))}
          </Row>
        )
      )}
      <table className="w-full text-xs">
        <thead className="text-left text-muted">
          <tr>
            <th className="font-normal">output</th>
            <th className="font-normal">recipient</th>
            <th className="font-normal">asset</th>
            <th className="text-right font-normal">amount</th>
          </tr>
        </thead>
        <tbody>
          {tx.outputs.map((output) => (
            <tr key={output.slotIndex} className="border-t border-line">
              <td className="py-1 tabular-nums">{output.slotIndex}</td>
              <td className="py-1">
                {output.recipient ? <Address value={output.recipient} /> : <span className="text-muted">—</span>}
              </td>
              <td className="py-1">
                {isSol(output.asset) ? "SOL" : <Address value={output.asset} token />}
              </td>
              <td className="py-1 text-right tabular-nums">
                {formatAmount(output.amount, output.asset)}
                {output.spent && <span className="ml-1 text-muted">spent</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tx.undecryptableSlots.length > 0 && (
        <Row label="undecryptable">
          <span className="tabular-nums">{tx.undecryptableSlots.join(", ")}</span>
        </Row>
      )}
      {tx.nullifiers.length > 0 && (
        <Row label="nullifiers">
          {tx.nullifiers.map((nullifier) => (
            <Key key={toBase58(nullifier)} value={toBase58(nullifier)} />
          ))}
        </Row>
      )}
    </article>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}
