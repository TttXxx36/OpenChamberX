# Chat Right Rail Scrollbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore hidden native chat scrollbars and render a unified right rail where the overlay scrollbar thumb visually pairs with question markers.

**Architecture:** Keep responsibilities separate: CSS hides native scrollbars and styles the chat-specific overlay thumb, `OverlayScrollbar` keeps scroll metrics and dragging, `ChatScrollMarkers` keeps question navigation. `ChatContainer` composes both layers with coordinated classes.

**Tech Stack:** React, TypeScript, Tailwind utility classes, project CSS variables, Bun validation scripts.

---

### Task 1: Restore chat overlay scrollbar CSS

**Files:**
- Modify: `packages/ui/src/index.css`

- [ ] **Step 1: Remove chat native scrollbar forcing rules**

Delete the chat-specific block that reserves native gutter and forces visible `::-webkit-scrollbar` thumbs for `.chat-scroll` / `[data-scrollbar="chat"]`. Keep the global scrollbar styles and the `.overlay-scrollbar-target` hiding rules.

- [ ] **Step 2: Add chat rail overlay styling**

Add this CSS near the existing overlay scrollbar styles:

```css
.overlay-scrollbar--chat-rail .overlay-scrollbar__thumb--vertical {
  right: 6px !important;
  width: 4px;
  background: color-mix(in srgb, var(--primary-base, var(--primary)) 58%, var(--oc-scrollbar-thumb));
  opacity: 0.65;
}

.overlay-scrollbar--chat-rail .overlay-scrollbar__thumb--vertical:hover,
.overlay-scrollbar--chat-rail .overlay-scrollbar__thumb--vertical:active {
  width: 6px;
  opacity: 0.95;
  background: color-mix(in srgb, var(--primary-base, var(--primary)) 72%, var(--oc-scrollbar-thumb-hover));
}
```

### Task 2: Compose chat overlay and markers into one rail

**Files:**
- Modify: `packages/ui/src/components/chat/ChatContainer.tsx`
- Modify: `packages/ui/src/components/chat/ChatScrollMarkers.tsx`

- [ ] **Step 1: Pass a chat-specific class to `OverlayScrollbar`**

Change the chat `OverlayScrollbar` call to include `className="overlay-scrollbar--chat-rail"`.

- [ ] **Step 2: Move marker line inward enough to avoid scrollbar drag collisions**

Adjust `ChatScrollMarkers` container from the current right offset to a slightly wider right rail. Keep marker behavior and click handling unchanged.

### Task 3: Verify

**Files:**
- No production files beyond Tasks 1-2.

- [ ] **Step 1: Run existing marker tests**

Run: `bun test "packages/ui/src/components/chat/ChatScrollMarkers.test.ts"`

Expected: all tests pass.

- [ ] **Step 2: Run full type check**

Run: `bun run type-check`

Expected: all packages exit with code 0.

- [ ] **Step 3: Run full lint**

Run: `bun run lint`

Expected: all packages exit with code 0.

- [ ] **Step 4: Manual browser check**

Verify in chat: native scrollbar hidden, overlay thumb appears and drags, question dots still click, thumb and dots do not overlap.
