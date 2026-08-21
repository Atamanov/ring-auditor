import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { NextConfig } from "next";

const sdk = realpathSync(path.join(__dirname, "node_modules/@heliuslabs/zolana"));
const hasherEntry = createRequire(path.join(sdk, "package.json")).resolve("@lightprotocol/hasher.rs");
const hasher = hasherEntry.slice(0, hasherEntry.indexOf(`${path.sep}dist${path.sep}`));

const nextConfig: NextConfig = {
  turbopack: {
    // The hasher's browser build inlines its WASM but keeps a `new URL(..)`
    // fallback the bundler resolves against the wrong directory.
    resolveAlias: Object.fromEntries(
      ["hasher_wasm_simd_bg.wasm", "light_wasm_hasher_bg.wasm"].map((file) => [
        file,
        `./${path.relative(__dirname, path.join(hasher, "dist", file))}`,
      ]),
    ),
  },
};

export default nextConfig;
