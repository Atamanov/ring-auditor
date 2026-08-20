import type { DecryptedRingTransaction } from "@heliuslabs/zolana/ring";
import { explorerTxUrl } from "@/lib/config";
import { formatAmount, isSol, toBase58, toHex } from "@/lib/format";
import { Key } from "./ui";

export function TransactionCard({ tx }: { tx: DecryptedRingTransaction }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-center gap-2">
          <a
            href={explorerTxUrl(tx.signature)}
            target="_blank"
            rel="noreferrer"
            title={`${tx.signature}\nopen in Solana Explorer`}
            className="font-mono text-xs underline decoration-line underline-offset-2 hover:text-accent"
          >
            {tx.signature.slice(0, 8)}…{tx.signature.slice(-8)}
          </a>
          <Key value={tx.signature} head={0} tail={0} />
        </span>
        <span className="text-xs text-muted tabular-nums">block {tx.slot.toString()}</span>
      </header>
      <Row label="signers">
        {tx.signers.map((signer) => (
          <Key key={signer} value={signer} />
        ))}
      </Row>
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
                <Key value={toHex(output.recipientViewingPublicKey)} />
              </td>
              <td className="py-1">{isSol(output.asset) ? "SOL" : <Key value={output.asset} />}</td>
              <td className="py-1 text-right tabular-nums">
                {formatAmount(output.amount, output.asset)}
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}
