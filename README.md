# Ring Auditor

A small Next.js page that reads a custom ring through its Ring RPC. It shows
the two read scopes the RPC authorizes with a signature over the request.

| Read as | Key | Sees |
| --- | --- | --- |
| Ring authority | the connected wallet, which must be the ring's authority | every transaction of the ring |
| Participant, wallet | the connected wallet | the transactions the wallet signed |
| Participant, viewing key | a recipient's P-256 viewing secret | the outputs encrypted to that key |

`lib/ringRpc.ts` builds the signed request, `lib/signers.ts` holds the two ways
to sign it. The rest is the page.

## Run

The Ring RPC must allow the browser origin. In the ring repository:

```bash
RING_RPC_ALLOW_ORIGINS=http://localhost:3000 just rpc
```

Then:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, enter the RPC URL and the ring program id, connect
a wallet, pick a scope and sign. The page signs again for every page of
results, because the cursor and the time are part of the signed bytes.

## From the command line

The same request from a Solana keypair file or a viewing secret, useful to
check an RPC without a wallet:

```bash
npm run read -- --ring <program id> --keypair ~/.config/solana/id.json
npm run read -- --ring <program id> --keypair <signer.json> --scope participant
npm run read -- --ring <program id> --secret <viewing secret hex> --scope participant
```

## Wire format

`getDecryptedTransactions` takes `{ ring_program_id, cursor?, limit?, auth }`
where `auth` is `{ scope, reader, timestamp, signature }`. The reader signs
`"zolana/ring-rpc-read/v1" || scope (0 ring, 1 participant) || ring ||
timestamp u64 LE || limit u64 LE || cursor`, ed25519 over the bytes for a 32-byte
reader, ECDSA P-256 over their SHA-256 for a 33-byte SEC1 reader. The server
accepts a timestamp within one minute.
