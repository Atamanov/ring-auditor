import { RingError } from "@heliuslabs/zolana/ring";

export function errorMessage(e: unknown): string {
  if (e instanceof RingError) {
    const detail = e.details?.message;
    if (typeof detail === "string") return detail;
  }
  return e instanceof Error ? e.message : String(e);
}

export function ringRpcErrorMessage(e: unknown, rpcUrl: string): string {
  if (e instanceof RingError && e.code === "RING_RPC_TRANSPORT") {
    return `no ring RPC at ${rpcUrl}, start it with --allow-origin ${location.origin}`;
  }
  return errorMessage(e);
}
