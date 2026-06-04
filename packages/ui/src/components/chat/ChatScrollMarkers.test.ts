import { describe, expect, test } from 'bun:test';

import {
  getEvenlySpacedMarkerOffsets,
  getVisibleMarkerStartIndex,
} from './ChatScrollMarkers.logic';

describe('getVisibleMarkerStartIndex', () => {
  test('shows all markers when there are ten or fewer messages', () => {
    expect(getVisibleMarkerStartIndex(6, null)).toBe(0);
    expect(getVisibleMarkerStartIndex(10, 2)).toBe(0);
  });

  test('defaults to the latest ten markers near the bottom', () => {
    expect(getVisibleMarkerStartIndex(15, null)).toBe(5);
    expect(getVisibleMarkerStartIndex(15, 9)).toBe(5);
  });

  test('expands upward once older messages enter the viewport', () => {
    expect(getVisibleMarkerStartIndex(15, 4)).toBe(4);
    expect(getVisibleMarkerStartIndex(15, 0)).toBe(0);
  });
});

describe('getEvenlySpacedMarkerOffsets', () => {
  test('returns equal spacing across the track', () => {
    expect(getEvenlySpacedMarkerOffsets(1)).toEqual([50]);
    expect(getEvenlySpacedMarkerOffsets(3)).toEqual([0, 50, 100]);
    expect(getEvenlySpacedMarkerOffsets(5)).toEqual([0, 25, 50, 75, 100]);
  });
});
