import { NextRequest, NextResponse } from 'next/server';
import {
  CUSTOMERS,
  TASKS_DATA_SOURCE_ID,
  WORKSTREAMS_DATA_SOURCE_ID,
} from '@/lib/constants';
import { notion, taskFromPage, workstreamFromPage } from '@/lib/notion';
import type { Customer } from '@/lib/types';

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
    // exclude Archived tasks server-side.
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
