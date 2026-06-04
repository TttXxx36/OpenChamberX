import { describe, expect, test } from 'bun:test';

import { getCenteredScrollTop, getNaturalBubbleTop, isWithinScrollTolerance } from './MessageList.logic';

describe('getCenteredScrollTop', () => {
    test('aligns the message center with the container center', () => {
        expect(getCenteredScrollTop({
            containerTop: 100,
            containerHeight: 600,
            containerScrollTop: 1200,
            messageTop: 760,
            messageHeight: 80,
        })).toBe(1600);
    });

    test('clamps above-start targets to the top of the scroll range', () => {
        expect(getCenteredScrollTop({
            containerTop: 100,
            containerHeight: 600,
            containerScrollTop: 20,
            messageTop: 120,
            messageHeight: 80,
        })).toBe(0);
    });
});

describe('isWithinScrollTolerance', () => {
    test('treats sub-pixel center drift as settled', () => {
        expect(isWithinScrollTolerance(0.5, 1)).toBe(true);
        expect(isWithinScrollTolerance(-0.75, 1)).toBe(true);
    });

    test('keeps correcting visible center drift', () => {
        expect(isWithinScrollTolerance(12, 1)).toBe(false);
        expect(isWithinScrollTolerance(-4, 1)).toBe(false);
    });
});

describe('getNaturalBubbleTop', () => {
    test('uses the natural anchor instead of the sticky visual top', () => {
        expect(getNaturalBubbleTop({
            anchorTop: 900,
            stickyTop: 0,
            bubbleTop: 24,
        })).toBe(924);
    });

    test('preserves the bubble offset inside an unstuck sticky wrapper', () => {
        expect(getNaturalBubbleTop({
            anchorTop: 300,
            stickyTop: 300,
            bubbleTop: 330,
        })).toBe(330);
    });
});
