// Hardcoded so the customer dropdown renders instantly without waiting on Notion.
// See spec pitfall #7.
export const CUSTOMERS = ['PP1', 'Penta', 'Siegel', 'Whetstone'] as const;

export const OWNERS = ['Bill', 'Eshan', 'Ash', 'Pepe', 'bn'] as const;

export const WORKSTREAM_STATUSES = [
  'On Track',
  'At Risk',
  'Blocked',
  'Done',
  'Not Started',
] as const;

export const TASK_STATUSES = [
  'Not Started',
  'In Progress',
  'Waiting',
  'Blocked',
  'Backlog',
  'Done',
  'Archived',
] as const;

export const WORKSTREAMS_DB_ID = 'b1359e4c7c1340bea9d9ec0a59998dfd';
export const TASKS_DB_ID = '1d03a4d84b0481b694bcc7546dac3aed';

// The PP1 project page in the Projects DB. New tasks for customer=PP1
// get tagged to this project so the user's existing PP1 view keeps working.
// Other customers (Penta, Siegel, Whetstone) have no project page yet — leave empty.
export const PP1_PROJECT_ID = '3323a4d84b048075bb11fa5a4b4cd3f3';

// Sort order for workstream cards on the dashboard (lower = shown first).
// Within the same status, sort by target date ascending.
export const WORKSTREAM_STATUS_ORDER: Record<
  (typeof WORKSTREAM_STATUSES)[number],
  number
> = {
  Blocked: 0,
  'At Risk': 1,
  'On Track': 2,
  'Not Started': 3,
  Done: 4,
};
