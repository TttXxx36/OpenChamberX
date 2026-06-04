const DEFAULT_VISIBLE_MARKER_COUNT = 10;

export function getVisibleMarkerStartIndex(totalMarkers: number, firstVisibleIndex: number | null): number {
  if (totalMarkers <= DEFAULT_VISIBLE_MARKER_COUNT) {
    return 0;
  }

  const latestStartIndex = totalMarkers - DEFAULT_VISIBLE_MARKER_COUNT;
  if (firstVisibleIndex === null) {
    return latestStartIndex;
  }

  const boundedFirstVisibleIndex = Math.max(0, Math.min(totalMarkers - 1, Math.floor(firstVisibleIndex)));
  return Math.min(latestStartIndex, boundedFirstVisibleIndex);
}

export function getEvenlySpacedMarkerOffsets(markerCount: number): number[] {
  if (markerCount <= 0) {
    return [];
  }

  if (markerCount === 1) {
    return [50];
  }

  return Array.from({ length: markerCount }, (_, index) => (index / (markerCount - 1)) * 100);
}
