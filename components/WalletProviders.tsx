"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import type { WalletError } from "@solana/wallet-adapter-base";
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
  const onError = useCallback((e: WalletError) => {
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

// Rendered on the client only. The server does not know which wallet is
// connected, so a server render would not match.
export const WalletButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false },
);
