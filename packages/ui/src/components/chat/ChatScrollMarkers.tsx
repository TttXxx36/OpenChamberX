import React from 'react';
import type { Message, Part } from '@opencode-ai/sdk/v2';

import type { MessageListHandle } from './MessageList';
import { deriveMessageRole } from './message/messageRole';
import { cn } from '@/lib/utils';

interface ChatScrollMarkersProps {
  messages: Array<{ info: Message; parts: Part[] }>;
  messageListRef: React.RefObject<MessageListHandle | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

function getMessagePreview(msg: { info: Message; parts: Part[] }): string {
  for (const part of msg.parts) {
    if (part.type === 'text') {
      const text = (part as Extract<Part, { type: 'text' }>).text ?? '';
      const trimmed = text.slice(0, 80).trim();
      return trimmed.length < text.trim().length ? `${trimmed}...` : trimmed;
    }
  }
  return '\uD83D\uDCCE Attachment';
}

interface DotProps {
  messageId: string;
  topPct: number;
  isActive: boolean;
  preview: string;
  onDotClick: (messageId: string) => void;
}

const DotButton: React.FC<DotProps> = React.memo(({ messageId, topPct, isActive, preview, onDotClick }) => {
  return (
    <button
      type="button"
      data-user-message-marker={messageId}
      title={preview}
      className={cn(
        'absolute left-1/2 -translate-x-1/2 -translate-y-1/2',
        'w-[7px] h-[7px] rounded-full border-0 p-0 m-0 cursor-pointer',
        'transition-all duration-150 ease-out z-10',
        isActive
          ? 'bg-[var(--primary)] shadow-sm scale-125'
          : 'bg-[var(--muted-foreground)] opacity-60 hover:opacity-100 hover:scale-110',
      )}
      style={{ top: `${topPct}%` }}
      onClick={() => onDotClick(messageId)}
      aria-label={`Go to message ${messageId}`}
    />
  );
});

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
  const [dotPositions, setDotPositions] = React.useState<Map<string, number>>(new Map());

  const userMessages = React.useMemo(() => {
    return messages.filter((m) => deriveMessageRole(m.info).isUser);
  }, [messages]);

  const previews = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const msg of userMessages) {
      map.set(String(msg.info.id), getMessagePreview(msg));
    }
    return map;
  }, [userMessages]);

  /* Recalculate dot positions on scroll / resize */
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || userMessages.length === 0) return;

    let rafId: number;
    let resizeObserver: ResizeObserver | null = null;

    const recalc = () => {
      const { scrollHeight, clientHeight } = container;
      const scrollable = scrollHeight - clientHeight;
      if (scrollable <= 0) return;

      const positions = new Map<string, number>();
      for (const msg of userMessages) {
        const el = container.querySelector(`[data-message-id="${msg.info.id}"]`);
        if (!el) continue;
        const pct = ((el as HTMLElement).offsetTop / scrollable) * 100;
        positions.set(String(msg.info.id), Math.min(100, Math.max(0, pct)));
      }
      setDotPositions(positions);
    };

    const scheduleRecalc = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(recalc);
    };

    recalc();
    container.addEventListener('scroll', scheduleRecalc, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleRecalc);
      resizeObserver.observe(container);
    }

    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', scheduleRecalc);
      resizeObserver?.disconnect();
    };
  }, [userMessages, scrollContainerRef]);

  /* Track which user message is closest to viewport center */
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || userMessages.length === 0) return;

    let rafId: number;

    const updateActive = () => {
      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;
      let closestId: string | null = null;
      let closestDist = Infinity;

      for (const msg of userMessages) {
        const el = container.querySelector(`[data-message-id="${msg.info.id}"]`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const elCenter = rect.top + rect.height / 2;
        const dist = Math.abs(elCenter - centerY);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = String(msg.info.id);
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
  }, [userMessages, scrollContainerRef]);

  const handleDotClick = React.useCallback(
    (messageId: string) => {
      scrollToMessageCenter(messageId, scrollContainerRef.current, messageListRef.current);
    },
    [scrollContainerRef, messageListRef],
  );

  if (userMessages.length === 0) return null;

  return (
    <div
      className="absolute right-[26px] inset-y-0 z-20 w-[14px] pointer-events-none"
      aria-hidden="true"
    >
      {/* Vertical track line */}
      <div className="absolute inset-y-4 left-1/2 -translate-x-1/2 w-[1px] bg-border/30 rounded-full pointer-events-none" />

      {/* Dots */}
      <div className="relative w-full h-full pointer-events-none">
        {userMessages.map((msg) => {
          const messageId = String(msg.info.id);
          const topPct = dotPositions.get(messageId);
          if (topPct === undefined) return null;
          return (
            <DotButton
              key={messageId}
              messageId={messageId}
              topPct={topPct}
              isActive={activeMessageId === messageId}
              preview={previews.get(messageId) ?? ''}
              onDotClick={handleDotClick}
            />
          );
        })}
      </div>
    </div>
  );
};
