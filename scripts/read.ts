//   pnpm read --url http://127.0.0.1:9485 --ring <id> --keypair ~/.config/solana/id.json
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ed25519 } from "@noble/curves/ed25519.js";
import { base58 } from "@scure/base";
import type { Address } from "@solana/kit";
import { P256PublicKey } from "@heliuslabs/zolana/keypair";
import { RingRpc, readerKeyBytes, type RingReadSigner } from "@heliuslabs/zolana/ring";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://127.0.0.1:9485" },
    ring: { type: "string" },
    keypair: { type: "string" },
    limit: { type: "string" },
  },
});

if (!values.ring || !values.keypair) {
  console.error("usage: --ring <id> --keypair <file> [--limit n]");
  process.exit(2);
}

const signer = keypairSigner(values.keypair);
const rpc = new RingRpc(values.url);
const limit = values.limit ? BigInt(values.limit) : undefined;

let cursor: Uint8Array | undefined;
do {
  const page = await rpc.getDecryptedTransactions({
    ringProgramId: values.ring as Address,
    signer,
    ...(limit === undefined ? {} : { limit }),
    ...(cursor === undefined ? {} : { cursor }),
  });
  console.log(
    JSON.stringify(
      page,
      (_key, value: unknown) =>
        typeof value === "bigint"
          ? value.toString()
          : value instanceof Uint8Array
            ? Buffer.from(value).toString("hex")
            : value instanceof P256PublicKey
              ? Buffer.from(value.toBytes()).toString("hex")
              : value,
      2,
    ),
  );
  cursor = page.cursor;
} while (cursor);

// A Solana CLI keypair file is the 64-byte secret||public array.
function keypairSigner(path: string): RingReadSigner {
  const bytes = Uint8Array.from(JSON.parse(readFileSync(path, "utf8")) as number[]);
  const secret = bytes.slice(0, 32);
  return {
    reader: readerKeyBytes(base58.encode(bytes.slice(32)) as Address),
    sign: (message) => Promise.resolve(ed25519.sign(message, secret)),
  };
}
