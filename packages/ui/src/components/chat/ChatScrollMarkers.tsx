import React from 'react';
import type { Message, Part } from '@opencode-ai/sdk/v2';

import type { MessageListHandle } from './MessageList';
import { deriveMessageRole } from './message/messageRole';
import { cn } from '@/lib/utils';

const DOT_SIZE = 7;
const DOT_SIZE_ACTIVE = 10;
const RAIL_WIDTH = 20;
const RAIL_RIGHT_OFFSET = 26;
const PREVIEW_MAX_LENGTH = 80;
const OBSERVE_THROTTLE_MS = 100;
const TOOLTIP_SHOW_DELAY_MS = 300;
const RAIL_PADDING_Y = 16;

interface ChatScrollMarkersProps {
  messages: Array<{ info: Message; parts: Part[] }>;
  messageListRef: React.RefObject<MessageListHandle | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

function getMessagePreview(msg: { info: Message; parts: Part[] }): string {
  for (const part of msg.parts) {
    if (part.type === 'text') {
      const text = (part as Extract<Part, { type: 'text' }>).text ?? '';
      const trimmed = text.slice(0, PREVIEW_MAX_LENGTH).trim();
      return trimmed.length < text.trim().length ? `${trimmed}\u2026` : trimmed;
    }
  }
  return '\uD83D\uDCCE Attachment';
}

interface DotData {
  id: string;
  preview: string;
  index: number;
}

interface DotProps {
  dot: DotData;
  topPx: number;
  trackHeight: number;
  isActive: boolean;
  onDotClick: (id: string) => void;
  onDotHover: (id: string | null) => void;
}

const DotButton: React.FC<DotProps> = React.memo(
  ({ dot, topPx, trackHeight, isActive, onDotClick, onDotHover }) => {
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

    const clampedTop = Math.max(0, Math.min(topPx, trackHeight));

    return (
      <button
        type="button"
        data-user-message-marker={dot.id}
        className={cn(
          'absolute left-1/2 -translate-x-1/2 -translate-y-1/2',
          'rounded-full border-0 p-0 m-0 cursor-pointer z-10',
          'transition-all duration-150 ease-out',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1',
          isActive
            ? 'bg-[var(--primary)] shadow-[0_0_6px_var(--primary)]'
            : 'bg-muted-foreground/50 hover:bg-muted-foreground hover:scale-125',
        )}
        style={{
          top: `${clampedTop}px`,
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
  container: HTMLDivElement | null,
  messageListHandle: MessageListHandle | null,
): void {
  if (container) {
    const el = container.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
  }
  messageListHandle?.scrollToMessageId(messageId, { behavior: 'smooth' });
}

export const ChatScrollMarkers: React.FC<ChatScrollMarkersProps> = ({
  messages,
  messageListRef,
  scrollContainerRef,
}) => {
  const [activeMessageId, setActiveMessageId] = React.useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = React.useState<string | null>(null);
  const [dotPositions, setDotPositions] = React.useState<Map<string, number>>(new Map());
  const [trackHeight, setTrackHeight] = React.useState(0);
  const railRef = React.useRef<HTMLDivElement>(null);

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

  const recalcRef = React.useRef<{
    rafId: number;
    lastFireTime: number;
  }>({ rafId: 0, lastFireTime: 0 });

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || dots.length === 0) {
      setDotPositions(new Map());
      setTrackHeight(0);
      return;
    }

    const recalc = () => {
      const { scrollHeight, clientHeight } = container;
      if (scrollHeight <= clientHeight) {
        setDotPositions(new Map());
        setTrackHeight(0);
        return;
      }

      const railEl = railRef.current;
      const railHeight = railEl ? railEl.clientHeight : clientHeight;
      setTrackHeight(railHeight);

      const usableHeight = Math.max(railHeight - RAIL_PADDING_Y * 2, 0);

      const positions = new Map<string, number>();
      for (const dot of dots) {
        const el = container.querySelector(`[data-message-id="${dot.id}"]`) as HTMLElement | null;
        if (!el) continue;

        const elTop = el.offsetTop;
        const ratio = elTop / scrollHeight;
        const pixelY = RAIL_PADDING_Y + ratio * usableHeight;
        positions.set(dot.id, pixelY);
      }
      setDotPositions(positions);
    };

    const throttledRecalc = () => {
      const now = Date.now();
      if (now - recalcRef.current.lastFireTime < OBSERVE_THROTTLE_MS) {
        if (!recalcRef.current.rafId) {
          recalcRef.current.rafId = requestAnimationFrame(() => {
            recalcRef.current.rafId = 0;
            recalcRef.current.lastFireTime = Date.now();
            recalc();
          });
        }
        return;
      }
      recalcRef.current.lastFireTime = Date.now();
      recalc();
    };

    recalc();
    container.addEventListener('scroll', throttledRecalc, { passive: true });

    const resizeObserver = new ResizeObserver(throttledRecalc);
    resizeObserver.observe(container);

    const mutationObserver = new MutationObserver(throttledRecalc);
    mutationObserver.observe(container, { childList: true, subtree: true });

    const currentRafId = recalcRef.current.rafId;
    return () => {
      cancelAnimationFrame(currentRafId);
      container.removeEventListener('scroll', throttledRecalc);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [dots, scrollContainerRef]);

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || dots.length === 0) return;

    let rafId: number;

    const updateActive = () => {
      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;
      let closestId: string | null = null;
      let closestDist = Infinity;

      for (const dot of dots) {
        const el = container.querySelector(`[data-message-id="${dot.id}"]`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const elCenter = rect.top + rect.height / 2;
        const dist = Math.abs(elCenter - centerY);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = dot.id;
        }
      }
      setActiveMessageId(closestId);
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateActive);
    };

    updateActive();
    container.addEventListener('scroll', scheduleUpdate, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', scheduleUpdate);
    };
  }, [dots, scrollContainerRef]);

  const handleDotClick = React.useCallback(
    (messageId: string) => {
      scrollToMessageCenter(messageId, scrollContainerRef.current, messageListRef.current);
    },
    [scrollContainerRef, messageListRef],
  );

  const handleDotHover = React.useCallback((id: string | null) => {
    setHoveredMessageId(id);
  }, []);

  if (dots.length === 0) return null;

  const highlightedId = hoveredMessageId ?? activeMessageId;

  return (
    <div
      ref={railRef}
      className={cn(
        'absolute inset-y-0 z-20 pointer-events-none',
      )}
      style={{
        right: `${RAIL_RIGHT_OFFSET}px`,
        width: `${RAIL_WIDTH}px`,
      }}
      aria-hidden="true"
    >
      {/* Vertical track line */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-px bg-border/30 rounded-full pointer-events-none"
        style={{ top: `${RAIL_PADDING_Y}px`, bottom: `${RAIL_PADDING_Y}px` }}
      />

      {/* Dot container */}
      <div className="relative w-full h-full pointer-events-auto">
        {dots.map((dot) => {
          const topPx = dotPositions.get(dot.id);
          if (topPx === undefined) return null;
          return (
            <DotButton
              key={dot.id}
              dot={dot}
              topPx={topPx}
              trackHeight={trackHeight}
              isActive={highlightedId === dot.id}
              onDotClick={handleDotClick}
              onDotHover={handleDotHover}
            />
          );
        })}
      </div>
    </div>
  );
};
