'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { OWNERS } from '@/lib/constants';
import type { CreateTaskBody, Customer, Owner, Task } from '@/lib/types';

interface Props {
  customer: Customer;
  workstreamId: string;
}

async function postTask(body: CreateTaskBody): Promise<Task> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Create failed: ${res.status}`);
  }
  return res.json();
}

export function AddTaskForm({ customer, workstreamId }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [owner, setOwner] = useState<Owner | ''>('');
  const [due, setDue] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const tasksKey = ['tasks', customer] as const;

  const mutation = useMutation<
    Task,
    Error,
    CreateTaskBody,
    { prev: Task[] | undefined; tempId: string }
  >({
    mutationFn: postTask,
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: tasksKey });
      const prev = qc.getQueryData<Task[]>(tasksKey);
      const tempId = `temp-${Date.now()}`;
      const optimistic: Task = {
        id: tempId,
        title: body.name,
        status: 'Not Started',
        owners: body.owner ? [body.owner] : [],
        due: body.due ?? null,
        priority: null,
        notes: '',
        workstreamId: body.workstreamId,
        projectId: null,
        url: '',
      };
      qc.setQueryData<Task[]>(tasksKey, [...(prev ?? []), optimistic]);
      return { prev, tempId };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.prev) qc.setQueryData(tasksKey, ctx.prev);
    },
    onSuccess: (real, _body, ctx) => {
      // Replace the optimistic temp row with the real one.
      qc.setQueryData<Task[]>(tasksKey, (curr) =>
        (curr ?? []).map((t) => (t.id === ctx?.tempId ? real : t)),
      );
    },
    // Don't invalidate — the optimistic + replace flow is correct and a
    // refetch here would clobber any other pending optimistic state.
  });

  const expand = () => {
    setOpen(true);
    // focus on next tick so the input is mounted.
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const cancel = () => {
    setOpen(false);
    setName('');
    setOwner('');
    setDue('');
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    mutation.mutate({
      name: trimmed,
      workstreamId,
      customer,
      owner: owner || undefined,
      due: due || undefined,
    });
    cancel();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={expand}
        className="w-full border border-dashed border-[var(--border)] rounded-md py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-subtle)] transition-colors"
      >
        + Add task
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') cancel();
      }}
      className="bg-[var(--surface-2)] rounded-md p-2 space-y-2"
    >
      <input
        ref={nameRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Task name"
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
      />
      <div className="flex gap-1.5">
        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value as Owner | '')}
          className="flex-1 min-w-0 bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          aria-label="Owner"
        >
          <option value="">—</option>
          {OWNERS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="flex-1 min-w-0 bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          aria-label="Due date"
        />
      </div>
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={cancel}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className="text-xs font-medium bg-[var(--accent)] text-white px-3 py-1 rounded hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </form>
  );
}
