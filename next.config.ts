import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack root must cover the linked SDK checkout.
  turbopack: {
    root: path.join(__dirname, ".."),
    // The hasher's browser build inlines its WASM but keeps a `new URL(..)`
    // fallback that the bundler resolves against the wrong directory.
    resolveAlias: Object.fromEntries(
      ["hasher_wasm_simd_bg.wasm", "light_wasm_hasher_bg.wasm"].map((file) => [
        file,
        `../zolana-ts/node_modules/@lightprotocol/hasher.rs/dist/${file}`,
      ]),
    ),
  },
};

export default nextConfig;
