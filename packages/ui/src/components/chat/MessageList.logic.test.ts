import { describe, expect, test } from 'bun:test';

import { getCenteredScrollTop } from './MessageList.logic';

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
