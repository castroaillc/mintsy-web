"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "./ui";

const INPUT =
  "box-border h-12 w-full rounded-xl border border-line-2 bg-raised px-3.5 text-[15px] text-ink outline-none focus-visible:outline-2 focus-visible:outline-coral read-only:text-ink-4 aria-invalid:border-danger";

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  labelAside?: ReactNode;
};

/** Labelled input from the boards (48px, #1B1929, 12px radius, coral focus). */
export function TextField({ label, hint, error, labelAside, className, ...input }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[14px] font-semibold text-ink-2">
          {label}
        </label>
        {labelAside}
      </div>
      <input id={id} className={INPUT} aria-invalid={error ? true : undefined} aria-describedby={hint || error ? hintId : undefined} {...input} />
      {error ? (
        <div id={hintId} className="text-[13px] text-error-icon">
          {error}
        </div>
      ) : hint ? (
        <div id={hintId} className="text-[13px] text-ink-5">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/** Password input with the boards' Show / Hide toggle. `shown` can be shared between fields. */
export function PasswordField({
  label,
  hint,
  error,
  labelAside,
  shown: shownProp,
  onToggle,
  className,
  ...input
}: FieldProps & { shown?: boolean; onToggle?: () => void }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [own, setOwn] = useState(false);
  const shown = shownProp ?? own;
  const toggle = onToggle ?? (() => setOwn((s) => !s));
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[14px] font-semibold text-ink-2">
          {label}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        <input
          id={id}
          type={shown ? "text" : "password"}
          className={cx(INPUT, "pr-[76px]")}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? hintId : undefined}
          {...input}
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={shown}
          className="absolute right-1.5 top-1.5 h-9 rounded-lg border-0 bg-transparent px-2.5 text-[13px] font-semibold text-ink-4 hover:text-ink"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {error ? (
        <div id={hintId} className="text-[13px] text-error-icon">
          {error}
        </div>
      ) : hint ? (
        <div id={hintId} className="text-[13px] text-ink-5">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
