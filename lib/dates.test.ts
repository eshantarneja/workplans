import { describe, expect, it } from 'vitest';
import { daysOver, formatMonthDay, weeklyTicks } from './dates';

describe('formatMonthDay', () => {
  it('formats ISO date as "May 4"', () => {
    expect(formatMonthDay('2026-05-04')).toBe('May 4');
  });

  it('formats single-digit and double-digit days', () => {
    expect(formatMonthDay('2026-06-30')).toBe('Jun 30');
    expect(formatMonthDay('2026-01-09')).toBe('Jan 9');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatMonthDay(null)).toBe('');
    expect(formatMonthDay(undefined)).toBe('');
  });
});

describe('daysOver', () => {
  it('returns null when target is in the future', () => {
    expect(daysOver('2026-06-30', '2026-05-26')).toBeNull();
  });

  it('returns null when target equals today', () => {
    expect(daysOver('2026-05-26', '2026-05-26')).toBeNull();
  });

  it('returns positive integer when target is past', () => {
    expect(daysOver('2026-05-20', '2026-05-26')).toBe(6);
  });

  it('returns null when target is null', () => {
    expect(daysOver(null, '2026-05-26')).toBeNull();
  });
});

describe('weeklyTicks', () => {
  it('returns weekly ticks anchored to the start date', () => {
    const ticks = weeklyTicks('2026-04-20', '2026-05-11');
    expect(ticks).toEqual(['2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11']);
  });

  it('always includes the start and at least covers up to end', () => {
    const ticks = weeklyTicks('2026-04-20', '2026-04-23');
    expect(ticks[0]).toBe('2026-04-20');
    expect(ticks[ticks.length - 1] >= '2026-04-23').toBe(true);
  });
});
