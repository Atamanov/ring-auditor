# Ring Auditor

A small Next.js page that reads a custom ring through its Ring RPC. It shows
the two read scopes the RPC authorizes with a signature over the request.

| Read as | Key | Sees |
| --- | --- | --- |
| Ring authority | the connected wallet, which must be the ring's authority | every transaction of the ring |
| Participant, wallet | the connected wallet | the transactions the wallet signed |
| Participant, viewing key | a recipient's P-256 viewing secret | the outputs encrypted to that key |

The wire work lives in `@heliuslabs/zolana/ring` (`RingRpc`, the attestation
layout, the P-256 reader). `lib/signers.ts` only adapts the browser wallet and
a pasted viewing secret to the SDK's `RingReadSigner`. The rest is the page.

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

The request layout and the signed attestation are documented on
`ringReadAttestation` in `@heliuslabs/zolana/ring`, whose bytes are pinned
against the Rust server by the SDK's tests. The page signs again for every
request because the cursor and the time are both part of the signature.

The SDK is consumed as a `file:` dependency on the zolana checkout next to
this repository (`npm run build:ts` there refreshes it). The page never
hashes, so the SDK's Poseidon WASM is stubbed out of the bundle in
`next.config.ts`.
