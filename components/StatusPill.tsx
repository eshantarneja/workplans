import type { WorkstreamStatus } from '@/lib/types';

const CLASSES: Record<WorkstreamStatus, string> = {
  'On Track': 'bg-[var(--on-track-bg)] text-[var(--on-track-fg)]',
  'At Risk': 'bg-[var(--at-risk-bg)] text-[var(--at-risk-fg)]',
  Blocked: 'bg-[var(--blocked-bg)] text-[var(--blocked-fg)]',
  Done: 'bg-[var(--done-bg)] text-[var(--done-fg)]',
  'Not Started': 'bg-[var(--not-started-bg)] text-[var(--not-started-fg)]',
};

export function StatusPill({ status }: { status: WorkstreamStatus }) {
  return (
    <span
      className={`${CLASSES[status]} text-[10px] font-semibold uppercase tracking-wider rounded-full px-2.5 py-1 whitespace-nowrap`}
    >
      {status}
    </span>
  );
}

/** Maps a workstream status to its accent color (hex string). */
export const STATUS_FG: Record<WorkstreamStatus, string> = {
  'On Track': 'var(--on-track-fg)',
  'At Risk': 'var(--at-risk-fg)',
  Blocked: 'var(--blocked-fg)',
  Done: 'var(--done-fg)',
  'Not Started': 'var(--not-started-fg)',
};

export const STATUS_BG: Record<WorkstreamStatus, string> = {
  'On Track': 'var(--on-track-bg)',
  'At Risk': 'var(--at-risk-bg)',
  Blocked: 'var(--blocked-bg)',
  Done: 'var(--done-bg)',
  'Not Started': 'var(--not-started-bg)',
};
