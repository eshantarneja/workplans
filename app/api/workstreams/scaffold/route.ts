import { NextRequest, NextResponse } from 'next/server';
import {
  CUSTOMERS,
  WORKSTREAMS_DATA_SOURCE_ID,
} from '@/lib/constants';
import { notion, workstreamFromPage } from '@/lib/notion';
import type { Customer } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STARTER_NAMES = ['ERP Integration', 'Data Integration', 'Pricing'];

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { customer?: string };
  const customer = body.customer;
  if (!customer || !CUSTOMERS.includes(customer as Customer)) {
    return NextResponse.json(
      { error: `Missing or invalid customer. Expected one of: ${CUSTOMERS.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const created = [];
    for (const name of STARTER_NAMES) {
      const page = await notion.pages.create({
        parent: { data_source_id: WORKSTREAMS_DATA_SOURCE_ID },
        properties: {
          Workstream: {
            title: [{ text: { content: `${customer} — ${name}` } }],
          },
          Customer: { select: { name: customer } },
          Status: { select: { name: 'Not Started' } },
        },
      });
      if ('properties' in page) {
        created.push(workstreamFromPage(page as never));
      }
    }
    return NextResponse.json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[POST /api/workstreams/scaffold]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
