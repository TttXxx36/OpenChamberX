import React from 'react';
import type { Message } from '@opencode-ai/sdk/v2';

import type { MessageListHandle } from './MessageList';
import { deriveMessageRole } from './message/messageRole';
import { cn } from '@/lib/utils';

interface ChatScrollMarkersProps {
  messages: Array<{ info: Message; parts: unknown[] }>;
  messageListRef: React.RefObject<MessageListHandle | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

const MARKER_HEIGHT_PX = 2;
const MARKER_GAP_MIN_PX = 4;

export const ChatScrollMarkers: React.FC<ChatScrollMarkersProps> = ({
  messages,
  messageListRef,
  scrollContainerRef,
}) => {
  const [activeMessageId, setActiveMessageId] = React.useState<string | null>(null);
  const [markerPositions, setMarkerPositions] = React.useState<Map<string, number>>(new Map());

  const userMessages = React.useMemo(() => {
    return messages.filter((m) => deriveMessageRole(m.info).isUser);
  }, [messages]);

  const recalcPositions = React.useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || userMessages.length === 0) {
      setMarkerPositions(new Map());
      return;
    }

    const { scrollHeight, clientHeight } = container;
    const trackHeight = clientHeight;
    const positions = new Map<string, number>();

    userMessages.forEach((msg, i) => {
      const el = container.querySelector(`[data-message-id="${msg.info.id}"]`);
      if (el) {
        const elOffsetTop = (el as HTMLElement).offsetTop;
        const ratio = scrollHeight > 0 ? elOffsetTop / scrollHeight : 0;
        const top = Math.max(0, Math.min(1, ratio)) * (trackHeight - MARKER_HEIGHT_PX);
        const clamped = Math.max(
          i * MARKER_HEIGHT_PX + i * MARKER_GAP_MIN_PX,
          Math.min(
            top,
            trackHeight - MARKER_HEIGHT_PX - (userMessages.length - 1 - i) * (MARKER_HEIGHT_PX + MARKER_GAP_MIN_PX),
          ),
        );
        positions.set(String(msg.info.id), clamped);
      }
    });

    setMarkerPositions(positions);
  }, [userMessages, scrollContainerRef]);

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || userMessages.length === 0) return;

    let rafId: number;
    let prevActiveId: string | null = null;

    const updateActiveMarker = () => {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 2;
      let closestId: string | null = null;
      let closestDistance = Infinity;

      for (const msg of userMessages) {
        const el = container.querySelector(`[data-message-id="${msg.info.id}"]`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const elCenter = rect.top + rect.height / 2;
        const dist = Math.abs(elCenter - containerCenter);
        if (dist < closestDistance) {
          closestDistance = dist;
          closestId = String(msg.info.id);
        }
      }

      if (closestId !== prevActiveId) {
        prevActiveId = closestId;
        setActiveMessageId(closestId);
      }
    };

    const handleScrollOrResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        recalcPositions();
        updateActiveMarker();
      });
    };

    container.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize);
    recalcPositions();
    updateActiveMarker();

    const observer = new ResizeObserver(handleScrollOrResize);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
      observer.disconnect();
    };
  }, [userMessages, scrollContainerRef, recalcPositions]);

  if (userMessages.length === 0) return null;

  return (
    <div
      className="absolute right-0 top-0 bottom-0 z-10 w-[14px] opacity-40 hover:opacity-100 transition-opacity duration-200"
    >
      {userMessages.map((msg) => {
        const messageId = String(msg.info.id);
        const isActive = activeMessageId === messageId;
        const top = markerPositions.get(messageId);

        if (top === undefined) return null;

        return (
          <button
            key={messageId}
            type="button"
            data-user-message-marker={messageId}
            className={cn(
              'absolute left-1 right-1 h-[2px] rounded-[1px] cursor-pointer border-none p-0 m-0',
              'transition-all duration-150',
              isActive
                ? 'bg-[var(--primary)] h-[3px] opacity-90'
                : 'bg-[var(--muted-foreground)] opacity-40 hover:opacity-80 hover:h-[3px]',
            )}
            style={{ top: `${top}px` }}
            onClick={() => messageListRef.current?.scrollToMessageId(messageId, { behavior: 'smooth' })}
            aria-label={`Go to message ${messageId}`}
          />
        );
      })}
    </div>
  );
};
