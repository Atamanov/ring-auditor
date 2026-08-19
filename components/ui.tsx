import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label,
  ...input
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted uppercase tracking-wide text-xs">{label}</span>
      <input
        {...input}
        className="rounded border border-line bg-bg px-3 py-2 font-mono text-sm text-text outline-none focus:border-accent"
      />
    </label>
  );
}

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 disabled:hover:bg-accent"
    />
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="break-all font-mono text-xs">{children}</span>;
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-accent-ground px-2 py-0.5 text-xs text-muted">
      {children}
    </span>
  );
}

export function Card({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {title && <h2 className="text-sm font-medium">{title}</h2>}
      {children}
    </section>
  );
}
