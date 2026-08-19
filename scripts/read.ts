// Reads a ring from the command line with the same bytes the browser signs.
//   npm run read -- --url http://127.0.0.1:9485 --ring <id> --keypair ~/.config/solana/id.json [--scope ring|participant] [--secret <hex>]
// `--keypair` signs as ed25519 (ring authority or transaction signer),
// `--secret` signs as a P-256 recipient viewing key.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ed25519 } from "@noble/curves/ed25519.js";
import { viewingKeySigner } from "../lib/signers.ts";
import {
  getDecryptedTransactions,
  signRead,
  type ReadScope,
  type Signer,
} from "../lib/ringRpc.ts";

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
  console.error("usage: --ring <id> (--keypair <file> | --secret <hex>) [--scope ring|participant] [--limit n]");
  process.exit(2);
}

const signer: Signer = values.secret
  ? viewingKeySigner(values.secret)
  : keypairSigner(values.keypair!);
const scope = values.scope as ReadScope;
const limit = values.limit ? Number(values.limit) : undefined;

let cursor: string | undefined;
do {
  const request = await signRead(scope, values.ring, signer, cursor, limit);
  const { value } = await getDecryptedTransactions(values.url, request);
  console.log(JSON.stringify(value, null, 2));
  cursor = value.cursor ?? undefined;
} while (cursor);

// A Solana CLI keypair file is the 64-byte secret||public array.
function keypairSigner(path: string): Signer {
  const bytes = Uint8Array.from(JSON.parse(readFileSync(path, "utf8")) as number[]);
  const secret = bytes.slice(0, 32);
  return {
    reader: bytes.slice(32),
    sign: async (message) => ed25519.sign(message, secret),
  };
}
