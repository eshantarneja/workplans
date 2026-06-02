'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { WORKSTREAM_STATUSES } from '@/lib/constants';
import type {
  Customer,
  UpdateWorkstreamBody,
  Workstream,
  WorkstreamStatus,
} from '@/lib/types';

interface Props {
  workstream: Workstream;
  customer: Customer;
  onClose: () => void;
}

async function patchWorkstream(
  id: string,
  body: UpdateWorkstreamBody,
): Promise<Workstream> {
  const res = await fetch(`/api/workstreams/${id}`, {
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

export function EditWorkstreamForm({ workstream, customer, onClose }: Props) {
  const qc = useQueryClient();
  const wsKey = ['workstreams', customer] as const;

  const [name, setName] = useState(workstream.title);
  const [startDate, setStartDate] = useState(workstream.startDate ?? '');
  const [targetDate, setTargetDate] = useState(workstream.targetDate ?? '');
  const [status, setStatus] = useState<WorkstreamStatus>(workstream.status);
  const [goal, setGoal] = useState(workstream.goal);

  const mutation = useMutation<
    Workstream,
    Error,
    UpdateWorkstreamBody,
    { prev: Workstream[] | undefined }
  >({
    mutationFn: (body) => patchWorkstream(workstream.id, body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: wsKey });
      const prev = qc.getQueryData<Workstream[]>(wsKey);
      qc.setQueryData<Workstream[]>(wsKey, (curr) =>
        (curr ?? []).map((w) =>
          w.id === workstream.id
            ? {
                ...w,
                title: body.name ?? w.title,
                status: body.status ?? w.status,
                startDate: body.startDate ?? null,
                targetDate: body.targetDate ?? null,
                goal: body.goal ?? w.goal,
              }
            : w,
        ),
      );
      return { prev };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.prev) qc.setQueryData(wsKey, ctx.prev);
    },
    onSuccess: (real) => {
      qc.setQueryData<Workstream[]>(wsKey, (curr) =>
        (curr ?? []).map((w) => (w.id === real.id ? real : w)),
      );
      onClose();
    },
  });

  const save = () => {
    if (!name.trim()) return;
    mutation.mutate({
      name: name.trim(),
      customer,
      status,
      startDate: startDate || null,
      targetDate: targetDate || null,
      goal: goal.trim(),
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
      className="bg-[var(--surface-2)] rounded-lg p-3 space-y-2.5"
    >
      <div className="space-y-1">
        <FieldLabel>Workstream name</FieldLabel>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Workstream name"
          autoFocus
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          <FieldLabel>Start</FieldLabel>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <FieldLabel>Target</FieldLabel>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      <div className="space-y-1">
        <FieldLabel>Status</FieldLabel>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as WorkstreamStatus)}
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
        >
          {WORKSTREAM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <FieldLabel>Goal</FieldLabel>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Goal / description"
          rows={3}
          className="w-full resize-y bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text)] leading-snug focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      {mutation.error && (
        <p className="text-xs text-[var(--blocked-fg)]">{mutation.error.message}</p>
      )}

      <div className="flex justify-end gap-1.5 pt-0.5">
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
      {children}
    </span>
  );
}
