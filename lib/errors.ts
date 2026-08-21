import { WalletError } from "@solana/wallet-adapter-base";
import { RingError } from "@heliuslabs/zolana/ring";

const REJECTED = /rejected|cancel|denied|declined/i;

/** A wallet or passkey prompt the user dismissed, anywhere in the cause chain. */
export function isUserRejection(e: unknown): boolean {
  for (let cause = e, depth = 0; cause !== undefined && depth < 8; depth++) {
    if (cause instanceof WalletError && REJECTED.test(cause.message)) return true;
    if ((cause as { code?: unknown }).code === 4001) return true;
    if (cause instanceof DOMException && (cause.name === "NotAllowedError" || cause.name === "AbortError")) {
      return true;
    }
    cause = (cause as { cause?: unknown }).cause ?? (cause as { error?: unknown }).error;
  }
  return false;
}

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
