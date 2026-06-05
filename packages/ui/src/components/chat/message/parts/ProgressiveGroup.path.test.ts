import { describe, expect, test } from 'bun:test';

import { resolveToolFilePathForOpen, selectToolFilePathForOpen } from './ProgressiveGroup.path';

describe('resolveToolFilePathForOpen', () => {
    test('resolves workspace-prefixed read tool paths without duplicating the workspace name', () => {
        expect(resolveToolFilePathForOpen(
            'D:/Documents/Opencode/OpenChamberX',
            'OpenChamberX/packages/ui/src/components/chat/ChatMessage.tsx',
        )).toBe('D:/Documents/Opencode/OpenChamberX/packages/ui/src/components/chat/ChatMessage.tsx');
    });

    test('preserves normal relative read tool paths', () => {
        expect(resolveToolFilePathForOpen(
            'D:/Documents/Opencode/OpenChamberX',
            'packages/ui/src/components/chat/ChatMessage.tsx',
        )).toBe('D:/Documents/Opencode/OpenChamberX/packages/ui/src/components/chat/ChatMessage.tsx');
    });

    test('preserves Windows absolute read tool paths', () => {
        expect(resolveToolFilePathForOpen(
            'D:/Documents/Opencode/OpenChamberX',
            'D:/Documents/Opencode/OpenChamberX/packages/ui/src/components/chat/ChatMessage.tsx',
        )).toBe('D:/Documents/Opencode/OpenChamberX/packages/ui/src/components/chat/ChatMessage.tsx');
    });

    test('uses the existing primary path when a nested same-name directory really exists', async () => {
        const primary = 'D:/Documents/Opencode/OpenChamberX/OpenChamberX/src/index.ts';
        const fallback = 'D:/Documents/Opencode/OpenChamberX/src/index.ts';
        const seen: string[] = [];

        const selected = await selectToolFilePathForOpen(
            'D:/Documents/Opencode/OpenChamberX',
            'OpenChamberX/src/index.ts',
            async (path) => {
                seen.push(path);
                return { isFile: path === primary };
            },
        );

        expect(selected).toBe(primary);
        expect(seen).toEqual([primary]);
        expect(selected).not.toBe(fallback);
    });
});
