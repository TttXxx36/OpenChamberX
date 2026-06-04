# Chat Right Rail Scrollbar Design

## Goal

Replace the current chat native-scrollbar experiment with a unified right rail that combines the existing overlay scrollbar behavior with the question-dot timeline.

The final result should feel like one deliberate control surface instead of two unrelated right-edge decorations.

## Selected Direction

Use Scheme C from the visual companion: a unified right rail.

- Native chat scrollbars are hidden again through the existing overlay target CSS path.
- `OverlayScrollbar` remains the source of the draggable scroll thumb.
- `ChatScrollMarkers` remains the source of question dots and click-to-question navigation.
- The two visuals are aligned into a shared rail: dots on the central question line, scroll thumb as a slim adjacent accent.

## Behavior

### Native Scrollbar

- Chat scroll container should not reserve native scrollbar gutter.
- Chat scroll container should use `.overlay-scrollbar-target` to hide native scrollbars across supported browsers.
- Remove chat-specific rules that force visible native scrollbar thumbs or `scrollbar-gutter: stable both-edges`.
- Non-chat scroll areas should keep their existing behavior.

### Overlay Scroll Thumb

- The overlay vertical thumb should render for chat again.
- No `useNativeScrollbar` branch is needed for the chat path.
- The thumb remains interactive and draggable.
- Visibility should stay close to the existing behavior: show on user scroll/drag/hover, hide after delay, and respect `suppressVisibility` while programmatic follow is active.
- For chat, the thumb should be visually slimmer and positioned to harmonize with the marker rail.

### Question Markers

- Keep the current marker behavior: default latest 10 user questions, expand upward when older questions enter the viewport.
- Keep even spacing for the currently shown marker set.
- Keep active marker highlighting.
- Position the marker line and dots so they do not overlap the overlay thumb's pointer target.

## Proposed Implementation

### `packages/ui/src/index.css`

- Remove or neutralize chat-specific native scrollbar visibility rules:
  - `[data-scrollbar="chat"].chat-scroll, .chat-scroll { scrollbar-gutter: stable both-edges; }`
  - chat-specific `::-webkit-scrollbar` width/thumb rules that force visible native scrollbars.
- Keep global scrollbar rules for non-overlay targets.
- Keep `.overlay-scrollbar-target` hiding rules.
- Add a chat-specific overlay class if needed, for example `.overlay-scrollbar--chat-rail`, to style the vertical thumb as a slim rail accent without changing all overlay scrollbars.

### `packages/ui/src/components/ui/OverlayScrollbar.tsx`

- Do not add or keep `useNativeScrollbar` logic for chat.
- Optionally allow `className` to drive chat-specific styling, using the existing `className` prop.
- Keep hooks unconditional and existing drag logic intact.

### `packages/ui/src/components/chat/ChatContainer.tsx`

- Keep `ScrollShadow` className as `chat-scroll overlay-scrollbar-target`.
- Pass a chat-specific className to `OverlayScrollbar`, for example `className="overlay-scrollbar--chat-rail"`.
- Keep `ChatScrollMarkers` rendered above the scroll container.

### `packages/ui/src/components/chat/ChatScrollMarkers.tsx`

- Adjust only rail placement and width if needed.
- Preserve marker selection and click behavior.
- Avoid merging scrollbar drag behavior into marker code.

## Risks

- If the overlay thumb and marker dots overlap, users may accidentally click markers while trying to drag the scrollbar. The rail must keep separate hit areas.
- If native scrollbar CSS is not fully removed for chat, Chrome/WebKit may show both native and overlay thumbs.
- If `observeMutations={false}` remains on chat overlay, thumb metrics rely on scroll/content events. This is already current behavior; only change it if manual testing shows stale thumb metrics.

## Validation

- Run `bun run type-check`.
- Run `bun run lint`.
- Manually verify chat scroll behavior:
  - native scrollbar is hidden;
  - overlay thumb appears during wheel/touch/keyboard scroll;
  - overlay thumb can be dragged;
  - marker dots remain clickable;
  - marker dots and thumb do not visually collide;
  - programmatic follow does not leave a stuck thumb visible.
