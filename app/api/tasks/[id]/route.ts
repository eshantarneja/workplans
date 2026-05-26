import { NextRequest, NextResponse } from 'next/server';
import { TASK_STATUSES } from '@/lib/constants';
import { notion, taskFromPage } from '@/lib/notion';
import type { TaskStatus, UpdateTaskBody } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing task id' }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<UpdateTaskBody>;
  const { workstreamId, status, name } = body;

  if (status && !TASK_STATUSES.includes(status as TaskStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Expected one of: ${TASK_STATUSES.join(', ')}` },
      { status: 400 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};
  if (workstreamId) {
    properties.Workstream = { relation: [{ id: workstreamId }] };
  }
  if (status) {
    properties.Status = { status: { name: status } };
  }
  if (name) {
    properties['Task name'] = { title: [{ text: { content: name } }] };
  }

  if (Object.keys(properties).length === 0) {
    return NextResponse.json(
      { error: 'Nothing to update — provide at least one of workstreamId, status, name' },
      { status: 400 },
    );
  }

  try {
    const page = await notion.pages.update({ page_id: id, properties });
    if (!('properties' in page)) {
      throw new Error('Notion returned a partial page response');
    }
    return NextResponse.json(taskFromPage(page as never));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[PATCH /api/tasks/${id}]`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
