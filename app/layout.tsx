import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Image from "next/image";
import { WalletButton, WalletProviders } from "@/components/WalletProviders";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  weight: ["400", "500"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ring Auditor",
  description: "Reads a custom ring through the Ring RPC as its authority or as a participant.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <WalletProviders>
          <header className="flex items-center justify-between border-b border-line px-6 py-4">
            <div className="flex items-center gap-4">
              <Image src="/helius.svg" alt="Helius" width={114} height={24} priority />
              <span className="text-sm text-muted">Ring Auditor</span>
            </div>
            <WalletButton />
          </header>
          <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">{children}</main>
        </WalletProviders>
      </body>
    </html>
  );
}
