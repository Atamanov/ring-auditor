"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import type { Adapter, WalletError } from "@solana/wallet-adapter-base";
import { StandardWalletAdapter } from "@solana/wallet-standard-wallet-adapter-base";
import type { WalletAccount } from "@wallet-standard/base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import dynamic from "next/dynamic";
import { useCallback, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { SOLANA_RPC_URL } from "@/lib/config";
import { isUserRejection } from "@/lib/errors";
import { shortKey } from "@/lib/format";
import "@solana/wallet-adapter-react-ui/styles.css";

/** `wallets` stays empty, Wallet Standard wallets register themselves. */
export function WalletProviders({ children }: { children: ReactNode }) {
  const onError = useCallback((e: WalletError, adapter?: Adapter) => {
    if (isUserRejection(e)) return;
    if (e.name === "WalletAccountError" && adapter instanceof StandardWalletAdapter) {
      void describeAccounts(adapter).then((text) => toast.error(text));
      return;
    }
    toast.error(`${e.name} ${e.message || String(e.error ?? "")}`);
    console.error(e);
  }, []);
  return (
    <ConnectionProvider endpoint={SOLANA_RPC_URL}>
      <WalletProvider wallets={[]} autoConnect onError={onError}>
        <WalletModalProvider>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            closeButton
            toastOptions={{
              style: {
                background: "var(--surface)",
                borderColor: "var(--line)",
                color: "var(--text)",
                fontFamily: "var(--font-sans)",
              },
            }}
          />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

/** A second silent connect tells an empty account list from a late one. */
async function describeAccounts(adapter: StandardWalletAdapter): Promise<string> {
  const standard = adapter.wallet;
  let returned: readonly WalletAccount[];
  try {
    returned = (await standard.features["standard:connect"].connect({ silent: true })).accounts;
  } catch (e) {
    return `${adapter.name} connect failed, ${e instanceof Error ? e.message : String(e)}`;
  }
  const show = (accounts: readonly WalletAccount[]) =>
    accounts.map((a) => `${shortKey(a.address, 4, 0)} [${a.chains.join(", ")}]`).join("; ") || "none";
  return `${adapter.name} returned ${show(returned)} from connect, lists ${show(standard.accounts)} as accounts, wallet chains [${standard.chains.join(", ")}]`;
}

export const WalletButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false },
);
