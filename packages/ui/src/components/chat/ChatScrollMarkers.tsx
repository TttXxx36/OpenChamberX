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
      const trimmed = text.slice(0, 50).trim();
      return trimmed.length < text.trim().length ? `${trimmed}...` : trimmed;
    }
  }
  return '\uD83D\uDCCE Attachment';
}

export const ChatScrollMarkers: React.FC<ChatScrollMarkersProps> = ({
  messages,
  messageListRef,
  scrollContainerRef,
}) => {
  const [activeMessageId, setActiveMessageId] = React.useState<string | null>(null);

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
      rafId = requestAnimationFrame(updateActiveMarker);
    };

    container.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize);
    updateActiveMarker();

    const observer = new ResizeObserver(handleScrollOrResize);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
      observer.disconnect();
    };
  }, [userMessages, scrollContainerRef]);

  if (userMessages.length === 0) return null;

  return (
    <div
      className="absolute right-0 inset-y-0 z-10 w-[14px] flex flex-col items-center justify-center gap-[5px] opacity-40 hover:opacity-100 transition-opacity duration-200 py-1 pointer-events-none"
    >
      {userMessages.map((msg) => {
        const messageId = String(msg.info.id);
        const isActive = activeMessageId === messageId;

        return (
          <button
            key={messageId}
            type="button"
            data-user-message-marker={messageId}
            title={previews.get(messageId) ?? ''}
            className={cn(
              'w-[12px] mx-auto h-[3px] rounded-full cursor-pointer border-none p-0 m-0',
              'transition-all duration-150 shrink-0 pointer-events-auto',
              isActive
                ? 'bg-[var(--primary)] h-[5px] opacity-100 shadow-sm'
                : 'bg-[var(--muted-foreground)] opacity-60 hover:opacity-80 hover:h-[5px]',
            )}
            onClick={() => messageListRef.current?.scrollToMessageId(messageId, { behavior: 'smooth' })}
            aria-label={`Go to message ${messageId}`}
          />
        );
      })}
    </div>
  );
};
