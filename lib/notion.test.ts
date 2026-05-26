import { describe, expect, it } from 'vitest';
import {
  richTextToString,
  stripCustomerPrefix,
  stripDashes,
  taskFromPage,
  workstreamFromPage,
} from './notion';

describe('stripDashes', () => {
  it('removes all dashes from a Notion id', () => {
    expect(stripDashes('b1359e4c-7c13-40be-a9d9-ec0a59998dfd')).toBe(
      'b1359e4c7c1340bea9d9ec0a59998dfd',
    );
  });

  it('is idempotent on an already-stripped id', () => {
    expect(stripDashes('b1359e4c7c1340bea9d9ec0a59998dfd')).toBe(
      'b1359e4c7c1340bea9d9ec0a59998dfd',
    );
  });
});

describe('stripCustomerPrefix', () => {
  it('removes the customer prefix with em dash', () => {
    expect(stripCustomerPrefix('PP1 — ERP Integration', 'PP1')).toBe('ERP Integration');
  });

  it('leaves a hyphen-only title untouched (spec uses em dash, not hyphen)', () => {
    expect(stripCustomerPrefix('PP1 - ERP Integration', 'PP1')).toBe('PP1 - ERP Integration');
  });

  it('returns the original title when no prefix is present', () => {
    expect(stripCustomerPrefix('ERP Integration', 'PP1')).toBe('ERP Integration');
  });

  it('only strips its own customer prefix', () => {
    expect(stripCustomerPrefix('Penta — ERP Integration', 'PP1')).toBe(
      'Penta — ERP Integration',
    );
  });
});

describe('richTextToString', () => {
  it('concatenates plain_text from a rich_text array', () => {
    expect(
      richTextToString([
        { plain_text: 'Hello ' },
        { plain_text: 'world' },
      ] as never),
    ).toBe('Hello world');
  });

  it('returns empty string for empty array', () => {
    expect(richTextToString([])).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(richTextToString(undefined)).toBe('');
  });
});

// Minimal synthetic Notion page used as a test fixture. We only fill
// the props we read; the SDK types are looser at runtime than at compile time.
// `any` here is intentional — we're simulating the property bag the SDK
// returns, not asserting its compile-time shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeWorkstreamPage: any = {
  id: 'a1b2c3d4-1111-2222-3333-444455556666',
  url: 'https://www.notion.so/a1b2c3d411112222333344445555666',
  properties: {
    Workstream: {
      type: 'title',
      title: [{ plain_text: 'PP1 — ERP Integration' }],
    },
    Customer: {
      type: 'select',
      select: { name: 'PP1' },
    },
    Status: {
      type: 'select',
      select: { name: 'Blocked' },
    },
    Dates: {
      type: 'date',
      date: { start: '2026-04-27', end: '2026-06-30' },
    },
    Goal: {
      type: 'rich_text',
      rich_text: [{ plain_text: 'Live two-way sync.' }],
    },
    Headline: {
      type: 'rich_text',
      rich_text: [],
    },
  },
};

describe('workstreamFromPage', () => {
  it('maps a complete page', () => {
    const ws = workstreamFromPage(fakeWorkstreamPage as never);
    expect(ws).toEqual({
      id: 'a1b2c3d4111122223333444455556666',
      title: 'ERP Integration',
      customer: 'PP1',
      status: 'Blocked',
      startDate: '2026-04-27',
      targetDate: '2026-06-30',
      goal: 'Live two-way sync.',
      headline: '',
      url: 'https://www.notion.so/a1b2c3d411112222333344445555666',
    });
  });

  it('handles missing dates', () => {
    const page = structuredClone(fakeWorkstreamPage);
    page.properties.Dates.date = null;
    const ws = workstreamFromPage(page as never);
    expect(ws.startDate).toBeNull();
    expect(ws.targetDate).toBeNull();
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeTaskPage: any = {
  id: '11111111-2222-3333-4444-555566667777',
  url: 'https://www.notion.so/1111111122223333444455556666',
  properties: {
    'Task name': {
      type: 'title',
      title: [{ plain_text: 'Get API Access' }],
    },
    // Status is type "status", not "select" (spec pitfall #2).
    Status: {
      type: 'status',
      status: { name: 'Blocked' },
    },
    Owner: {
      type: 'multi_select',
      multi_select: [{ name: 'Eshan' }, { name: 'Bill' }],
    },
    Due: {
      type: 'date',
      date: { start: '2026-05-21' },
    },
    Priority: {
      type: 'select',
      select: { name: 'High' },
    },
    Notes: {
      type: 'rich_text',
      rich_text: [{ plain_text: 'Waiting on vendor.' }],
    },
    Workstream: {
      type: 'relation',
      relation: [{ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }],
    },
    Project: {
      type: 'relation',
      relation: [{ id: '3323a4d8-4b04-8075-bb11-fa5a4b4cd3f3' }],
    },
  },
};

describe('taskFromPage', () => {
  it('maps a complete page (Status uses the "status" key, not "select")', () => {
    const t = taskFromPage(fakeTaskPage as never);
    expect(t).toEqual({
      id: '11111111222233334444555566667777',
      title: 'Get API Access',
      status: 'Blocked',
      owners: ['Eshan', 'Bill'],
      due: '2026-05-21',
      priority: 'High',
      notes: 'Waiting on vendor.',
      workstreamId: 'aaaaaaaabbbbccccddddeeeeeeeeeeee',
      projectId: '3323a4d84b048075bb11fa5a4b4cd3f3',
      url: 'https://www.notion.so/1111111122223333444455556666',
    });
  });

  it('returns null workstreamId/projectId/due/priority when properties are empty', () => {
    const page = structuredClone(fakeTaskPage);
    page.properties.Workstream.relation = [];
    page.properties.Project.relation = [];
    page.properties.Due.date = null;
    page.properties.Priority.select = null;
    const t = taskFromPage(page as never);
    expect(t.workstreamId).toBeNull();
    expect(t.projectId).toBeNull();
    expect(t.due).toBeNull();
    expect(t.priority).toBeNull();
  });
});
