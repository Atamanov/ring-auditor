"use client";

import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

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

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-xl flex-col gap-3 rounded-lg border border-line bg-surface p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{title}</h2>
          <button onClick={onClose} className="text-xs text-muted hover:text-text">
            close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A long identifier shown truncated in the middle; a click copies the whole value. */
export function Key({ value, head = 6, tail = 6 }: { value: string; head?: number; tail?: number }) {
  const [copied, setCopied] = useState(false);
  // `head` and `tail` of 0 render a plain copy control.
  const short =
    head + tail === 0
      ? "copy"
      : value.length > head + tail + 1
        ? `${value.slice(0, head)}…${value.slice(-tail)}`
        : value;
  return (
    <button
      type="button"
      title={copied ? "copied" : `${value}\nclick to copy`}
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className={`font-mono text-xs ${copied ? "text-emerald-400" : head + tail === 0 ? "text-muted hover:text-text" : "hover:text-accent"}`}
    >
      {copied ? "copied" : short}
    </button>
  );
}
