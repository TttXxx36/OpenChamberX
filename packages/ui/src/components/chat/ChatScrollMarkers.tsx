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

interface MarkerButtonProps {
  messageId: string;
  isActive: boolean;
  preview: string;
  onClick: (messageId: string) => void;
}

const MarkerButton: React.FC<MarkerButtonProps> = React.memo(({ messageId, isActive, preview, onClick }) => {
  return (
    <button
      type="button"
      data-user-message-marker={messageId}
      title={preview}
      className={cn(
        'w-[16px] mx-auto h-[3px] rounded-full cursor-pointer border-none p-0 m-0 shrink-0',
        'transition-all duration-150',
        'pointer-events-auto',
        isActive
          ? 'bg-[var(--primary)] h-[5px] opacity-100 shadow-sm'
          : 'bg-[var(--muted-foreground)] opacity-60 hover:opacity-80 hover:h-[4px]',
      )}
      onClick={() => onClick(messageId)}
      aria-label={`Go to message ${messageId}`}
    />
  );
});

MarkerButton.displayName = 'MarkerButton';

function scrollToMessage(
  messageId: string,
  container: HTMLDivElement | null,
  messageListHandle: MessageListHandle | null,
): void {
  if (container) {
    const el = container.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  /* Track which user message is closest to the viewport center using IntersectionObserver */
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || userMessages.length === 0) return;

    const messageIds = userMessages.map((m) => String(m.info.id));
    const visibleRatios = new Map<string, number>();
    let rafId: number;

    const updateActive = () => {
      let closestId: string | null = null;
      let closestDist = Infinity;
      for (const [id, ratio] of visibleRatios) {
        const dist = Math.abs(ratio - 0.5);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = id;
        }
      }
      setActiveMessageId(closestId);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        cancelAnimationFrame(rafId);
        for (const entry of entries) {
          const id = entry.target.getAttribute('data-message-id');
          if (!id) continue;
          const visible = entry.intersectionRect.height > 0 || entry.isIntersecting;
          visibleRatios.set(id, visible ? entry.intersectionRatio : 0);
        }
        rafId = requestAnimationFrame(updateActive);
      },
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    const elements: Element[] = [];
    for (const msg of userMessages) {
      const el = container.querySelector(`[data-message-id="${msg.info.id}"]`);
      if (el) {
        observer.observe(el);
        elements.push(el);
      }
    }

    return () => {
      cancelAnimationFrame(rafId);
      for (const el of elements) observer.unobserve(el);
      observer.disconnect();
    };
  }, [userMessages, scrollContainerRef]);

  const handleMarkerClick = React.useCallback(
    (messageId: string) => {
      scrollToMessage(messageId, scrollContainerRef.current, messageListRef.current);
    },
    [scrollContainerRef, messageListRef],
  );

  if (userMessages.length === 0) return null;

  return (
    <div
      className="absolute right-[18px] inset-y-0 z-20 w-[20px] flex flex-col items-center justify-center gap-[5px] opacity-30 hover:opacity-80 transition-opacity duration-200 py-1 pointer-events-none"
    >
      {userMessages.map((msg) => {
        const messageId = String(msg.info.id);
        return (
          <MarkerButton
            key={messageId}
            messageId={messageId}
            isActive={activeMessageId === messageId}
            preview={previews.get(messageId) ?? ''}
            onClick={handleMarkerClick}
          />
        );
      })}
    </div>
  );
};
