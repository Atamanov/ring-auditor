# Ring Auditor

A small Next.js page that reads a custom ring through its Ring RPC. It shows
the two read scopes the RPC authorizes with a signature over the request.

| Read as | Key | Sees |
| --- | --- | --- |
| Ring auditor | the connected wallet, the ring's authority or a reader it granted | every transaction of the ring |
| Participant | the connected wallet, plus the viewing key derived from it | the transactions the wallet signed, and the outputs sent to it |

The page reads the ring config and the wallet's reader record from the Solana
RPC and shows the wallet's role (authority, delegated reader, participant only)
before it signs anything.

The wire work lives in `@heliuslabs/zolana/ring` (`RingRpc`, the attestation
layout, the P-256 reader). `lib/signers.ts` adapts the browser wallet to the
SDK's `RingReadSigner`, and derives the wallet's viewing key with one
`signMessage` over the SDK's derivation message, the same key the SDK wallet
derives. The key lives in page state only. The rest is the page.

## Delegating reads

The authority grants ring-scope reads to another key on chain, so the authority
key never has to sign in a browser and a Squads-held authority can grant by
proposal. In the ring repository:

```bash
just grant-reader <wallet pubkey>
just revoke-reader <wallet pubkey>
```

A granted wallet reads as "Ring auditor" like the authority does.

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

Open <http://localhost:3000>, enter the RPC URL, the ring program id and the
Solana RPC URL, connect a wallet, pick a scope and sign. The page signs again for every page of
results, because the cursor and the time are part of the signed bytes.

## From the command line

The same request from a Solana keypair file or a viewing secret, useful to
check an RPC without a wallet. The `--secret` form is the only place a raw
viewing secret is accepted:

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
