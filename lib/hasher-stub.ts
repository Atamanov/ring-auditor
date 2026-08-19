// The page only reads the ring RPC and signs attestations; nothing hashes.
// Stubbing the hasher keeps its WASM out of the browser bundle.
export const WasmFactory = {
  loadHasher(): Promise<never> {
    return Promise.reject(new Error("poseidon is not bundled in this app"));
  },
  getInstance(): Promise<never> {
    return Promise.reject(new Error("poseidon is not bundled in this app"));
  },
};
