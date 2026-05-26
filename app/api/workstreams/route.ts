import { NextRequest, NextResponse } from 'next/server';
import { CUSTOMERS, WORKSTREAMS_DATA_SOURCE_ID } from '@/lib/constants';
import { notion, workstreamFromPage } from '@/lib/notion';
import type { Customer } from '@/lib/types';

// Notion call — do not pre-render.
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
    const res = await notion.dataSources.query({
      data_source_id: WORKSTREAMS_DATA_SOURCE_ID,
      filter: {
        property: 'Customer',
        select: { equals: customer },
      },
      page_size: 100,
    });

    const workstreams = res.results
      // Narrow PartialPageObjectResponse | PageObjectResponse to the latter.
      .filter((p) => 'properties' in p)
      .map((page) => workstreamFromPage(page as never));

    return NextResponse.json(workstreams);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[GET /api/workstreams]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
