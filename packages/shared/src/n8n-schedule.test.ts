import { describe, expect, it } from 'vitest';
import { dispatchSlot, scheduledSlots } from './n8n-schedule';

describe('M03 local schedule contract (no workflow execution)', () => {
  it.each([
    ['web_map', 'WF-21'],
    ['vimeo', 'WF-10'],
    ['ig_posts', 'WF-11'],
    ['ig_reels', 'WF-11'],
    ['youtube', 'WF-13'],
    ['li_posts', 'WF-18'],
    ['removal', 'WF-40'],
    ['li_employees', 'WF-18b'],
    ['stories_am', 'WF-12'],
    ['linker', 'WF-32'],
    ['briefs', 'WF-50'],
    ['digest', 'WF-80'],
    ['health', 'WF-91'],
  ])('routes %s to %s with dev-only inputs', (slot, workflow) => {
    const result = dispatchSlot(slot);
    expect(result.recognized).toBe(true);
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]).toMatchObject({ workflow, input: { env: 'dev' } });
  });

  it('separates Instagram post/reel inputs and weekly/removal modes', () => {
    expect(dispatchSlot('ig_posts').calls[0]?.input.result_type).toBe('posts');
    expect(dispatchSlot('ig_reels').calls[0]?.input.result_type).toBe('reels');
    expect(dispatchSlot('removal').calls[0]?.input.mode).toBe('removal_check');
    expect(dispatchSlot('briefs').calls[0]?.input.mode).toBe('weekly');
  });

  it('plans awards thirty minutes after news rather than calling both immediately', () => {
    expect(dispatchSlot('news').calls.map(({ workflow, delayMinutes }) => [workflow, delayMinutes])).toEqual([
      ['WF-22', 0],
      ['WF-23', 30],
    ]);
  });

  it('keeps optional PM stories and backfill disabled unless explicitly true', () => {
    expect(dispatchSlot('stories_pm').calls).toEqual([]);
    expect(dispatchSlot('backfill_wave').calls).toEqual([]);
    expect(dispatchSlot('stories_pm', { stories_twice_daily: true }).calls[0]?.workflow).toBe('WF-12');
    expect(dispatchSlot('backfill_wave', { backfill_enabled: true }).calls.map((call) => call.input)).toEqual(
      Array.from({ length: 5 }, () => ({ env: 'dev', mode: 'backfill', limit: 10 })),
    );
    expect(() => dispatchSlot('backfill_wave', { backfill_enabled: 'true' })).toThrow();
  });

  it('returns a fixed audit reason and no calls for an unknown override', () => {
    expect(dispatchSlot('untrusted-secret-value')).toEqual({
      recognized: false,
      calls: [],
      auditReason: 'unknown_schedule_slot',
    });
  });

  it('does not echo untrusted setting keys in validation errors', () => {
    const settings = { 'synthetic-private-field-name': true };
    expect(() => dispatchSlot('health', settings)).toThrowError('Invalid schedule input');
    expect(() => scheduledSlots('2026-10-18T00:30:00Z', settings)).toThrowError('Invalid schedule input');
  });

  it('uses Cairo summer and winter offsets instead of the host timezone', () => {
    expect(scheduledSlots('2026-10-18T00:30:00Z')).toEqual(['youtube']);
    expect(scheduledSlots('2026-12-20T01:30:00Z')).toEqual(['youtube']);
    expect(scheduledSlots('2026-10-18T00:31:00Z')).toEqual([]);
    expect(() => scheduledSlots('2026-10-18T03:30:00')).toThrow();
  });

  it('keeps both Saturday 04:00 slots in one clock dispatch, without duplicate trigger rules', () => {
    expect(scheduledSlots('2026-10-17T01:00:00Z')).toEqual(['li_posts', 'removal']);
    expect(scheduledSlots('2026-10-18T02:00:00Z')).toEqual(['li_employees']);
    expect(scheduledSlots('2026-10-19T05:00:00Z')).toEqual(['briefs']);
  });

  it('bounds backfill hours and respects both feature gates during clock selection', () => {
    const settings = { backfill_enabled: true, stories_twice_daily: true };
    expect(scheduledSlots('2026-10-18T06:00:00Z', settings)).toEqual(['digest']);
    expect(scheduledSlots('2026-10-18T07:00:00Z', settings)).toEqual(['backfill_wave']);
    expect(scheduledSlots('2026-10-18T20:00:00Z', settings)).toEqual(['backfill_wave']);
    expect(scheduledSlots('2026-10-18T21:00:00Z', settings)).toEqual([]);
    expect(scheduledSlots('2026-10-18T15:00:00Z')).toEqual([]);
    expect(scheduledSlots('2026-10-18T15:00:00Z', settings)).toEqual(['stories_pm', 'backfill_wave']);
  });
});
