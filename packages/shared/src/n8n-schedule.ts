import { z } from 'zod';

// Pure dispatch plans. This module never calls n8n, a provider or a database.
const settingsSchema = z
  .object({
    stories_twice_daily: z.boolean().default(false),
    backfill_enabled: z.boolean().default(false),
  })
  .strict();
const slotSchema = z.string().min(1).max(100);
const timestampSchema = z.iso.datetime({ offset: true });
function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error('Invalid schedule input');
  return result.data;
}
type Mode = 'daily' | 'weekly' | 'removal_check' | 'backfill';
type Call = {
  workflow: string;
  delayMinutes: number;
  input: { env: 'dev'; mode: Mode; limit: number; result_type?: 'posts' | 'reels' };
};
type Plan = { recognized: boolean; calls: Call[]; auditReason?: 'unknown_schedule_slot' };
type Rule = { slot: string; hour: number; minute: number; weekday?: string };

const rules: readonly Rule[] = [
  { slot: 'web_map', hour: 1, minute: 0 },
  { slot: 'vimeo', hour: 2, minute: 0 },
  { slot: 'ig_posts', hour: 2, minute: 30 },
  { slot: 'ig_reels', hour: 3, minute: 0 },
  { slot: 'youtube', hour: 3, minute: 30 },
  { slot: 'li_posts', hour: 4, minute: 0 },
  { slot: 'removal', hour: 4, minute: 0, weekday: 'Sat' },
  { slot: 'li_employees', hour: 5, minute: 0, weekday: 'Sun' },
  { slot: 'stories_am', hour: 6, minute: 0 },
  { slot: 'linker', hour: 6, minute: 30 },
  { slot: 'news', hour: 7, minute: 0, weekday: 'Sun' },
  { slot: 'briefs', hour: 8, minute: 0, weekday: 'Mon' },
  { slot: 'digest', hour: 9, minute: 0 },
  { slot: 'health', hour: 9, minute: 15 },
  { slot: 'stories_pm', hour: 18, minute: 0 },
];

function call(workflow: string, mode: Mode = 'daily', result_type?: 'posts' | 'reels'): Call {
  return {
    workflow,
    delayMinutes: 0,
    input: {
      env: 'dev',
      mode,
      limit: mode === 'backfill' ? 10 : 500,
      ...(result_type ? { result_type } : {}),
    },
  };
}

/** Dev-only manual override contract for the future WF-00 adapter. */
export function dispatchSlot(slotInput: unknown, settingsInput: unknown = {}): Plan {
  const slot = parseInput(slotSchema, slotInput);
  const settings = parseInput(settingsSchema, settingsInput);
  const routes: Record<string, Call[]> = {
    web_map: [call('WF-21')],
    vimeo: [call('WF-10')],
    ig_posts: [call('WF-11', 'daily', 'posts')],
    ig_reels: [call('WF-11', 'daily', 'reels')],
    youtube: [call('WF-13')],
    li_posts: [call('WF-18')],
    removal: [call('WF-40', 'removal_check')],
    li_employees: [call('WF-18b', 'weekly')],
    stories_am: [call('WF-12')],
    linker: [call('WF-32')],
    news: [call('WF-22', 'weekly'), { ...call('WF-23', 'weekly'), delayMinutes: 30 }],
    briefs: [call('WF-50', 'weekly')],
    digest: [call('WF-80')],
    health: [call('WF-91')],
    stories_pm: settings.stories_twice_daily ? [call('WF-12')] : [],
    backfill_wave: settings.backfill_enabled
      ? ['WF-10', 'WF-11', 'WF-13', 'WF-18', 'WF-21'].map((id) => call(id, 'backfill'))
      : [],
  };
  if (!Object.hasOwn(routes, slot)) {
    return { recognized: false, calls: [], auditReason: 'unknown_schedule_slot' };
  }
  return { recognized: true, calls: routes[slot]! };
}

/** Select all matching slots once for one Cairo clock minute, including Saturday's collision. */
export function scheduledSlots(timestampInput: unknown, settingsInput: unknown = {}): string[] {
  const timestamp = parseInput(timestampSchema, timestampInput);
  const settings = parseInput(settingsSchema, settingsInput);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === name)?.value;
  const hour = Number(part('hour'));
  const minute = Number(part('minute'));
  const slots = rules
    .filter(
      (rule) =>
        rule.hour === hour &&
        rule.minute === minute &&
        (!rule.weekday || rule.weekday === part('weekday')) &&
        (rule.slot !== 'stories_pm' || settings.stories_twice_daily),
    )
    .map((rule) => rule.slot);
  if (settings.backfill_enabled && minute === 0 && hour >= 10 && hour <= 23) slots.push('backfill_wave');
  return slots;
}
