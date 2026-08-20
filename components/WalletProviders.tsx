"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import type { Adapter, WalletError } from "@solana/wallet-adapter-base";
import type { Wallet as StandardWallet, WalletAccount } from "@wallet-standard/base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import dynamic from "next/dynamic";
import { useCallback, useState, type ReactNode } from "react";
import { SOLANA_RPC_URL } from "@/lib/config";
import "@solana/wallet-adapter-react-ui/styles.css";

// Wallet Standard wallets register themselves. Adapter errors are shown on the
// page instead of only in the console, so a wallet that refuses to connect says
// why.
export function WalletProviders({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string>();
  const onError = useCallback((e: WalletError, adapter?: Adapter) => {
    if (e.name === "WalletAccountError" && adapter) {
      void describeAccounts(adapter).then(setError);
      return;
    }
    setError(`${e.name}: ${e.message || String(e.error ?? "")}`);
    console.error(e);
  }, []);
  return (
    <ConnectionProvider endpoint={SOLANA_RPC_URL}>
      <WalletProvider wallets={[]} autoConnect onError={onError}>
        <WalletModalProvider>
          {error && (
            <div className="border-b border-line bg-surface px-6 py-2 text-xs text-accent-hover">
              wallet: {error}{" "}
              <button onClick={() => setError(undefined)} className="text-muted hover:text-text">
                dismiss
              </button>
            </div>
          )}
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// The Wallet Standard adapter reads `wallet.accounts` right after `connect()`
// and throws WalletAccountError when the list is empty. What the wallet
// actually returned from `connect()` tells whether the list is late or the
// wallet has no Solana account for this page.
async function describeAccounts(adapter: Adapter): Promise<string> {
  const standard = (adapter as unknown as { wallet?: StandardWallet }).wallet;
  if (!standard) return "WalletAccountError";
  const connect = standard.features["standard:connect"] as
    | { connect(input?: { silent?: boolean }): Promise<{ accounts: readonly WalletAccount[] }> }
    | undefined;
  let returned: readonly WalletAccount[] = [];
  try {
    returned = (await connect?.connect({ silent: true }))?.accounts ?? [];
  } catch (e) {
    return `${adapter.name}: connect failed, ${(e as Error).message}`;
  }
  const show = (accounts: readonly WalletAccount[]) =>
    accounts.map((a) => `${a.address.slice(0, 4)}… [${a.chains.join(", ")}]`).join("; ") || "none";
  return `${adapter.name} returned ${show(returned)} from connect, lists ${show(standard.accounts)} as accounts, wallet chains [${standard.chains.join(", ")}]`;
}
// Rendered on the client only. The server does not know which wallet is
// connected, so a server render would not match.
export const WalletButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false },
);
