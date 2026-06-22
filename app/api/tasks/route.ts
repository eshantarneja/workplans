import { NextRequest, NextResponse } from 'next/server';
import {
  CUSTOMERS,
  OWNERS,
  PP1_PROJECT_ID,
  TASKS_DATA_SOURCE_ID,
  WORKSTREAMS_DATA_SOURCE_ID,
} from '@/lib/constants';
import { notion, taskFromPage, workstreamFromPage } from '@/lib/notion';
import type { CreateTaskBody, Customer, Owner } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const customer = req.nextUrl.searchParams.get('customer');
  if (!customer || !CUSTOMERS.includes(customer as Customer)) {
    return NextResponse.json(
      { error: `Missing or invalid customer query param. Expected one of: ${CUSTOMERS.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    // Step 1: find this customer's workstream ids.
    const wsRes = await notion.dataSources.query({
      data_source_id: WORKSTREAMS_DATA_SOURCE_ID,
      filter: { property: 'Customer', select: { equals: customer } },
      page_size: 100,
    });
    const workstreamIds = wsRes.results
      .filter((p) => 'properties' in p)
      .map((p) => workstreamFromPage(p as never).id);

    if (workstreamIds.length === 0) {
      return NextResponse.json([]);
    }

    // Step 2: query tasks whose Workstream relation contains any of those ids.
    // Notion's `contains` filter takes one id; OR them together. Also
    // exclude Archived tasks AND subtasks (tasks with Parent-task set) —
    // children are already represented inside their parent in Notion and
    // shouldn't appear as peers in the workstream list.
    const tasksRes = await notion.dataSources.query({
      data_source_id: TASKS_DATA_SOURCE_ID,
      filter: {
        and: [
          {
            or: workstreamIds.map((id) => ({
              property: 'Workstream',
              relation: { contains: id },
            })),
          },
          { property: 'Status', status: { does_not_equal: 'Archived' } },
          { property: 'Parent-task', relation: { is_empty: true } },
        ],
      },
      page_size: 200,
    });

    const tasks = tasksRes.results
      .filter((p) => 'properties' in p)
      .map((page) => taskFromPage(page as never));

    return NextResponse.json(tasks);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[GET /api/tasks]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Partial<CreateTaskBody>;
  const { name, workstreamId, customer, owner, due } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Missing task name' }, { status: 400 });
  }
  if (!workstreamId) {
    return NextResponse.json({ error: 'Missing workstreamId' }, { status: 400 });
  }
  if (!customer || !CUSTOMERS.includes(customer as Customer)) {
    return NextResponse.json(
      { error: `Missing or invalid customer. Expected one of: ${CUSTOMERS.join(', ')}` },
      { status: 400 },
    );
  }
  if (owner && !OWNERS.includes(owner as Owner)) {
    return NextResponse.json(
      { error: `Invalid owner. Expected one of: ${OWNERS.join(', ')}` },
      { status: 400 },
    );
  }

  // Build the Notion property bag. `properties` is loosely typed because
  // each property has a different shape; the SDK's union types make this
  // unwieldy and runtime shape is what matters.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    'Task name': { title: [{ text: { content: name.trim() } }] },
    Status: { status: { name: 'Not Started' } },
    Workstream: { relation: [{ id: workstreamId }] },
  };
  if (owner) {
    properties.Owner = { multi_select: [{ name: owner }] };
  }
  if (due) {
    properties.Due = { date: { start: due } };
  }
  // PP1 tasks get tagged to the PP1 project page (spec §"Pitfalls" / §"Projects").
  if (customer === 'PP1') {
    properties.Project = { relation: [{ id: PP1_PROJECT_ID }] };
  }

  try {
    const page = await notion.pages.create({
      parent: { data_source_id: TASKS_DATA_SOURCE_ID },
      properties,
    });
    if (!('properties' in page)) {
      throw new Error('Notion returned a partial page response');
    }
    return NextResponse.json(taskFromPage(page as never));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[POST /api/tasks]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
