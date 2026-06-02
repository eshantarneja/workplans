'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Agenda } from '@/components/Agenda';
import { CustomerPicker } from '@/components/CustomerPicker';
import { Header } from '@/components/Header';
import { Timeline } from '@/components/Timeline';
import { WorkstreamCard } from '@/components/WorkstreamCard';
import { CUSTOMERS } from '@/lib/constants';
import { fetchTasks, fetchWorkstreams } from '@/lib/api';
import { sortWorkstreams } from '@/lib/sort';
import type { Customer } from '@/lib/types';

/** Decide the initial customer: URL query > localStorage > 'PP1'. */
function initialCustomer(): Customer {
  if (typeof window === 'undefined') return 'PP1';
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('customer') as Customer | null;
  if (fromUrl && CUSTOMERS.includes(fromUrl)) return fromUrl;
  try {
    const stored = window.localStorage.getItem('customer') as Customer | null;
    if (stored && CUSTOMERS.includes(stored)) return stored;
  } catch {
    // ignore
  }
  return 'PP1';
}

export default function Home() {
  // Defer customer-from-URL/localStorage to client mount to avoid hydration mismatch.
  // This effect intentionally seeds state from browser-only sources after mount;
  // the React 19 rule applies to derived state, not first-render bootstrapping.
  const [customer, setCustomerState] = useState<Customer>('PP1');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomerState(initialCustomer());
    setReady(true);
  }, []);

  const setCustomer = (next: Customer) => {
    setCustomerState(next);
    try {
      window.localStorage.setItem('customer', next);
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    url.searchParams.set('customer', next);
    window.history.replaceState({}, '', url.toString());
  };

  const qc = useQueryClient();
  const wsQuery = useQuery({
    queryKey: ['workstreams', customer],
    queryFn: () => fetchWorkstreams(customer),
    enabled: ready,
  });
  const tasksQuery = useQuery({
    queryKey: ['tasks', customer],
    queryFn: () => fetchTasks(customer),
    enabled: ready,
  });

  const workstreams = sortWorkstreams(wsQuery.data ?? []);
  const tasks = tasksQuery.data ?? [];

  const onReload = () => {
    qc.invalidateQueries({ queryKey: ['workstreams', customer] });
    qc.invalidateQueries({ queryKey: ['tasks', customer] });
  };

  const dataUpdatedAt =
    wsQuery.dataUpdatedAt && tasksQuery.dataUpdatedAt
      ? Math.min(wsQuery.dataUpdatedAt, tasksQuery.dataUpdatedAt)
      : null;

  const isFetching = wsQuery.isFetching || tasksQuery.isFetching;
  const error = wsQuery.error || tasksQuery.error;

  return (
    <div className="min-h-screen px-6 py-5 max-w-7xl mx-auto">
      <Header
        dataUpdatedAt={dataUpdatedAt}
        isFetching={isFetching}
        onReload={onReload}
      />

      <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
        <CustomerPicker value={customer} onChange={setCustomer} />
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              workstreams.length > 0
                ? 'bg-[var(--on-track-fg)]'
                : 'bg-[var(--text-subtle)]'
            }`}
          />
          {workstreams.length} workstream{workstreams.length === 1 ? '' : 's'} ·{' '}
          {tasks.length} task{tasks.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="mt-4">
        {/* key forces remount per customer so the agenda state resets */}
        <Agenda key={customer} customer={customer} />
      </div>

      {error && (
        <div className="mt-4 bg-[var(--blocked-bg)] border border-[var(--blocked-fg)] rounded-lg px-4 py-3 text-sm text-[var(--text)] flex items-center justify-between gap-4">
          <span>
            Couldn&apos;t load data: {error.message}
          </span>
          <button
            onClick={onReload}
            className="font-medium text-[var(--blocked-fg)] hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {ready && !error && (
        <>
          <div className="mt-5">
            {wsQuery.isLoading ? (
              <SkeletonCard label="TIMELINE" />
            ) : (
              <Timeline workstreams={workstreams} />
            )}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
              Workstreams
            </span>
            <span className="text-[10px] text-[var(--text-subtle)]">
              Click a task to edit · use ↗ to open in Notion
            </span>
          </div>

          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wsQuery.isLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : workstreams.length === 0 ? (
              <EmptyState
                customer={customer}
                onCreated={() => {
                  qc.invalidateQueries({ queryKey: ['workstreams', customer] });
                }}
              />
            ) : (
              workstreams.map((w) => (
                <WorkstreamCard
                  key={w.id}
                  workstream={w}
                  tasks={tasks}
                  customer={customer}
                />
              ))
            )}
          </div>
        </>
      )}

      <footer className="mt-10 pt-4 border-t border-[var(--border)] text-center text-xs text-[var(--text-subtle)]">
        Data pulled live from your Notion Workstreams DB · Edit anything in Notion and hit Reload above
      </footer>
    </div>
  );
}

function EmptyState({
  customer,
  onCreated,
}: {
  customer: Customer;
  onCreated: () => void;
}) {
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/workstreams/scaffold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Scaffold failed: ${res.status}`);
      }
      return res.json();
    },
    onSuccess: onCreated,
  });

  return (
    <div className="col-span-full flex flex-col items-center py-12 text-center">
      <p className="text-sm text-[var(--text-muted)] mb-4">
        No workstreams for {customer} yet.
      </p>
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="bg-[var(--accent)] text-white text-sm font-medium px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-wait"
      >
        {mutation.isPending ? 'Creating…' : '+ Create starter workstreams'}
      </button>
      {mutation.error && (
        <p className="text-xs text-[var(--blocked-fg)] mt-3">{mutation.error.message}</p>
      )}
    </div>
  );
}

function SkeletonCard({ label }: { label?: string } = {}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-5 py-4 animate-pulse">
      {label && (
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] mb-3">
          {label}
        </div>
      )}
      <div className="h-4 bg-[var(--surface-2)] rounded w-2/3 mb-3" />
      <div className="h-3 bg-[var(--surface-2)] rounded w-full mb-2" />
      <div className="h-3 bg-[var(--surface-2)] rounded w-4/5 mb-2" />
      <div className="h-3 bg-[var(--surface-2)] rounded w-3/4" />
    </div>
  );
}
