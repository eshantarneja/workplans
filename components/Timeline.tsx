'use client';

import { formatMonthDay, todayIso, weeklyTicks } from '@/lib/dates';
import type { Workstream } from '@/lib/types';
import { STATUS_FG } from './StatusPill';

const MS_PER_DAY = 86_400_000;

function parseIso(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Gantt-style timeline. One row per workstream. Bars are absolutely
 * positioned over a date scale; weekly tick labels run along the top.
 * A vertical line marks today when it's in range.
 */
export function Timeline({ workstreams }: { workstreams: Workstream[] }) {
  const dated = workstreams.filter((w) => w.startDate && w.targetDate);
  if (dated.length === 0) {
    return (
      <section className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-5 py-4">
        <SectionHeader />
        <p className="mt-3 text-xs text-[var(--text-subtle)] italic">
          No workstreams have start + target dates yet.
        </p>
      </section>
    );
  }

  // Compute the visible date range with a little padding on each side.
  const minStart = dated.reduce(
    (acc, w) => (w.startDate! < acc ? w.startDate! : acc),
    dated[0].startDate!,
  );
  const maxEnd = dated.reduce(
    (acc, w) => (w.targetDate! > acc ? w.targetDate! : acc),
    dated[0].targetDate!,
  );
  // Pad by ~7 days on each side and snap to week boundaries via ticks.
  const padDays = 7;
  const rangeStart = new Date(parseIso(minStart) - padDays * MS_PER_DAY);
  const rangeEnd = new Date(parseIso(maxEnd) + padDays * MS_PER_DAY);
  const rangeStartIso = rangeStart.toISOString().slice(0, 10);
  const rangeEndIso = rangeEnd.toISOString().slice(0, 10);
  const ticks = weeklyTicks(rangeStartIso, rangeEndIso);

  const totalMs = parseIso(rangeEndIso) - parseIso(rangeStartIso);
  const pct = (iso: string) =>
    ((parseIso(iso) - parseIso(rangeStartIso)) / totalMs) * 100;

  const today = todayIso();
  const todayInRange = today >= rangeStartIso && today <= rangeEndIso;

  return (
    <section className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-5 py-4">
      <SectionHeader />
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header row: axis ticks */}
          <div className="flex">
            <div className="w-44 shrink-0" />
            <div className="relative flex-1 h-6">
              {ticks.map((iso, i) => (
                <span
                  key={iso}
                  className="absolute -translate-x-1/2 text-[10px] text-[var(--text-subtle)] whitespace-nowrap"
                  style={{
                    left: `${pct(iso)}%`,
                    top: i % 2 === 0 ? 0 : 12,
                  }}
                >
                  {formatMonthDay(iso)}
                </span>
              ))}
              {todayInRange && (
                <span
                  className="absolute -translate-x-1/2 top-0 text-[10px] font-semibold text-[var(--accent)]"
                  style={{ left: `${pct(today)}%` }}
                >
                  today
                </span>
              )}
            </div>
          </div>

          {/* Rows: workstream bars */}
          <div className="mt-2 space-y-2">
            {workstreams.map((w) => {
              const hasDates = w.startDate && w.targetDate;
              return (
                <div key={w.id} className="flex items-center">
                  <div className="w-44 shrink-0 text-xs text-[var(--text)] pr-3 truncate">
                    {w.title}
                  </div>
                  <div className="relative flex-1 h-7 bg-[var(--surface-2)] rounded">
                    {hasDates && (
                      <div
                        className="absolute top-0 bottom-0 rounded flex items-center justify-center text-[11px] font-medium px-2 whitespace-nowrap overflow-hidden"
                        style={{
                          left: `${pct(w.startDate!)}%`,
                          width: `${Math.max(2, pct(w.targetDate!) - pct(w.startDate!))}%`,
                          background: STATUS_FG[w.status],
                          color: '#ffffff',
                        }}
                        title={`${w.title}: ${formatMonthDay(w.startDate)} → ${formatMonthDay(w.targetDate)}`}
                      >
                        {formatMonthDay(w.startDate)} → {formatMonthDay(w.targetDate)}
                      </div>
                    )}
                    {todayInRange && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-[var(--accent)]"
                        style={{ left: `${pct(today)}%` }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader() {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
        Timeline
      </span>
      <span className="text-[10px] text-[var(--text-subtle)]">
        Bars show workstream span. Vertical line = today.
      </span>
    </div>
  );
}
