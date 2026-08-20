# Showcase

Devnet ring `4629XhR1jRFZVck1Ss7y1KtTqLHfmhnuomBhmTGh2RYP`, repo `~/rings/demo`.
Authority `2GNuM5ksdfNxGNbwf2hrnND9FHgQsdju7vz8CyGd7Zjy` (`~/.config/solana/id.json`).

## Before

```bash
cd ~/rings/demo && RING_RPC_ALLOW_ORIGINS=http://localhost:3000 just rpc   # ring RPC on :9485
cd ~/Projects/Helius/dev/ring-auditor && npm run dev                          # page on :3000
```

`.env.local` already points the page at the ring. Phantom on devnet.

## 1. Auditor, wallet

Connect the authority wallet, "Ring auditor", Sign and read. Badge says
"authority", every transaction renders. Sign again for "Older".

## 2. Auditor, passkey

Passkeys card, label, Create passkey. Pick Touch ID or the YubiKey in the
browser sheet. The key shows as hex, badge "participant only".

Grant it, either way:

- page: the authority wallet is connected, click Grant next to the key
- terminal: `cd ~/rings/demo && just grant-reader <hex>`

Badge flips to "delegated reader". "Ring auditor", sign with `passkey · <label>`,
Sign and read, touch. Same ring page, the wallet signs nothing.

## 3. Revoke

Revoke on the page or `just revoke-reader <hex>`. Sign and read again:
`unauthorized: reader is not the ring authority or a granted reader`.

## 4. Participant

"Participant", Sign and read. Two wallet prompts, the derivation text
`TSPP/derive/v1` and the read. "Sent" lists what the wallet signed, "Received"
what its derived viewing key can open.

## Client test

Same page, their wallet: step 4 works for anyone. For step 2 they send the
passkey hex, you grant it.
