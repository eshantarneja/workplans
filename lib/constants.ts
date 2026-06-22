// Hardcoded so the customer dropdown renders instantly without waiting on Notion.
// See spec pitfall #7.
export const CUSTOMERS = ['PP1', 'Penta', 'Siegel', 'Whetstone', 'M&U'] as const;

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

// Notion SDK v5 queries data sources, not databases. Each DB has a default
// data source — looked up once and pinned here to avoid an extra fetch per
// query. If the DB schema gets re-keyed in Notion, refresh these.
export const WORKSTREAMS_DATA_SOURCE_ID = 'c4f38a72a973434c90cc4da09108f8da';
export const TASKS_DATA_SOURCE_ID = '1d03a4d84b0481afa081000bb4b55b8b';

// The PP1 project page in the Projects DB. New tasks for customer=PP1
// get tagged to this project so the user's existing PP1 view keeps working.
// Other customers (Penta, Siegel, Whetstone) have no project page yet — leave empty.
export const PP1_PROJECT_ID = '3323a4d84b048075bb11fa5a4b4cd3f3';
