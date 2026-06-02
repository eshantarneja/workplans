'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { TASK_STATUSES } from '@/lib/constants';
import type { Customer, Task, TaskStatus, UpdateTaskBody } from '@/lib/types';

interface Props {
  task: Task;
  customer: Customer;
  onClose: () => void;
}

async function patchTask(id: string, body: UpdateTaskBody): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Save failed: ${res.status}`);
  }
  return res.json();
}

export function TaskEditForm({ task, customer, onClose }: Props) {
  const qc = useQueryClient();
  const tasksKey = ['tasks', customer] as const;

  const [name, setName] = useState(task.title);
  const [due, setDue] = useState(task.due ?? '');
  const [status, setStatus] = useState<TaskStatus>(task.status);

  const mutation = useMutation<
    Task,
    Error,
    UpdateTaskBody,
    { prev: Task[] | undefined }
  >({
    mutationFn: (body) => patchTask(task.id, body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: tasksKey });
      const prev = qc.getQueryData<Task[]>(tasksKey);
      qc.setQueryData<Task[]>(tasksKey, (curr) =>
        (curr ?? []).map((t) =>
          t.id === task.id
            ? {
                ...t,
                title: body.name ?? t.title,
                due: body.due ?? null,
                status: body.status ?? t.status,
              }
            : t,
        ),
      );
      return { prev };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.prev) qc.setQueryData(tasksKey, ctx.prev);
    },
    onSuccess: (real) => {
      qc.setQueryData<Task[]>(tasksKey, (curr) =>
        (curr ?? []).map((t) => (t.id === real.id ? real : t)),
      );
      onClose();
    },
  });

  const save = () => {
    if (!name.trim()) return;
    // Owner intentionally omitted — hidden from the UI for now, so we leave the
    // task's existing owner untouched rather than clearing it.
    mutation.mutate({
      name: name.trim(),
      due: due || null,
      status,
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="bg-[var(--surface-2)] rounded-md p-2 space-y-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Task name"
        autoFocus
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
      />
      <input
        type="date"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
        aria-label="Due date"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as TaskStatus)}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
        aria-label="Status"
      >
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {mutation.error && (
        <p className="text-xs text-[var(--blocked-fg)]">{mutation.error.message}</p>
      )}

      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || mutation.isPending}
          className="text-xs font-medium bg-[var(--accent)] text-white px-3 py-1 rounded hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
