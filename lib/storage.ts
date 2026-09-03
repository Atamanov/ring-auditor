export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/** `parse` must reject untrusted stored JSON. */
export interface Stored<T> {
  readonly load: () => T;
  readonly save: (value: T) => void;
  readonly clear: () => void;
}

export function stored<T>(key: string, parse: (raw: unknown) => T): Stored<T> {
  return {
    load: () => {
      try {
        return parse(JSON.parse(localStorage.getItem(key) ?? "null"));
      } catch {
        return parse(null);
      }
    },
    save: (value) => localStorage.setItem(key, JSON.stringify(value)),
    clear: () => localStorage.removeItem(key),
  };
}
