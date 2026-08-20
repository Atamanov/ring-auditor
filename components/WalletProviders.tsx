"use client";

import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import type { Adapter, WalletError, WalletName } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { SOLANA_RPC_URL } from "@/lib/config";
import "@solana/wallet-adapter-react-ui/styles.css";

// Wallet Standard wallets register themselves. Adapter errors are shown on the
// page instead of only in the console, so a wallet that refuses to connect says
// why.
export function WalletProviders({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState<{ name: WalletName; attempt: number }>();
  const onError = useCallback((e: WalletError, adapter?: Adapter) => {
    // The Wallet Standard adapter reads the wallet's account list right after
    // `connect()`. MetaMask fills that list a moment later, so the adapter sees
    // nothing, throws, and wallet-adapter-react drops the selection. Selecting
    // the wallet again a moment later finds the accounts in place.
    if (e.name === "WalletAccountError" && adapter) {
      setRetry((prev) => ({ name: adapter.name, attempt: (prev?.attempt ?? 0) + 1 }));
      return;
    }
    setError(`${e.name}: ${e.message || String(e.error ?? "")}`);
    console.error(e);
  }, []);
  return (
    <ConnectionProvider endpoint={SOLANA_RPC_URL}>
      <WalletProvider wallets={[]} autoConnect onError={onError}>
        <WalletModalProvider>
          <ConnectRetry retry={retry} onGiveUp={setError} />
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

const RETRIES = 4;

function ConnectRetry({
  retry,
  onGiveUp,
}: {
  retry?: { name: WalletName; attempt: number };
  onGiveUp: (message: string) => void;
}) {
  const { select, connected } = useWallet();
  useEffect(() => {
    if (!retry || connected) return;
    if (retry.attempt > RETRIES) {
      onGiveUp(
        `${retry.name} reported no Solana account. Check that the wallet has a Solana account and this network enabled.`,
      );
      return;
    }
    const timer = setTimeout(() => select(retry.name), 600);
    return () => clearTimeout(timer);
  }, [retry, connected, select, onGiveUp]);
  return null;
}

// Rendered on the client only. The server does not know which wallet is
// connected, so a server render would not match.
export const WalletButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false },
);
