import { CUSTOMERS, OWNERS, TASK_STATUSES, WORKSTREAM_STATUSES } from './constants';

export type Customer = (typeof CUSTOMERS)[number];
export type Owner = (typeof OWNERS)[number];
export type WorkstreamStatus = (typeof WORKSTREAM_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type Priority = 'Low' | 'Medium' | 'High';

export interface Workstream {
  id: string;
  /** Display title with the "{Customer} — " prefix already stripped. */
  title: string;
  customer: Customer;
  status: WorkstreamStatus;
  /** ISO YYYY-MM-DD or null. */
  startDate: string | null;
  /** ISO YYYY-MM-DD or null. */
  targetDate: string | null;
  goal: string;
  headline: string;
  /** Direct Notion URL (https://www.notion.so/<id>). */
  url: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  owners: Owner[];
  /** ISO YYYY-MM-DD or null. */
  due: string | null;
  priority: Priority | null;
  notes: string;
  /** First Workstream relation id, or null. */
  workstreamId: string | null;
  /** First Project relation id, or null. */
  projectId: string | null;
  /** Direct Notion URL. */
  url: string;
}

/** Body shape for POST /api/tasks. */
export interface CreateTaskBody {
  name: string;
  workstreamId: string;
  customer: Customer;
  owner?: Owner | null;
  due?: string | null;
}

/**
 * Body shape for PATCH /api/tasks/[id]. All fields optional; only the keys
 * present are written. `owner: null` or `due: null` clears that field.
 */
export interface UpdateTaskBody {
  workstreamId?: string;
  status?: TaskStatus;
  name?: string;
  owner?: Owner | null;
  due?: string | null;
}

/**
 * Body shape for PATCH /api/workstreams/[id]. All fields optional; only the
 * ones present are written. `name` is the display title WITHOUT the
 * "{Customer} — " prefix — the route re-adds it using `customer`.
 * `startDate`/`targetDate` map to the single Notion "Dates" property (start +
 * end); send both together so neither half is lost.
 */
export interface UpdateWorkstreamBody {
  name?: string;
  customer?: Customer;
  status?: WorkstreamStatus;
  startDate?: string | null;
  targetDate?: string | null;
  goal?: string;
}
