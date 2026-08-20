import type { WalletContextState } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import type { Instruction } from "@solana/kit";

// Sends one SDK instruction signed by the connected wallet. The SDK builds kit
// instructions, the wallet adapter speaks web3.js, so the metas are mapped:
// kit roles are bit 0 writable, bit 1 signer.
export async function sendWithWallet(
  wallet: WalletContextState,
  solanaRpcUrl: string,
  instruction: Instruction,
): Promise<string> {
  if (!wallet.publicKey) throw new Error("connect a wallet first");
  const connection = new Connection(solanaRpcUrl, "confirmed");
  const transaction = new Transaction().add(
    new TransactionInstruction({
      programId: new PublicKey(instruction.programAddress),
      keys: (instruction.accounts ?? []).map((meta) => ({
        pubkey: new PublicKey(meta.address),
        isSigner: (meta.role & 2) !== 0,
        isWritable: (meta.role & 1) !== 0,
      })),
      data: Buffer.from(instruction.data ?? []),
    }),
  );
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;
  const signature = await wallet.sendTransaction(transaction, connection);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
  return signature;
}
