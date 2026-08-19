"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";

// The app only signs messages. The adapter still needs an endpoint, any
// cluster does, and Wallet Standard wallets register themselves.
export function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={clusterApiUrl("devnet")}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
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
