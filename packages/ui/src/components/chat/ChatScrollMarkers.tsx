import React from 'react';
import type { Message, Part } from '@opencode-ai/sdk/v2';

import type { MessageListHandle } from './MessageList';
import { getEvenlySpacedMarkerOffsets, getVisibleMarkerStartIndex } from './ChatScrollMarkers.logic';
import { deriveMessageRole } from './message/messageRole';
import { cn } from '@/lib/utils';

const DOT_SIZE = 7;
const DOT_SIZE_ACTIVE = 10;
const PREVIEW_MAX_LENGTH = 80;
const TOOLTIP_SHOW_DELAY_MS = 300;
const CLICKED_MARKER_LOCK_TIMEOUT_MS = 2000;

interface ChatScrollMarkersProps {
  messages: Array<{ info: Message; parts: Part[] }>;
  messageListRef: React.RefObject<MessageListHandle | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

interface DotData {
  id: string;
  preview: string;
  index: number;
}

interface DotProps {
  dot: DotData;
  offset: number;
  isActive: boolean;
  onDotClick: (id: string) => void;
  onDotHover: (id: string | null) => void;
}

function getMessagePreview(msg: { info: Message; parts: Part[] }): string {
  for (const part of msg.parts) {
    if (part.type === 'text') {
      const text = (part as Extract<Part, { type: 'text' }>).text ?? '';
      const trimmed = text.slice(0, PREVIEW_MAX_LENGTH).trim();
      return trimmed.length < text.trim().length ? `${trimmed}...` : trimmed;
    }
  }
  return 'Attachment';
}

const DotButton: React.FC<DotProps> = React.memo(
  ({ dot, offset, isActive, onDotClick, onDotHover }) => {
    const size = isActive ? DOT_SIZE_ACTIVE : DOT_SIZE;
    const [showTooltip, setShowTooltip] = React.useState(false);
    const tooltipTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = React.useCallback(() => {
      onDotHover(dot.id);
      tooltipTimerRef.current = setTimeout(
        () => setShowTooltip(true),
        TOOLTIP_SHOW_DELAY_MS,
      );
    }, [dot.id, onDotHover]);

    const handleMouseLeave = React.useCallback(() => {
      onDotHover(null);
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current);
        tooltipTimerRef.current = null;
      }
      setShowTooltip(false);
    }, [onDotHover]);

    const handleClick = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onDotClick(dot.id);
      },
      [dot.id, onDotClick],
    );

    return (
      <button
        type="button"
        data-user-message-marker={dot.id}
        className={cn(
          'absolute left-1/2 -translate-x-1/2 -translate-y-1/2',
          'rounded-full border-0 p-0 m-0 cursor-pointer pointer-events-auto z-10',
          'transition-all duration-150 ease-out',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1',
          isActive
            ? 'bg-[var(--primary)] shadow-[0_0_6px_var(--primary)]'
            : 'bg-muted-foreground/50 hover:bg-muted-foreground hover:scale-125',
        )}
        style={{
          top: `${offset}%`,
          width: `${size}px`,
          height: `${size}px`,
        }}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={`Go to question ${dot.index + 1}: ${dot.preview}`}
      >
        {showTooltip && (
          <span
            className={cn(
              'absolute right-full mr-2 top-1/2 -translate-y-1/2',
              'whitespace-nowrap max-w-[240px] truncate',
              'px-2.5 py-1.5 rounded-md text-xs',
              'bg-popover text-popover-foreground border border-border shadow-md',
              'pointer-events-none z-50',
            )}
            role="tooltip"
          >
            {dot.preview}
          </span>
        )}
      </button>
    );
  },
);

DotButton.displayName = 'DotButton';

function scrollToMessageCenter(
  messageId: string,
  messageListHandle: MessageListHandle | null,
): void {
  messageListHandle?.scrollToMessageId(messageId, { behavior: 'smooth' });
}

export const ChatScrollMarkers: React.FC<ChatScrollMarkersProps> = ({
  messages,
  messageListRef,
  scrollContainerRef,
}) => {
  const [markerState, setMarkerState] = React.useState<{
    activeMessageId: string | null;
    firstVisibleIndex: number | null;
  }>({ activeMessageId: null, firstVisibleIndex: null });
  const [hoveredMessageId, setHoveredMessageId] = React.useState<string | null>(null);
  const [lockedMessageId, setLockedMessageId] = React.useState<string | null>(null);
  const lockTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const userMessages = React.useMemo(() => {
    return messages.filter((m) => deriveMessageRole(m.info).isUser);
  }, [messages]);

  const dots: DotData[] = React.useMemo(() => {
    return userMessages.map((msg, index) => ({
      id: String(msg.info.id),
      preview: getMessagePreview(msg),
      index,
    }));
  }, [userMessages]);

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || userMessages.length === 0) {
      setMarkerState({ activeMessageId: null, firstVisibleIndex: null });
      return;
    }

    let rafId: number | null = null;

    const updateMarkerState = () => {
      rafId = null;
      const containerRect = container.getBoundingClientRect();
      const viewportCenter = containerRect.top + containerRect.height / 2;
      let activeMessageId: string | null = null;
      let firstVisibleIndex: number | null = null;
      let closestDistance = Infinity;

      const messageElements = new Map<string, HTMLElement>();
      for (const el of container.querySelectorAll<HTMLElement>('[data-message-id]')) {
        const messageId = el.getAttribute('data-message-id');
        if (messageId) {
          messageElements.set(messageId, el);
        }
      }

      userMessages.forEach((msg, index) => {
        const messageId = String(msg.info.id);
        const el = messageElements.get(messageId);
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const isVisible = rect.bottom > containerRect.top && rect.top < containerRect.bottom;
        if (isVisible && firstVisibleIndex === null) {
          firstVisibleIndex = index;
        }

        const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          activeMessageId = messageId;
        }
      });

      setMarkerState((prev) => {
        if (prev.activeMessageId === activeMessageId && prev.firstVisibleIndex === firstVisibleIndex) {
          return prev;
        }
        return { activeMessageId, firstVisibleIndex };
      });
    };

    const scheduleMarkerStateUpdate = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(updateMarkerState);
    };

    scheduleMarkerStateUpdate();
    container.addEventListener('scroll', scheduleMarkerStateUpdate, { passive: true });

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleMarkerStateUpdate)
      : null;
    resizeObserver?.observe(container);

    const mutationObserver = typeof MutationObserver !== 'undefined'
      ? new MutationObserver(scheduleMarkerStateUpdate)
      : null;
    mutationObserver?.observe(container, { childList: true, subtree: true });

    return () => {
      container.removeEventListener('scroll', scheduleMarkerStateUpdate);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [scrollContainerRef, userMessages]);

  const handleDotClick = React.useCallback(
    (messageId: string) => {
      setLockedMessageId(messageId);
      if (lockTimerRef.current) {
        clearTimeout(lockTimerRef.current);
      }
      lockTimerRef.current = setTimeout(() => {
        lockTimerRef.current = null;
        setLockedMessageId(null);
      }, CLICKED_MARKER_LOCK_TIMEOUT_MS);
      scrollToMessageCenter(messageId, messageListRef.current);
    },
    [messageListRef],
  );

  React.useEffect(() => {
    if (!lockedMessageId || markerState.activeMessageId !== lockedMessageId) {
      return;
    }
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    setLockedMessageId(null);
  }, [lockedMessageId, markerState.activeMessageId]);

  React.useEffect(() => {
    return () => {
      if (lockTimerRef.current) {
        clearTimeout(lockTimerRef.current);
      }
    };
  }, []);

  const handleDotHover = React.useCallback((id: string | null) => {
    setHoveredMessageId(id);
  }, []);

  if (dots.length === 0) return null;

  const highlightedId = hoveredMessageId ?? lockedMessageId ?? markerState.activeMessageId;
  const startIndex = getVisibleMarkerStartIndex(dots.length, markerState.firstVisibleIndex);
  const visibleDots = dots.slice(startIndex);
  const markerOffsets = getEvenlySpacedMarkerOffsets(visibleDots.length);

  return (
    <div className="absolute right-[8px] inset-y-0 z-20 w-[22px] opacity-40 hover:opacity-85 transition-opacity duration-200 py-4 pointer-events-none">
      <div className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-border/30" aria-hidden="true" />
      <div className="relative h-full w-full">
        {visibleDots.map((dot, index) => (
          <DotButton
            key={dot.id}
            dot={dot}
            offset={markerOffsets[index] ?? 50}
            isActive={highlightedId === dot.id}
            onDotClick={handleDotClick}
            onDotHover={handleDotHover}
          />
        ))}
      </div>
    </div>
  );
};
