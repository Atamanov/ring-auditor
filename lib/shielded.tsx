"use client";

import { useWallet, type WalletContextState } from "@solana/wallet-adapter-react";
import { isAddress, type Address } from "@solana/kit";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import {
  LocalWalletAuthority,
  SOL_MINT,
  Wallet,
  createZolanaClient,
  syncWallet,
} from "@heliuslabs/zolana";
import {
  ShieldedAddress,
  ShieldedKeypair,
  SigningKey,
  ed25519DerivationPayload,
  type Bytes32,
} from "@heliuslabs/zolana/keypair";
import {
  buildRingDepositTransaction,
  buildRingLookupTableTransaction,
  buildRingTransferTransaction,
} from "@heliuslabs/zolana/ring";
import { connectedAddress, sendTransaction, walletAddress } from "./chain";
import { INDEXER_URL, PROVER_URL, SOLANA_RPC_URL, TREE, type Ring } from "./config";
import { stored } from "./storage";

type ZolanaClient = Awaited<ReturnType<typeof createZolanaClient>>;

/** The wallet's notes and history as of `slot`, after a full sync. */
export interface Synced {
  readonly wallet: Wallet;
  readonly slot: bigint;
  readonly viewingPublicKey: Uint8Array;
}

/** Derived once per wallet connection, the wallet signs one time. */
export interface Shielded {
  readonly balance: bigint | undefined;
  sync(): Promise<Synced>;
  refresh(ring: Address): Promise<bigint>;
  deposit(ring: Address, lamports: bigint): Promise<string>;
  transfer(ring: Ring, lamports: bigint, recipient: Address): Promise<string>;
  /** A transfer to a key nobody holds. */
  burn(ring: Ring, lamports: bigint): Promise<string>;
}

interface Session {
  readonly wallet: Address;
  readonly authority: LocalWalletAuthority;
  readonly balance?: bigint;
}

/** Ref state, read before React re-renders. */
interface Derived {
  readonly wallet: Address;
  readonly authority: LocalWalletAuthority;
  shielded?: Wallet;
}

const ShieldedContext = createContext<Shielded | undefined>(undefined);

export function useShielded(): Shielded {
  const value = useContext(ShieldedContext);
  if (!value) throw new Error("useShielded outside ShieldedProvider");
  return value;
}

export function ShieldedProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const address = walletAddress(wallet);
  const [session, setSession] = useState<Session>();
  const current = session?.wallet === address ? session : undefined;
  const clientRef = useRef<Promise<ZolanaClient>>(undefined);
  const derivedRef = useRef<Derived>(undefined);

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

  const derived = useCallback(async (): Promise<Derived> => {
    const owner = connectedAddress(wallet);
    if (derivedRef.current?.wallet === owner) return derivedRef.current;
    const { signMessage } = wallet;
    if (!signMessage) throw new Error("the wallet cannot sign messages");
    // Poseidon must be loaded before derivation.
    await client();
    const authority = LocalWalletAuthority.fromDerivationSeed({
      solanaPublicKey: owner,
      derivationSeed: await signMessage(ed25519DerivationPayload()),
    });
    derivedRef.current = { wallet: owner, authority };
    setSession({ wallet: owner, authority });
    return derivedRef.current;
  }, [client, wallet]);

  const shieldedWallet = useCallback(async () => {
    const d = await derived();
    d.shielded ??= new Wallet({ identity: await d.authority.shieldedAddress() });
    return { authority: d.authority, shielded: d.shielded, owner: d.wallet };
  }, [derived]);

  const sync = useCallback(async (): Promise<Synced> => {
    const { authority, shielded } = await shieldedWallet();
    const c = await client();
    const slot = BigInt(await c.solanaRpc.getSlot().send());
    await syncWallet({ client: c, wallet: shielded, authority, config: { requireSlot: slot } });
    return { wallet: shielded, slot, viewingPublicKey: shielded.identity.viewingPublicKey.toBytes() };
  }, [client, shieldedWallet]);

  const refresh = useCallback(
    async (ring: Address) => {
      const { wallet: shielded } = await sync();
      const total = shielded
        .utxos()
        .filter((e) => !e.spent && e.utxo.asset === SOL_MINT && e.utxo.zoneProgramId === ring)
        .reduce((sum, e) => sum + e.utxo.amount, 0n);
      setSession((prev) => (prev && prev.wallet === address ? { ...prev, balance: total } : prev));
      return total;
    },
    [address, sync],
  );

  const deposit = useCallback(
    async (ring: Address, lamports: bigint) => {
      const { authority, owner } = await shieldedWallet();
      const signature = await sendTransaction(
        wallet,
        await buildRingDepositTransaction({
          client: await client(),
          ringProgramId: ring,
          feePayer: owner,
          recipient: await authority.shieldedAddress(),
          amount: lamports,
        }),
      );
      await refresh(ring);
      return signature;
    },
    [client, refresh, shieldedWallet, wallet],
  );

  const transferTo = useCallback(
    async (ring: Ring, lamports: bigint, recipient: Address | ShieldedAddress) => {
      const { authority, shielded, owner } = await shieldedWallet();
      const c = await client();
      await refresh(ring.id);
      const signature = await sendTransaction(
        wallet,
        await buildRingTransferTransaction({
          client: c,
          ringProgramId: ring.id,
          wallet: shielded,
          authority,
          feePayer: owner,
          recipient,
          amount: lamports,
          lookupTable: await lookupTable(c, ring, wallet),
        }),
      );
      await refresh(ring.id);
      return signature;
    },
    [client, refresh, shieldedWallet, wallet],
  );

  const transfer = useCallback(
    (ring: Ring, lamports: bigint, recipient: Address) => transferTo(ring, lamports, recipient),
    [transferTo],
  );
  const burn = useCallback(
    (ring: Ring, lamports: bigint) => transferTo(ring, lamports, freshRecipient()),
    [transferTo],
  );

  const value = useMemo<Shielded>(
    () => ({ balance: current?.balance, sync, refresh, deposit, transfer, burn }),
    [current?.balance, sync, refresh, deposit, transfer, burn],
  );
  return <ShieldedContext.Provider value={value}>{children}</ShieldedContext.Provider>;
}

function freshRecipient(): ShieldedAddress {
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  return ShieldedKeypair.fromKeypair(SigningKey.fromEd25519Bytes(seed as Bytes32)).shieldedAddress();
}

const createdTable = (ring: Address) =>
  stored<Address | undefined>(`ring-auditor.lookup-table.${ring}`, (raw) =>
    typeof raw === "string" && isAddress(raw) ? raw : undefined,
  );

async function lookupTable(
  client: ZolanaClient,
  ring: Ring,
  wallet: WalletContextState,
): Promise<Address> {
  if (ring.lookupTable) return ring.lookupTable;
  const created = createdTable(ring.id);
  const existing = created.load();
  if (existing) return existing;
  const table = await buildRingLookupTableTransaction({
    client,
    ringProgramId: ring.id,
    feePayer: connectedAddress(wallet),
  });
  await sendTransaction(wallet, table.transaction);
  // A lookup table serves transactions only from the slot after its writes.
  const writtenAt = await client.solanaRpc.getSlot().send();
  while ((await client.solanaRpc.getSlot().send()) <= writtenAt) {
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  created.save(table.address);
  return table.address;
}
