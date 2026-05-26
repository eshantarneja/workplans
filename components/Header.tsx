'use client';

import { useEffect, useState } from 'react';

interface Props {
  /** ms since epoch of latest data fetch; null if no fetch has completed yet. */
  dataUpdatedAt: number | null;
  /** Whether a fetch is currently in flight. */
  isFetching: boolean;
  onReload: () => void;
}

function formatRelative(ms: number, now: number): string {
  const sec = Math.max(0, Math.round((now - ms) / 1000));
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.round(min / 60);
  return `${hr} hour${hr === 1 ? '' : 's'} ago`;
}

export function Header({ dataUpdatedAt, isFetching, onReload }: Props) {
  // Tick once per second so the "Xs ago" indicator climbs.
  // Lazy initializer keeps the render itself pure.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-center justify-between gap-4">
      <h1 className="text-base font-semibold text-[var(--text)]">Customer Workplan Live</h1>
      <div className="flex items-center gap-4">
        {dataUpdatedAt !== null && (
          <span className="text-xs text-[var(--text-muted)]">
            Data updated {formatRelative(dataUpdatedAt, now)}
          </span>
        )}
        <button
          onClick={onReload}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-sm text-[var(--text)] hover:text-[var(--accent)] disabled:opacity-50 disabled:cursor-wait"
          aria-label="Reload data"
        >
          <svg
            className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v6h6M20 20v-6h-6M20 10a8 8 0 0 0-14.93-3M4 14a8 8 0 0 0 14.93 3"
            />
          </svg>
          Reload
        </button>
      </div>
    </header>
  );
}
