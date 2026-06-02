import { NextRequest, NextResponse } from 'next/server';
import { CUSTOMERS, WORKSTREAM_STATUSES } from '@/lib/constants';
import { notion, workstreamFromPage } from '@/lib/notion';
import type { Customer, UpdateWorkstreamBody, WorkstreamStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing workstream id' }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<UpdateWorkstreamBody>;
  const { name, customer, status, startDate, targetDate, goal } = body;

  if (status && !WORKSTREAM_STATUSES.includes(status as WorkstreamStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Expected one of: ${WORKSTREAM_STATUSES.join(', ')}` },
      { status: 400 },
    );
  }
  if (customer && !CUSTOMERS.includes(customer as Customer)) {
    return NextResponse.json(
      { error: `Invalid customer. Expected one of: ${CUSTOMERS.join(', ')}` },
      { status: 400 },
    );
  }

  // Loosely typed — each Notion property has a different shape and the SDK's
  // union types are unwieldy. Runtime shape is what matters.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  // Re-add the "{Customer} — " prefix that workstreamFromPage strips, matching
  // what the scaffold route writes. Falls back to the bare name if no customer.
  if (name !== undefined) {
    const title = customer ? `${customer} — ${name}` : name;
    properties.Workstream = { title: [{ text: { content: title } }] };
  }
  if (status) {
    properties.Status = { select: { name: status } };
  }
  if (goal !== undefined) {
    properties.Goal = { rich_text: [{ text: { content: goal } }] };
  }
  // Start and target live in one "Dates" property. Only touch it when at least
  // one half was provided; write both so neither is dropped. If both are
  // empty, clear the property.
  if (startDate !== undefined || targetDate !== undefined) {
    const start = startDate ?? null;
    const end = targetDate ?? null;
    properties.Dates = start ? { date: { start, end } } : { date: null };
  }

  if (Object.keys(properties).length === 0) {
    return NextResponse.json(
      { error: 'Nothing to update — provide at least one field' },
      { status: 400 },
    );
  }

  try {
    const page = await notion.pages.update({ page_id: id, properties });
    if (!('properties' in page)) {
      throw new Error('Notion returned a partial page response');
    }
    return NextResponse.json(workstreamFromPage(page as never));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[PATCH /api/workstreams/${id}]`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
