"use client";

import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { shortKey } from "@/lib/format";

const CONTROL = "rounded border border-line bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent";

export function Caption({ children }: { children: ReactNode }) {
  return <span className="text-muted uppercase tracking-wide text-xs">{children}</span>;
}

export function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <Caption>{text}</Caption>
      {children}
    </label>
  );
}

export function Field({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Label text={label}>
      <input {...input} className={`${CONTROL} font-mono`} />
    </Label>
  );
}

export function Select({ label, ...select }: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Label text={label}>
      <select {...select} className={CONTROL} />
    </Label>
  );
}

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 disabled:hover:bg-accent"
    />
  );
}

export function IconButton({
  title,
  framed = false,
  ...props
}: { title: string; framed?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      {...props}
      className={`text-muted hover:text-text disabled:opacity-40 ${framed ? "rounded border border-line px-3 py-2 text-sm" : "text-xs"}`}
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

export function Success({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
      {children}
    </span>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted">{children}</p>;
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
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto w-full max-w-xl rounded-lg border border-line bg-surface p-0 text-text backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{title}</h2>
          <IconButton title="close" onClick={onClose}>
            close
          </IconButton>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function useCopied(): [boolean, (value: string) => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = (value: string) => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
  };
  return [copied, copy];
}

/** Middle-truncated, a click copies the full value. */
export function Key({ value, head = 6, tail = 6 }: { value: string; head?: number; tail?: number }) {
  const [copied, copy] = useCopied();
  const plain = head + tail === 0;
  const short = plain ? "copy" : shortKey(value, head, tail);
  return (
    <button
      type="button"
      title={copied ? "copied" : `${value}\nclick to copy`}
      onClick={() => copy(value)}
      className={`font-mono text-xs ${copied ? "text-emerald-400" : plain ? "text-muted hover:text-text" : "hover:text-accent"}`}
    >
      {copied ? "copied" : short}
    </button>
  );
}

export function Copyable({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Caption>{label}</Caption>
      <div className="flex items-center gap-2 rounded border border-line bg-bg px-3 py-2">
        <Mono>{value}</Mono>
        <Key value={value} head={0} tail={0} />
      </div>
    </div>
  );
}
