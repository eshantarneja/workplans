'use client';

import { CUSTOMERS } from '@/lib/constants';
import type { Customer } from '@/lib/types';

interface Props {
  value: Customer;
  onChange: (next: Customer) => void;
}

export function CustomerPicker({ value, onChange }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
      Weekly workplan:
      <span className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as Customer)}
          className="appearance-none bg-[var(--surface)] border border-[var(--border)] rounded-md pl-3 pr-8 py-1.5 text-sm text-[var(--text)] font-medium cursor-pointer hover:border-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1 focus:border-[var(--accent)]"
        >
          {CUSTOMERS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <svg
          className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-subtle)] pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </label>
  );
}
