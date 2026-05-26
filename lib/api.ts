import type { Customer, Task, Workstream } from './types';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function fetchWorkstreams(customer: Customer) {
  return getJson<Workstream[]>(`/api/workstreams?customer=${customer}`);
}

export function fetchTasks(customer: Customer) {
  return getJson<Task[]>(`/api/tasks?customer=${customer}`);
}
