'use client';

import { useEffect, useRef, useState } from 'react';
import type { Customer } from '@/lib/types';

const storageKey = (customer: Customer) => `agenda-${customer}`;

/**
 * Load the agenda for a customer. New format is a JSON string[] of bullets.
 * Legacy format was freeform text — migrate by splitting on newlines and
 * stripping any leading bullet markers. Always returns at least one (possibly
 * empty) item so there's a row to type into.
 */
function readAgenda(customer: Customer): string[] {
  if (typeof window === 'undefined') return [''];
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey(customer));
  } catch {
    return [''];
  }
  if (!raw) return [''];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed.length > 0 ? (parsed as string[]) : [''];
    }
  } catch {
    // Not JSON — fall through to legacy migration.
  }

  const lines = raw
    .split('\n')
    .map((l) => l.replace(/^\s*[•\-*]\s?/, '').trim())
    .filter((l) => l.length > 0);
  return lines.length > 0 ? lines : [''];
}

/**
 * Today's agenda as reorderable bullets. Persisted to localStorage per
 * customer (key: `agenda-{customer}`). Not synced to Notion — meeting scratch.
 *
 * The parent re-mounts this component when the customer changes
 * (via `key={customer}`), so initial state seeds straight from localStorage.
 */
export function Agenda({ customer }: { customer: Customer }) {
  const [items, setItems] = useState<string[]>(() => readAgenda(customer));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // Index to focus after the next render (e.g. a newly inserted bullet). A ref
  // rather than state: clearing it must not trigger another render.
  const pendingFocus = useRef<number | null>(null);

  // Persist on every change. Small payload, no debounce needed.
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(customer), JSON.stringify(items));
    } catch {
      // ignore quota / private mode errors
    }
  }, [items, customer]);

  useEffect(() => {
    if (pendingFocus.current !== null) {
      inputRefs.current[pendingFocus.current]?.focus();
      pendingFocus.current = null;
    }
  }, [items]);

  const update = (i: number, value: string) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? value : it)));
  };

  const insertAfter = (i: number) => {
    setItems((prev) => [...prev.slice(0, i + 1), '', ...prev.slice(i + 1)]);
    pendingFocus.current = i + 1;
  };

  const removeAt = (i: number) => {
    setItems((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length > 0 ? next : [''];
    });
    pendingFocus.current = Math.max(0, i - 1);
  };

  const addItem = () => {
    setItems((prev) => [...prev, '']);
    pendingFocus.current = items.length;
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  return (
    <section className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-5 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] mb-2">
        Today&apos;s Agenda
      </div>

      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li
            key={i}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              setDragOverIndex(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) reorder(dragIndex, i);
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            className={`group flex items-center gap-1.5 rounded px-1 -mx-1 ${
              dragOverIndex === i && dragIndex !== i
                ? 'bg-[var(--surface-2)]'
                : ''
            }`}
          >
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                setDragIndex(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setDragOverIndex(null);
              }}
              aria-label="Drag to reorder"
              title="Drag to reorder"
              className="shrink-0 cursor-grab active:cursor-grabbing text-[var(--text-subtle)] hover:text-[var(--text-muted)] select-none text-xs leading-none px-0.5"
            >
              ⠿
            </button>
            <span
              className="shrink-0 w-1 h-1 rounded-full bg-[var(--text-subtle)]"
              aria-hidden
            />
            <input
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              value={item}
              onChange={(e) => update(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  insertAfter(i);
                } else if (
                  e.key === 'Backspace' &&
                  item === '' &&
                  items.length > 1
                ) {
                  e.preventDefault();
                  removeAt(i);
                }
              }}
              placeholder={i === 0 ? 'Add an agenda item…' : ''}
              className="flex-1 min-w-0 bg-transparent text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none text-sm leading-relaxed py-0.5"
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label="Remove item"
              title="Remove item"
              className="shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 text-[var(--text-subtle)] hover:text-[var(--blocked-fg)] text-xs px-1 transition-opacity"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addItem}
        className="mt-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
      >
        + Add item
      </button>
    </section>
  );
}
