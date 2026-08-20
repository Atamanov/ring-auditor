import type { WalletContextState } from "@solana/wallet-adapter-react";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { getTransactionEncoder, type Address, type Transaction } from "@solana/kit";
import {
  LocalWalletAuthority,
  Wallet,
  createZolanaClient,
  syncWallet,
} from "@heliuslabs/zolana";
import { ShieldedKeypair, SigningKey, ed25519DerivationPayload, type Bytes32 } from "@heliuslabs/zolana/keypair";
import {
  RingRpc,
  buildRingDepositTransaction,
  buildRingLookupTableTransaction,
  buildRingTransferTransaction,
} from "@heliuslabs/zolana/ring";
import { INDEXER_URL, PROVER_URL, RING_RPC_URL, SOLANA_RPC_URL, TREE } from "./config";

const AMOUNT = 50_000_000n;

// Two ring deposits and one audited transfer from the connected wallet to a
// fresh recipient, every transaction signed by the wallet. The wallet's
// shielded keys come from its signature over the derivation payload, the same
// keys the Participant view reads with, so the transfer shows up there as sent.
export async function testTransact(
  wallet: WalletContextState,
  ring: Address,
  status: (step: string) => void,
): Promise<string> {
  const { publicKey, signMessage, signTransaction } = wallet;
  if (!publicKey || !signMessage || !signTransaction) throw new Error("connect a wallet first");
  const feePayer = publicKey.toBase58() as Address;
  status("loading hasher");
  const client = await createZolanaClient({
    solanaRpcUrl: SOLANA_RPC_URL,
    indexerUrl: INDEXER_URL,
    proverUrl: PROVER_URL,
    tree: TREE,
    allowInsecureHttp: true,
  });
  status("deriving the wallet's shielded keys");
  const authority = LocalWalletAuthority.fromDerivationSeed({
    solanaPublicKey: feePayer,
    derivationSeed: await signMessage(ed25519DerivationPayload()),
  });
  const identity = await authority.shieldedAddress();
  const shielded = new Wallet({ identity });
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const send = async (transaction: Transaction) => {
    const wire = new Uint8Array(getTransactionEncoder().encode(transaction));
    const signed = await signTransaction(VersionedTransaction.deserialize(wire));
    const signature = await connection.sendRawTransaction(signed.serialize());
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
    return signature;
  };

  for (let index = 1; index <= 2; index++) {
    status(`deposit ${index} of 2`);
    await send(
      await buildRingDepositTransaction({
        client,
        ringProgramId: ring,
        feePayer,
        recipient: identity,
        amount: AMOUNT,
      }),
    );
  }
  status("syncing the wallet");
  await syncWallet({
    client,
    wallet: shielded,
    authority,
    config: { requireSlot: BigInt(await client.solanaRpc.getSlot().send()) },
  });
  status("lookup table");
  const table = await buildRingLookupTableTransaction({ client, ringProgramId: ring, feePayer });
  await send(table.transaction);
  // A lookup table serves transactions only from the slot after its writes.
  const writtenAt = await client.solanaRpc.getSlot().send();
  while ((await client.solanaRpc.getSlot().send()) <= writtenAt) {
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  status("proving the transfer");
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  const recipient = ShieldedKeypair.fromKeypair(SigningKey.fromEd25519Bytes(seed as Bytes32));
  return send(
    await buildRingTransferTransaction({
      client,
      ringRpc: new RingRpc(RING_RPC_URL),
      ringProgramId: ring,
      wallet: shielded,
      authority,
      feePayer,
      recipient: recipient.shieldedAddress(),
      amount: AMOUNT,
      lookupTable: table.address,
    }),
  );
}
