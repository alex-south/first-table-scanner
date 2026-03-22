"use client";

import { useRef, useEffect } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
}

export function SearchBar({ value, onChange, resultCount, totalCount }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const editable = (e.target as HTMLElement)?.contentEditable === "true";
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag) && !editable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="relative">
      <div className="relative group">
        {/* Glow effect */}
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[var(--color-accent)]/20 via-transparent to-[var(--color-accent)]/10 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-sm" />

        <div className="relative flex items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] transition-colors group-focus-within:border-[var(--color-accent)]/40">
          {/* Search icon */}
          <span className="pl-4 text-[var(--color-text-dim)] group-focus-within:text-[var(--color-accent)] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Try &quot;romantic Italian Friday&quot; or &quot;casual Thai under $30&quot;..."
            className="flex-1 bg-transparent px-3 py-3.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] outline-none"
          />

          {/* Keyboard hint */}
          {!value && (
            <span className="hidden sm:flex items-center mr-3 px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[10px] text-[var(--color-text-dim)] font-mono">
              /
            </span>
          )}

          {/* Clear button */}
          {value && (
            <button
              onClick={() => onChange("")}
              className="mr-3 p-1 rounded-md text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Result count */}
      {value && (
        <p className="mt-2 text-xs text-[var(--color-text-dim)]">
          {resultCount === 0
            ? "No restaurants match your search"
            : `${resultCount} of ${totalCount} restaurants`}
        </p>
      )}
    </div>
  );
}
