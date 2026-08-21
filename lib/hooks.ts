"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useEffectEvent, useState } from "react";
import type { Address } from "@solana/kit";
import { walletAddress } from "./chain";
import { errorMessage } from "./errors";
import type { Stored } from "./storage";

export function useWalletAddress(): Address | undefined {
  return walletAddress(useWallet());
}

/** Client only. */
export function useStored<T>(store: Stored<T>): [T, (next: T) => void] {
  const [value, setValue] = useState(store.load);
  const update = useCallback(
    (next: T) => {
      setValue(next);
      store.save(next);
    },
    [store],
  );
  return [value, update];
}

export type Loaded<T> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly value: T }
  | { readonly status: "failed"; readonly error: string };

/** `input` must be JSON-serializable, its value keys the reload, undefined stays loading. */
export function useLoaded<I, T>(input: I | undefined, load: (input: I) => Promise<T>): Loaded<T> {
  const key = input === undefined ? undefined : JSON.stringify(input);
  const [result, setResult] = useState<{ key: string; state: Loaded<T> }>();
  // Async, so a loader that throws before its first await still rejects.
  const start = useEffectEvent(async () => {
    if (input === undefined) throw new Error("no input");
    return load(input);
  });
  useEffect(() => {
    if (key === undefined) return;
    let live = true;
    start().then(
      (value) => live && setResult({ key, state: { status: "ready", value } }),
      (e: unknown) => live && setResult({ key, state: { status: "failed", error: errorMessage(e) } }),
    );
    return () => {
      live = false;
    };
  }, [key]);
  return result !== undefined && result.key === key ? result.state : { status: "loading" };
}

/** Bumps on demand and on window focus. */
export function useRefreshToken(): [number, () => void] {
  const [token, setToken] = useState(0);
  const bump = useCallback(() => setToken((n) => n + 1), []);
  useEffect(() => {
    window.addEventListener("focus", bump);
    return () => window.removeEventListener("focus", bump);
  }, [bump]);
  return [token, bump];
}

export interface Action<L extends string> {
  readonly busy: L | undefined;
  readonly error: string | undefined;
  readonly run: (label: L, action: () => Promise<void>) => Promise<void>;
  readonly clearError: () => void;
}

export function useAction<L extends string = string>(): Action<L> {
  const [busy, setBusy] = useState<L>();
  const [error, setError] = useState<string>();
  const run = useCallback(async (label: L, action: () => Promise<void>) => {
    setBusy(label);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(undefined);
    }
  }, []);
  const clearError = useCallback(() => setError(undefined), []);
  return { busy, error, run, clearError };
}
