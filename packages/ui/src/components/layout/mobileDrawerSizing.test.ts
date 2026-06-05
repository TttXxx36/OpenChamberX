import { describe, expect, test } from 'bun:test';

import { getMobileDrawerTargetX, normalizeMobileDrawerWidth } from './mobileDrawerSizing';

describe('mobile drawer sizing', () => {
  test('normalizes invalid viewport widths to zero', () => {
    expect(normalizeMobileDrawerWidth(390)).toBe(390);
    expect(normalizeMobileDrawerWidth(-1)).toBe(0);
    expect(normalizeMobileDrawerWidth(Number.NaN)).toBe(0);
  });

  test('keeps open drawers at zero and closed drawers outside the viewport', () => {
    expect(getMobileDrawerTargetX({ side: 'left', width: 430, open: true })).toBe(0);
    expect(getMobileDrawerTargetX({ side: 'left', width: 430, open: false })).toBe(-430);
    expect(getMobileDrawerTargetX({ side: 'right', width: 430, open: true })).toBe(0);
    expect(getMobileDrawerTargetX({ side: 'right', width: 430, open: false })).toBe(430);
  });
});
