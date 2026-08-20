"use client";

import { useWallet, type WalletContextState } from "@solana/wallet-adapter-react";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { getTransactionEncoder, type Address, type Transaction } from "@solana/kit";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import {
  LocalWalletAuthority,
  SOL_MINT,
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
  viewingKeyReader,
  type RingReadSigner,
} from "@heliuslabs/zolana/ring";
import { INDEXER_URL, PROVER_URL, RING_LOOKUP_TABLE, RING_RPC_URL, SOLANA_RPC_URL, TREE } from "./config";

type ZolanaClient = Awaited<ReturnType<typeof createZolanaClient>>;

// The wallet's shielded side, derived once per connection from its signature
// over the derivation payload and kept in memory: the nullifier and viewing
// keys that own its notes. Every action below reuses it, so the wallet is
// asked for the derivation signature one time.
export interface Shielded {
  readonly authority?: LocalWalletAuthority;
  readonly balance?: bigint;
  /** Derives the keys when needed, then returns them. One wallet prompt, once. */
  derive(): Promise<LocalWalletAuthority>;
  viewingKeySigner(): Promise<RingReadSigner>;
  refresh(ring: Address): Promise<bigint>;
  deposit(ring: Address, lamports: bigint): Promise<string>;
  transfer(ring: Address, lamports: bigint): Promise<string>;
}

const ShieldedContext = createContext<Shielded | undefined>(undefined);

export function useShielded(): Shielded {
  const value = useContext(ShieldedContext);
  if (!value) throw new Error("useShielded outside ShieldedProvider");
  return value;
}

export function ShieldedProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const walletAddress = wallet.publicKey?.toBase58() as Address | undefined;
  // Keyed by wallet, so a switch of wallet drops the previous keys and notes.
  const [session, setSession] = useState<{
    wallet?: Address;
    authority?: LocalWalletAuthority;
    balance?: bigint;
  }>({});
  const authority = session.wallet === walletAddress ? session.authority : undefined;
  const balance = session.wallet === walletAddress ? session.balance : undefined;
  const setAuthority = useCallback(
    (next: LocalWalletAuthority) => setSession({ wallet: walletAddress, authority: next }),
    [walletAddress],
  );
  const setBalance = useCallback(
    (next: bigint) =>
      setSession((prev) => (prev.wallet === walletAddress ? { ...prev, balance: next } : prev)),
    [walletAddress],
  );
  const clientRef = useRef<Promise<ZolanaClient>>(undefined);
  const shieldedRef = useRef<{ wallet?: Address; state?: Wallet }>({});

  const client = useCallback(() => {
    clientRef.current ??= createZolanaClient({
      solanaRpcUrl: SOLANA_RPC_URL,
      indexerUrl: INDEXER_URL,
      proverUrl: PROVER_URL,
      tree: TREE,
      allowInsecureHttp: true,
    });
    return clientRef.current;
  }, []);

  const derive = useCallback(async () => {
    if (authority) return authority;
    const { signMessage } = wallet;
    if (!walletAddress || !signMessage) throw new Error("connect a wallet first");
    // The client loads Poseidon, which the derived nullifier key hashes with.
    await client();
    const derived = LocalWalletAuthority.fromDerivationSeed({
      solanaPublicKey: walletAddress,
      derivationSeed: await signMessage(ed25519DerivationPayload()),
    });
    setAuthority(derived);
    return derived;
  }, [authority, client, setAuthority, wallet, walletAddress]);

  const shieldedWallet = useCallback(
    async (auth: LocalWalletAuthority) => {
      if (shieldedRef.current.wallet !== walletAddress || !shieldedRef.current.state) {
        shieldedRef.current = {
          wallet: walletAddress,
          state: new Wallet({ identity: await auth.shieldedAddress() }),
        };
      }
      return shieldedRef.current.state!;
    },
    [walletAddress],
  );

  const refresh = useCallback(
    async (ring: Address) => {
      const auth = await derive();
      const c = await client();
      const shielded = await shieldedWallet(auth);
      await syncWallet({
        client: c,
        wallet: shielded,
        authority: auth,
        config: { requireSlot: BigInt(await c.solanaRpc.getSlot().send()) },
      });
      const total = shielded
        .utxos()
        .filter((e) => !e.spent && e.utxo.asset === SOL_MINT && e.utxo.zoneProgramId === ring)
        .reduce((sum, e) => sum + e.utxo.amount, 0n);
      setBalance(total);
      return total;
    },
    [client, derive, setBalance, shieldedWallet],
  );

  const deposit = useCallback(
    async (ring: Address, lamports: bigint) => {
      const auth = await derive();
      const c = await client();
      const signature = await send(
        wallet,
        await buildRingDepositTransaction({
          client: c,
          ringProgramId: ring,
          feePayer: walletAddress!,
          recipient: await auth.shieldedAddress(),
          amount: lamports,
        }),
      );
      await refresh(ring);
      return signature;
    },
    [client, derive, refresh, wallet, walletAddress],
  );

  const transfer = useCallback(
    async (ring: Address, lamports: bigint) => {
      const auth = await derive();
      const c = await client();
      const shielded = await shieldedWallet(auth);
      await refresh(ring);
      const seed = new Uint8Array(32);
      crypto.getRandomValues(seed);
      const recipient = ShieldedKeypair.fromKeypair(SigningKey.fromEd25519Bytes(seed as Bytes32));
      const signature = await send(
        wallet,
        await buildRingTransferTransaction({
          client: c,
          ringRpc: new RingRpc(RING_RPC_URL),
          ringProgramId: ring,
          wallet: shielded,
          authority: auth,
          feePayer: walletAddress!,
          recipient: recipient.shieldedAddress(),
          amount: lamports,
          lookupTable: await lookupTable(c, ring, wallet),
        }),
      );
      await refresh(ring);
      return signature;
    },
    [client, derive, refresh, shieldedWallet, wallet, walletAddress],
  );

  const viewingKeySigner = useCallback(async () => {
    const [viewingKey] = await (await derive()).viewingKeys();
    return viewingKeyReader(viewingKey!);
  }, [derive]);

  const value = useMemo<Shielded>(
    () => ({ authority, balance, derive, viewingKeySigner, refresh, deposit, transfer }),
    [authority, balance, derive, viewingKeySigner, refresh, deposit, transfer],
  );
  return <ShieldedContext.Provider value={value}>{children}</ShieldedContext.Provider>;
}

// Signs a kit transaction in the wallet and waits for confirmation.
async function send(wallet: WalletContextState, transaction: Transaction): Promise<string> {
  if (!wallet.signTransaction) throw new Error("the wallet cannot sign transactions");
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const wire = new Uint8Array(getTransactionEncoder().encode(transaction));
  const signed = await wallet.signTransaction(VersionedTransaction.deserialize(wire));
  const signature = await connection.sendRawTransaction(signed.serialize());
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
  return signature;
}

// The ring's lookup table is the operator's, published in the env. A page
// without one creates a table with the wallet and remembers it for this ring.
async function lookupTable(
  client: ZolanaClient,
  ring: Address,
  wallet: WalletContextState,
): Promise<Address> {
  if (RING_LOOKUP_TABLE) return RING_LOOKUP_TABLE;
  const key = `ring-auditor.lookup-table.${ring}`;
  const known = localStorage.getItem(key);
  if (known) return known as Address;
  const table = await buildRingLookupTableTransaction({
    client,
    ringProgramId: ring,
    feePayer: wallet.publicKey!.toBase58() as Address,
  });
  await send(wallet, table.transaction);
  // A lookup table serves transactions only from the slot after its writes.
  const writtenAt = await client.solanaRpc.getSlot().send();
  while ((await client.solanaRpc.getSlot().send()) <= writtenAt) {
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  localStorage.setItem(key, table.address);
  return table.address;
}
