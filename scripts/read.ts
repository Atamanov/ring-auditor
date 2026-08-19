// Reads a ring from the command line with the same SDK the page uses.
//   npm run read -- --url http://127.0.0.1:9485 --ring <id> --keypair ~/.config/solana/id.json [--scope ring|participant]
//   npm run read -- --ring <id> --secret <viewing secret hex> --scope participant
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ed25519 } from "@noble/curves/ed25519.js";
import type { Address } from "@solana/kit";
import {
  RingRpc,
  type RingReadScope,
  type RingReadSigner,
} from "@heliuslabs/zolana/ring";
import { viewingKeySigner } from "../lib/signers.ts";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://127.0.0.1:9485" },
    ring: { type: "string" },
    keypair: { type: "string" },
    secret: { type: "string" },
    scope: { type: "string", default: "ring" },
    limit: { type: "string" },
  },
});

if (!values.ring || (!values.keypair && !values.secret)) {
  console.error(
    "usage: --ring <id> (--keypair <file> | --secret <hex>) [--scope ring|participant] [--limit n]",
  );
  process.exit(2);
}

const signer: RingReadSigner = values.secret
  ? viewingKeySigner(values.secret)
  : keypairSigner(values.keypair!);
const rpc = new RingRpc(values.url);
const scope = values.scope as RingReadScope;
const limit = values.limit ? BigInt(values.limit) : undefined;

let cursor: Uint8Array | undefined;
do {
  const page = await rpc.getDecryptedTransactions({
    ringProgramId: values.ring as Address,
    scope,
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
    reader: bytes.slice(32),
    sign: (message) => Promise.resolve(ed25519.sign(message, secret)),
  };
}
