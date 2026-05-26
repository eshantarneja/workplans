'use client';

import { useEffect, useRef, useState } from 'react';
import type { Customer } from '@/lib/types';

function readAgenda(customer: Customer): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(`agenda-${customer}`) ?? '';
  } catch {
    return '';
  }
}

/**
 * Today's agenda. Auto-resizes. Persisted to localStorage per customer
 * (key: `agenda-{customer}`). Not synced to Notion — meeting scratch.
 *
 * The parent re-mounts this component when the customer changes
 * (via `key={customer}`), so we don't need an effect to re-sync.
 */
export function AgendaTextarea({ customer }: { customer: Customer }) {
  const [value, setValue] = useState(() => readAgenda(customer));
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize on value change.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // Persist on change (small payload, no debounce needed).
  useEffect(() => {
    try {
      window.localStorage.setItem(`agenda-${customer}`, value);
    } catch {
      // ignore quota / private mode errors
    }
  }, [value, customer]);

  return (
    <section className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-5 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] mb-2">
        Today&apos;s Agenda
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={"What do you want to cover today? e.g.\n• ERP — confirm escalation path on sandbox creds"}
        rows={2}
        className="w-full resize-none bg-transparent text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none text-sm leading-relaxed"
      />
    </section>
  );
}
