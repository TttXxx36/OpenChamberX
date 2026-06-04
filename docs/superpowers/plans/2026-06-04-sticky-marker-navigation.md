# Sticky Marker Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a right-rail question marker centers the clicked user question bubble/text, with the answer beginning immediately below it, in both the main Electron chat and mini chat.

**Architecture:** The bug is caused by using `getBoundingClientRect()` on a sticky user-message header. While the user question is stuck at the top of the turn, that rect describes the sticky visual position, not the message's natural document-flow position. The fix is to add stable natural anchors for user questions, calculate scroll targets from the non-sticky anchor plus bubble offset, and use that target for marker/message navigation.

**Tech Stack:** React 19, TypeScript, TanStack Virtualizer, Bun test, Vite/Electron packaging.

---

## Files

- Modify: `packages/ui/src/components/chat/components/TurnItem.tsx`
  - Add a zero-height natural anchor before the sticky user header.
  - Add a `data-sticky-user-message` marker to the sticky wrapper.
- Modify: `packages/ui/src/components/chat/ChatMessage.tsx`
  - Add a `data-user-message-bubble` marker to the actual user bubble element.
- Modify: `packages/ui/src/components/chat/MessageList.logic.ts`
  - Add pure helpers for center target math and tolerance checks.
- Modify: `packages/ui/src/components/chat/MessageList.logic.test.ts`
  - Add regression tests proving sticky visual top differs from natural bubble top.
- Modify: `packages/ui/src/components/chat/MessageList.tsx`
  - Prefer natural user-message anchors when calculating message scroll target.
  - Keep virtualizer fallback only as a coarse render step.
  - After fallback, center the natural user bubble once it is mounted.
- Modify only if active marker still flickers after natural anchor fix: `packages/ui/src/components/chat/ChatScrollMarkers.tsx`
  - Temporarily prefer clicked marker id while scroll settle is pending.

---

### Task 1: Add Geometry Regression Tests

**Files:**
- Modify: `packages/ui/src/components/chat/MessageList.logic.test.ts`
- Modify: `packages/ui/src/components/chat/MessageList.logic.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that describe the desired sticky-anchor math before implementing it:

```ts
import {
    getCenteredScrollTop,
    getNaturalBubbleTop,
    isWithinScrollTolerance,
} from './MessageList.logic';

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
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
bun test packages/ui/src/components/chat/MessageList.logic.test.ts
```

Expected: fail because `getNaturalBubbleTop` is not exported yet.

- [ ] **Step 3: Implement the helper**

Add to `MessageList.logic.ts`:

```ts
export function getNaturalBubbleTop(input: {
    anchorTop: number;
    stickyTop: number;
    bubbleTop: number;
}): number {
    return input.anchorTop + (input.bubbleTop - input.stickyTop);
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```powershell
bun test packages/ui/src/components/chat/MessageList.logic.test.ts
```

Expected: all tests in `MessageList.logic.test.ts` pass.

---

### Task 2: Add Natural User Message Anchors

**Files:**
- Modify: `packages/ui/src/components/chat/components/TurnItem.tsx`
- Modify: `packages/ui/src/components/chat/ChatMessage.tsx`

- [ ] **Step 1: Add natural turn anchor before the sticky header**

Change the sticky branch in `TurnItem.tsx` from:

```tsx
{stickyUserHeader ? (
    <div className="sticky top-0 z-20 relative bg-[var(--surface-background)] [overflow-anchor:none]">
        <div className="relative z-10">
            {renderMessage(turn.userMessage)}
        </div>
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-full z-0 h-4 bg-gradient-to-b from-[var(--surface-background)] to-transparent sm:h-8"
        />
    </div>
) : (
    renderMessage(turn.userMessage)
)}
```

to:

```tsx
{stickyUserHeader ? (
    <>
        <span data-user-message-anchor={turn.userMessage.info.id} aria-hidden="true" />
        <div
            className="sticky top-0 z-20 relative bg-[var(--surface-background)] [overflow-anchor:none]"
            data-sticky-user-message={turn.userMessage.info.id}
        >
            <div className="relative z-10">
                {renderMessage(turn.userMessage)}
            </div>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-full z-0 h-4 bg-gradient-to-b from-[var(--surface-background)] to-transparent sm:h-8"
            />
        </div>
    </>
) : (
    renderMessage(turn.userMessage)
)}
```

- [ ] **Step 2: Add a marker to the user bubble**

In `ChatMessage.tsx`, change the user bubble `<div>` around `MessageBody` from:

```tsx
<div
    style={{
        backgroundColor: 'var(--chat-user-message-bg)',
        borderRadius: userMessageRadius,
        borderBottomRightRadius: 'var(--radius-sm)',
    }}
    className="px-5 py-3 shadow-none border border-primary/5"
>
```

to:

```tsx
<div
    data-user-message-bubble={message.info.id}
    style={{
        backgroundColor: 'var(--chat-user-message-bg)',
        borderRadius: userMessageRadius,
        borderBottomRightRadius: 'var(--radius-sm)',
    }}
    className="px-5 py-3 shadow-none border border-primary/5"
>
```

- [ ] **Step 3: Run type-check**

Run:

```powershell
bun run type-check
```

Expected: all packages exit with code 0.

---

### Task 3: Use Natural Anchor For Message Centering

**Files:**
- Modify: `packages/ui/src/components/chat/MessageList.tsx`

- [ ] **Step 1: Add a safe data-attribute lookup helper**

Inside `MessageList`, near `findMessageElement`, add:

```ts
const findDataElement = React.useCallback((attribute: string, value: string): HTMLElement | null => {
    const container = resolveScrollContainer();
    if (!container) {
        return null;
    }

    for (const el of container.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
        if (el.getAttribute(attribute) === value) {
            return el;
        }
    }

    return null;
}, [resolveScrollContainer]);
```

Use this instead of `CSS.escape` so message ids containing special selector characters remain safe.

- [ ] **Step 2: Add a natural user bubble target helper**

Add a helper before `getMessageCenterTarget`:

```ts
const getNaturalUserMessageCenterTarget = React.useCallback((messageId: string) => {
    const container = resolveScrollContainer();
    if (!container) {
        return null;
    }

    const anchor = findDataElement('data-user-message-anchor', messageId);
    const sticky = findDataElement('data-sticky-user-message', messageId);
    const bubble = findDataElement('data-user-message-bubble', messageId);
    if (!anchor || !sticky || !bubble) {
        return null;
    }

    const containerRect = container.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const stickyRect = sticky.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const naturalBubbleTop = getNaturalBubbleTop({
        anchorTop: anchorRect.top,
        stickyTop: stickyRect.top,
        bubbleTop: bubbleRect.top,
    });

    const top = getCenteredScrollTop({
        containerTop: containerRect.top,
        containerHeight: containerRect.height,
        containerScrollTop: container.scrollTop,
        messageTop: naturalBubbleTop,
        messageHeight: bubbleRect.height,
    });

    return { container, top };
}, [findDataElement, resolveScrollContainer]);
```

- [ ] **Step 3: Prefer the natural target in existing centering**

Change `getMessageCenterTarget` so it first tries the natural target:

```ts
const getMessageCenterTarget = React.useCallback((messageId: string) => {
    const naturalTarget = getNaturalUserMessageCenterTarget(messageId);
    if (naturalTarget) {
        return naturalTarget;
    }

    const container = resolveScrollContainer();
    if (!container) {
        return null;
    }
    const messageElement = findMessageElement(messageId);
    if (!messageElement) {
        return null;
    }

    const containerRect = container.getBoundingClientRect();
    const messageRect = messageElement.getBoundingClientRect();
    const top = getCenteredScrollTop({
        containerTop: containerRect.top,
        containerHeight: containerRect.height,
        containerScrollTop: container.scrollTop,
        messageTop: messageRect.top,
        messageHeight: messageRect.height,
    });
    return { container, top };
}, [findMessageElement, getNaturalUserMessageCenterTarget, resolveScrollContainer]);
```

- [ ] **Step 4: Keep virtualizer fallback as coarse render only**

Do not treat `historyVirtualizer.scrollToIndex(...)` as the final anchor. Keep the current pending-center loop, but make sure it uses `getMessageCenterTarget`, which now prefers natural user anchors.

- [ ] **Step 5: Run targeted tests and type-check**

Run:

```powershell
bun test packages/ui/src/components/chat/MessageList.logic.test.ts packages/ui/src/components/chat/ChatScrollMarkers.test.ts
bun run type-check
```

Expected: tests pass and type-check exits 0.

---

### Task 4: Verify Active Marker Behavior

**Files:**
- Inspect: `packages/ui/src/components/chat/ChatScrollMarkers.tsx`
- Modify only if needed: `packages/ui/src/components/chat/ChatScrollMarkers.tsx`

- [ ] **Step 1: Test manually after Task 3 before changing active marker logic**

Run Electron dev or packaged UI, then reproduce:

1. Open a long session with multiple user questions.
2. Scroll to the bottom.
3. Click an older question marker.
4. Verify clicked user bubble/text is near viewport center.
5. Verify the answer starts immediately below that question.
6. Verify the clicked marker, not the next marker, is active after settling.

- [ ] **Step 2: Only if active marker still jumps, add click lock**

If the marker still turns blue on the next question during settle, add local lock state in `ChatScrollMarkers.tsx`:

```ts
const [lockedMessageId, setLockedMessageId] = React.useState<string | null>(null);
const lockTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
```

Change click handler:

```ts
const handleDotClick = React.useCallback(
  (messageId: string) => {
    setLockedMessageId(messageId);
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
    }
    lockTimerRef.current = setTimeout(() => {
      lockTimerRef.current = null;
      setLockedMessageId(null);
    }, 800);
    scrollToMessageCenter(messageId, messageListRef.current);
  },
  [messageListRef],
);
```

Change highlighted id:

```ts
const highlightedId = hoveredMessageId ?? lockedMessageId ?? markerState.activeMessageId;
```

Add cleanup:

```ts
React.useEffect(() => {
  return () => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
    }
  };
}, []);
```

- [ ] **Step 3: Run tests and lint**

Run:

```powershell
bun test packages/ui/src/components/chat/MessageList.logic.test.ts packages/ui/src/components/chat/ChatScrollMarkers.test.ts
bun run lint
```

Expected: tests pass and lint exits 0.

---

### Task 5: Full Verification And Commit

**Files:**
- All files changed in prior tasks.

- [ ] **Step 1: Run verification**

Run:

```powershell
bun test packages/ui/src/components/chat/MessageList.logic.test.ts packages/ui/src/components/chat/ChatScrollMarkers.test.ts
bun run type-check
bun run lint
git diff --check
```

Expected:

- Bun tests report 0 failures.
- `type-check` exits 0 for all packages.
- `lint` exits 0 for all packages.
- `git diff --check` reports no whitespace errors. Windows CRLF warnings are acceptable if no whitespace errors are shown.

- [ ] **Step 2: Commit**

Run:

```powershell
git status --short --branch
git diff --stat
git add packages/ui/src/components/chat/components/TurnItem.tsx packages/ui/src/components/chat/ChatMessage.tsx packages/ui/src/components/chat/MessageList.logic.ts packages/ui/src/components/chat/MessageList.logic.test.ts packages/ui/src/components/chat/MessageList.tsx packages/ui/src/components/chat/ChatScrollMarkers.tsx
git commit -m "fix(ui): anchor marker navigation to sticky questions"
```

Do not stage `.codegraph/` or `.superpowers/`.

- [ ] **Step 3: Push only after manual confirmation**

Run:

```powershell
git push origin main
git status --short --branch
```

Expected: local `main` matches `origin/main`, with only known untracked local directories if present.

---

## Self-Review

- Spec coverage: The plan targets the exact confirmed condition: sticky user questions in both Electron main chat and mini chat, both sharing `ChatContainer`.
- No placeholders: Each code-changing step includes concrete file paths and code snippets.
- Type consistency: `getNaturalBubbleTop`, `getCenteredScrollTop`, and `isWithinScrollTolerance` are all defined in `MessageList.logic.ts` and imported where needed.
- Risk: The `data-user-message-anchor` span is intentionally zero-height and non-interactive. If layout tests show it affects spacing, replace it with `<span style={{ position: 'relative', display: 'block', height: 0 }} ... />` and re-test.
