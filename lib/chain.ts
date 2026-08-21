import type { WalletContextState } from "@solana/wallet-adapter-react";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createSolanaRpc,
  createTransactionMessage,
  getTransactionEncoder,
  isTransactionWithBlockhashLifetime,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Instruction,
  type Transaction,
} from "@solana/kit";
import { SOLANA_RPC_URL } from "./config";

export function walletAddress(wallet: WalletContextState): Address | undefined {
  return wallet.publicKey?.toBase58() as Address | undefined;
}

export function connectedAddress(wallet: WalletContextState): Address {
  const address = walletAddress(wallet);
  if (!address) throw new Error("connect a wallet first");
  return address;
}

/** One instruction in a fresh transaction, the wallet pays and signs. */
export async function sendInstruction(
  wallet: WalletContextState,
  instruction: Instruction,
  computeUnitLimit?: number,
): Promise<string> {
  const feePayer = connectedAddress(wallet);
  const { value: blockhash } = await createSolanaRpc(SOLANA_RPC_URL).getLatestBlockhash().send();
  const instructions =
    computeUnitLimit === undefined
      ? [instruction]
      : [computeUnitLimitInstruction(computeUnitLimit), instruction];
  const transaction = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
    compileTransaction,
  );
  return sendTransaction(wallet, transaction);
}

/** `SetComputeUnitLimit`, tag 2 then the limit as little-endian u32. */
function computeUnitLimitInstruction(units: number): Instruction {
  const data = new Uint8Array(5);
  data[0] = 2;
  new DataView(data.buffer).setUint32(1, units, true);
  return { programAddress: "ComputeBudget111111111111111111111111111111" as Address, data };
}

/** Signs a kit transaction in the wallet and waits for confirmation. */
export async function sendTransaction(
  wallet: WalletContextState,
  transaction: Transaction,
): Promise<string> {
  if (!wallet.signTransaction) throw new Error("the wallet cannot sign transactions");
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const wire = new Uint8Array(getTransactionEncoder().encode(transaction));
  const signed = await wallet.signTransaction(VersionedTransaction.deserialize(wire));
  const signature = await connection.sendRawTransaction(signed.serialize());
  // The transaction's own lifetime bounds the wait, a later blockhash would outlive it.
  const { blockhash, lastValidBlockHeight } = isTransactionWithBlockhashLifetime(transaction)
    ? transaction.lifetimeConstraint
    : await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight: Number(lastValidBlockHeight),
  });
  return signature;
}
