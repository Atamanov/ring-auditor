import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The SDK is a file: dependency one directory up, so the module graph root
  // must cover both checkouts.
  turbopack: {
    root: path.join(__dirname, ".."),
    resolveAlias: {
      "@lightprotocol/hasher.rs": "./lib/hasher-stub.ts",
    },
  },
};

export default nextConfig;
