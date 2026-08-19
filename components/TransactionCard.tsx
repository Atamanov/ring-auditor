import type { DecryptedRingTransaction } from "@heliuslabs/zolana/ring";
import { toBase58, toHex } from "@/lib/format";
import { Mono } from "./ui";

export function TransactionCard({ tx }: { tx: DecryptedRingTransaction }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <Mono>{tx.signature}</Mono>
        <span className="text-xs text-muted tabular-nums">slot {tx.slot.toString()}</span>
      </header>
      <Row label="signers">
        {tx.signers.map((signer) => (
          <Mono key={signer}>{signer}</Mono>
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
          {tx.outputs.map((output) => (
            <tr key={output.slotIndex} className="border-t border-line">
              <td className="py-1 tabular-nums">{output.slotIndex}</td>
              <td className="py-1">
                <Mono>{toHex(output.recipientViewingPublicKey)}</Mono>
              </td>
              <td className="py-1">
                <Mono>{output.asset}</Mono>
              </td>
              <td className="py-1 text-right tabular-nums">{output.amount.toString()}</td>
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
            <Mono key={toBase58(nullifier)}>{toBase58(nullifier)}</Mono>
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
