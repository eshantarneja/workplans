'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { daysOver, formatMonthDay, todayIso } from '@/lib/dates';
import type { Customer, Task, Workstream } from '@/lib/types';
import { AddTaskForm } from './AddTaskForm';
import { STATUS_FG, StatusPill } from './StatusPill';

interface Props {
  workstream: Workstream;
  tasks: Task[];
  customer: Customer;
}

const DRAG_MIME = 'application/x-workplan-task-id';

export function WorkstreamCard({ workstream, tasks, customer }: Props) {
  const qc = useQueryClient();
  const [isDragOver, setIsDragOver] = useState(false);
  const tasksKey = ['tasks', customer] as const;

  const moveMutation = useMutation<
    Task,
    Error,
    { taskId: string; destId: string },
    { prev: Task[] | undefined }
  >({
    mutationFn: async ({ taskId, destId }) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workstreamId: destId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Move failed: ${res.status}`);
      }
      return res.json();
    },
    onMutate: async ({ taskId, destId }) => {
      await qc.cancelQueries({ queryKey: tasksKey });
      const prev = qc.getQueryData<Task[]>(tasksKey);
      qc.setQueryData<Task[]>(tasksKey, (curr) =>
        (curr ?? []).map((t) =>
          t.id === taskId ? { ...t, workstreamId: destId } : t,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(tasksKey, ctx.prev);
    },
  });

  const wsTasks = tasks.filter((t) => t.workstreamId === workstream.id);
  const blockers = wsTasks.filter((t) => t.status === 'Blocked');
  const regular = wsTasks.filter((t) => t.status !== 'Blocked');

  // Open tasks first (sorted by due asc), then Done at the bottom.
  const open = regular
    .filter((t) => t.status !== 'Done')
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));
  const done = regular.filter((t) => t.status === 'Done');
  const orderedTasks = [...open, ...done];

  const overdue =
    workstream.status !== 'Done'
      ? daysOver(workstream.targetDate, todayIso())
      : null;

  const totalCount = orderedTasks.length;
  const doneCount = done.length;
  const countLabel =
    totalCount === 0
      ? '0'
      : doneCount === 0
        ? String(totalCount)
        : `${totalCount} · ${doneCount} done`;

  return (
    <article
      onDragOver={(e) => {
        // Only react if the drag actually carries a task id.
        if (e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault();
          setIsDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        // The leave fires when crossing into children too; only clear
        // when we've truly left the card.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const taskId = e.dataTransfer.getData(DRAG_MIME);
        if (!taskId) return;
        const moving = tasks.find((t) => t.id === taskId);
        if (!moving) return;
        if (moving.workstreamId === workstream.id) return; // dropped on its own card
        moveMutation.mutate({ taskId, destId: workstream.id });
      }}
      className={`bg-[var(--surface)] border rounded-xl shadow-sm overflow-hidden flex flex-col transition-colors ${
        isDragOver
          ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30'
          : 'border-[var(--border)]'
      }`}
      style={{ borderTopWidth: 4, borderTopColor: STATUS_FG[workstream.status] }}
    >
      <div className="px-5 pt-4 pb-2 flex items-start justify-between gap-3">
        <a
          href={workstream.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[15px] font-semibold text-[var(--text)] hover:text-[var(--accent)] leading-tight"
        >
          {workstream.title}
        </a>
        <StatusPill status={workstream.status} />
      </div>

      <div className="px-5 text-xs text-[var(--text-muted)] flex items-baseline gap-3 flex-wrap">
        {workstream.startDate && (
          <span>
            Start <span className="text-[var(--text)] font-medium">{formatMonthDay(workstream.startDate)}</span>
          </span>
        )}
        {workstream.targetDate && (
          <span>
            Target{' '}
            <span className="text-[var(--text)] font-medium">{formatMonthDay(workstream.targetDate)}</span>
          </span>
        )}
        {overdue !== null && (
          <span className="text-[var(--blocked-fg)] font-medium">
            ({overdue}d over)
          </span>
        )}
      </div>

      {workstream.headline && (
        <p className="px-5 mt-1 text-xs text-[var(--text-muted)] italic">{workstream.headline}</p>
      )}

      {workstream.goal && (
        <div className="mx-5 mt-3 bg-[var(--surface-2)] rounded-lg px-3 py-2 border-l-[3px] border-[var(--accent)]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] mb-0.5">
            Goal
          </div>
          <p className="text-sm text-[var(--text)] leading-snug">{workstream.goal}</p>
        </div>
      )}

      {blockers.length > 0 && (
        <Section title="Blockers" count={blockers.length} className="mt-4">
          <div className="space-y-2">
            {blockers.map((t) => (
              <BlockerCallout key={t.id} task={t} />
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Tasks"
        count={countLabel}
        className="mt-4 flex-1"
      >
        {orderedTasks.length === 0 ? (
          <p className="text-xs text-[var(--text-subtle)] italic">
            No tasks yet — add one below or drag from another workstream.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {orderedTasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        )}
      </Section>

      <div className="px-5 pb-4 pt-3">
        <AddTaskForm customer={customer} workstreamId={workstream.id} />
      </div>
    </article>
  );
}

function Section({
  title,
  count,
  className = '',
  children,
}: {
  title: string;
  count: number | string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`px-5 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
          {title}
        </span>
        <span className="text-[10px] font-medium text-[var(--text-subtle)] tabular-nums">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const isDone = task.status === 'Done';
  const isOverdue =
    !isDone && task.due ? daysOver(task.due, todayIso()) !== null : false;

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="flex items-center gap-2 text-xs group cursor-grab active:cursor-grabbing"
    >
      <span
        className={`inline-block w-2 h-2 rounded-full shrink-0 ${
          isDone
            ? 'bg-[var(--text-subtle)]'
            : 'border border-[var(--text-subtle)]'
        }`}
        aria-hidden
      />
      <a
        href={task.url}
        target="_blank"
        rel="noopener noreferrer"
        // Don't start a drag when the user clicks the link; the row's
        // onDragStart still fires for the rest of the row.
        onDragStart={(e) => e.stopPropagation()}
        draggable={false}
        className={`flex-1 truncate hover:text-[var(--accent)] ${
          isDone
            ? 'line-through text-[var(--text-subtle)]'
            : 'text-[var(--text)]'
        }`}
      >
        {task.title || '(untitled)'}
      </a>
      {task.owners[0] && (
        <span className="text-[var(--text-muted)] shrink-0">{task.owners[0]}</span>
      )}
      {task.due && (
        <span
          className={`shrink-0 tabular-nums ${
            isOverdue
              ? 'text-[var(--blocked-fg)] font-medium'
              : isDone
                ? 'text-[var(--text-subtle)]'
                : 'text-[var(--text-muted)]'
          }`}
        >
          {formatMonthDay(task.due)}
        </span>
      )}
    </li>
  );
}

function BlockerCallout({ task }: { task: Task }) {
  return (
    <a
      href={task.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-[var(--blocked-bg)] border-l-[3px] border-[var(--blocked-fg)] rounded px-3 py-2 hover:bg-red-100"
    >
      <div className="flex items-center gap-2">
        <span
          className="w-4 h-4 rounded-full bg-[var(--blocked-fg)] text-white text-[10px] font-bold flex items-center justify-center shrink-0"
          aria-hidden
        >
          !
        </span>
        <span className="text-sm font-medium text-[var(--text)]">
          {task.title || '(untitled)'}
        </span>
      </div>
      {(task.owners.length > 0 || task.due) && (
        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 pl-6">
          {task.owners.length > 0 && <>Owner: {task.owners.join(', ')}</>}
          {task.owners.length > 0 && task.due && ' · '}
          {task.due && <>Date: {formatMonthDay(task.due)}</>}
        </div>
      )}
    </a>
  );
}
