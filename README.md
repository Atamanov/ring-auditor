# Ring Auditor

A small Next.js page that reads a custom ring through its Ring RPC. It shows
the two read scopes the RPC authorizes with a signature over the request.

| Read as | Key | Sees |
| --- | --- | --- |
| Ring auditor | the connected wallet, the ring's authority or a reader it granted | every transaction of the ring |
| Ring auditor, passkey | a passkey (Touch ID, YubiKey) the authority granted | every transaction of the ring |
| Participant | the connected wallet, plus the viewing key derived from it | the transactions the wallet signed, and the outputs sent to it |

The page reads the ring config and the wallet's reader record from the Solana
RPC and shows the wallet's role (authority, delegated reader, participant only)
before it signs anything.

The wire work lives in `@heliuslabs/zolana/ring` (`RingRpc`, the attestation
layout, the P-256 reader). `lib/signers.ts` adapts the browser wallet to the
SDK's `RingReadSigner`, and derives the wallet's viewing key with one
`signMessage` over the bare derivation payload `TSPP/derive/v1` (browser
wallets refuse the off-chain envelope). The key lives in page state only.

The Ring card lists named rings, `+` adds one, and **Test transact** runs two
ring deposits and one audited transfer from the connected wallet, signed in
the wallet, so the Participant view has the wallet's own transfer to show.
Service URLs are deployment settings in `.env.local` (see `.env.example`).

## Delegating reads

The authority grants ring-scope reads to another key on chain, so the authority
key never has to sign in a browser and a Squads-held authority can grant by
proposal. Either from the ring repository, with a base58 wallet key or the hex
key of a passkey:

```bash
just grant-reader <key>
just revoke-reader <key>
```

or from the page: connect the authority wallet and the Passkeys card shows
Grant and Revoke for every listed key, plus a field for a key pasted from
another machine.

## Passkeys

1. Auditor: Passkeys card, "Create passkey". The browser offers Touch ID or a
   security key. The page keeps the credential id and the public key, nothing
   secret, and shows the key.
2. Authority: grant the key, from the page or the CLI.
3. Auditor: "Ring auditor", sign with the passkey, touch. Every read is one
   gesture, the signature covers the page it requests.
4. Authority: revoke. The next read fails with `unauthorized`.

A passkey signs through WebAuthn, so the ring RPC checks the page's origin
against `RING_RPC_ALLOW_ORIGINS`, the same list that allows the browser to call
it. An RPC without that list accepts no passkey. Safari, Chrome and Brave share
the flow; the YubiKey needs a PIN or touch set up for user verification.

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

Copy `.env.example` to `.env.local` and set the ring, then open
<http://localhost:3000>, connect a wallet, pick a scope and sign. The page signs again for every page of
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
this repository (`npm run build:ts` there refreshes it).
