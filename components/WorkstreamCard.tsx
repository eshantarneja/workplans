'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { daysOver, formatMonthDay, todayIso } from '@/lib/dates';
import { sortTasksByDue } from '@/lib/sort';
import type { Customer, Task, Workstream } from '@/lib/types';
import { AddTaskForm } from './AddTaskForm';
import { EditWorkstreamForm } from './EditWorkstreamForm';
import { STATUS_FG, StatusPill } from './StatusPill';
import { TaskEditForm } from './TaskEditForm';

interface Props {
  workstream: Workstream;
  tasks: Task[];
  customer: Customer;
}

const DRAG_MIME = 'application/x-workplan-task-id';

export function WorkstreamCard({ workstream, tasks, customer }: Props) {
  const qc = useQueryClient();
  const [isDragOver, setIsDragOver] = useState(false);
  const [editing, setEditing] = useState(false);
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
  // Strictly by due date, earliest first; no-due-date tasks sort last.
  const orderedTasks = sortTasksByDue(wsTasks);

  const overdue =
    workstream.status !== 'Done'
      ? daysOver(workstream.targetDate, todayIso())
      : null;

  const totalCount = orderedTasks.length;
  const doneCount = orderedTasks.filter((t) => t.status === 'Done').length;
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
      {editing ? (
        <div className="p-3">
          <EditWorkstreamForm
            workstream={workstream}
            customer={customer}
            onClose={() => setEditing(false)}
          />
        </div>
      ) : (
        <>
          <div className="px-5 pt-4 pb-2 flex items-start justify-between gap-3">
            <a
              href={workstream.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[15px] font-semibold text-[var(--text)] hover:text-[var(--accent)] leading-tight"
            >
              {workstream.title}
            </a>
            <div className="flex items-center gap-1.5 shrink-0">
              <StatusPill status={workstream.status} />
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit workstream"
                title="Edit workstream"
                className="text-[var(--text-subtle)] hover:text-[var(--accent)] p-0.5 -mr-1"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                  />
                </svg>
              </button>
            </div>
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
        </>
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
              <TaskRow key={t.id} task={t} customer={customer} />
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

function TaskRow({ task, customer }: { task: Task; customer: Customer }) {
  const [editing, setEditing] = useState(false);
  const isDone = task.status === 'Done';
  const isBlocked = task.status === 'Blocked';
  const isOverdue =
    !isDone && task.due ? daysOver(task.due, todayIso()) !== null : false;

  if (editing) {
    return (
      <li>
        <TaskEditForm
          task={task}
          customer={customer}
          onClose={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="flex items-center gap-2 text-xs group cursor-grab active:cursor-grabbing"
    >
      {isBlocked ? (
        // Blocked tasks keep a marker so they still stand out inline.
        <span
          className="w-3.5 h-3.5 rounded-full bg-[var(--blocked-fg)] text-white text-[9px] font-bold flex items-center justify-center shrink-0"
          aria-label="Blocked"
          title="Blocked"
        >
          !
        </span>
      ) : (
        <span
          className={`inline-block w-2 h-2 rounded-full shrink-0 ${
            isDone
              ? 'bg-[var(--text-subtle)]'
              : 'border border-[var(--text-subtle)]'
          }`}
          aria-hidden
        />
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        // Clicking edits; the row still drags. Stop the drag from starting on
        // a deliberate click so it registers as a click, not a drag.
        onDragStart={(e) => e.stopPropagation()}
        draggable={false}
        title="Click to edit"
        className={`flex-1 truncate text-left hover:text-[var(--accent)] ${
          isDone
            ? 'line-through text-[var(--text-subtle)]'
            : isBlocked
              ? 'text-[var(--blocked-fg)] font-medium'
              : 'text-[var(--text)]'
        }`}
      >
        {task.title || '(untitled)'}
      </button>
      {/* Owner intentionally hidden from the UI for now (data is preserved). */}
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
      <a
        href={task.url}
        target="_blank"
        rel="noopener noreferrer"
        onDragStart={(e) => e.stopPropagation()}
        draggable={false}
        aria-label="Open in Notion"
        title="Open in Notion"
        className="shrink-0 text-[var(--text-subtle)] hover:text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5v5M19 5l-7 7M12 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6" />
        </svg>
      </a>
    </li>
  );
}
