import { Client } from '@notionhq/client';
import type {
  Customer,
  Owner,
  Priority,
  Task,
  TaskStatus,
  Workstream,
  WorkstreamStatus,
} from './types';

/**
 * Singleton Notion client. The token comes from the server-side env only —
 * this module must never be imported from a client component.
 */
export const notion = new Client({ auth: process.env.NOTION_TOKEN });

// ---- helpers -------------------------------------------------------------

/** Strip dashes from a Notion id for compact, URL-friendly form. */
export function stripDashes(id: string): string {
  return id.replace(/-/g, '');
}

/**
 * Remove the leading "{Customer} — " prefix from a workstream title.
 * Spec uses an em dash; hyphen-only titles are left alone.
 */
export function stripCustomerPrefix(title: string, customer: Customer): string {
  const prefix = `${customer} — `;
  return title.startsWith(prefix) ? title.slice(prefix.length) : title;
}

interface RichTextItem {
  plain_text: string;
}

/** Concatenate plain_text fragments from a rich_text array. */
export function richTextToString(items: RichTextItem[] | undefined): string {
  if (!items || items.length === 0) return '';
  return items.map((i) => i.plain_text).join('');
}

// ---- page mappers --------------------------------------------------------

// Loose property-bag type — the SDK's typed responses are unwieldy and we
// only read a handful of well-known fields. Runtime shape is what matters.
type AnyPage = {
  id: string;
  url: string;
  properties: Record<string, AnyProperty>;
};
type AnyProperty = {
  type: string;
  title?: RichTextItem[];
  rich_text?: RichTextItem[];
  select?: { name: string } | null;
  status?: { name: string } | null;
  multi_select?: { name: string }[];
  date?: { start: string | null; end?: string | null } | null;
  relation?: { id: string }[];
  number?: number | null;
};

function titleText(prop: AnyProperty | undefined): string {
  return richTextToString(prop?.title);
}

function richText(prop: AnyProperty | undefined): string {
  return richTextToString(prop?.rich_text);
}

export function workstreamFromPage(page: AnyPage): Workstream {
  const props = page.properties;
  const rawTitle = titleText(props.Workstream);
  const customer = (props.Customer?.select?.name ?? 'PP1') as Customer;
  return {
    id: stripDashes(page.id),
    title: stripCustomerPrefix(rawTitle, customer),
    customer,
    status: (props.Status?.select?.name ?? 'Not Started') as WorkstreamStatus,
    startDate: props.Dates?.date?.start ?? null,
    targetDate: props.Dates?.date?.end ?? null,
    goal: richText(props.Goal),
    headline: richText(props.Headline),
    url: page.url,
    order: props.Order?.number ?? null,
  };
}

export function taskFromPage(page: AnyPage): Task {
  const props = page.properties;
  const owners = (props.Owner?.multi_select ?? []).map((o) => o.name as Owner);
  return {
    id: stripDashes(page.id),
    title: titleText(props['Task name']),
    // Tasks DB uses Notion's "status" property type, NOT "select".
    // See spec pitfall #2.
    status: (props.Status?.status?.name ?? 'Not Started') as TaskStatus,
    owners,
    due: props.Due?.date?.start ?? null,
    priority: (props.Priority?.select?.name ?? null) as Priority | null,
    notes: richText(props.Notes),
    workstreamId: props.Workstream?.relation?.[0]?.id
      ? stripDashes(props.Workstream.relation[0].id)
      : null,
    projectId: props.Project?.relation?.[0]?.id
      ? stripDashes(props.Project.relation[0].id)
      : null,
    url: page.url,
  };
}
