import { h, VNode } from 'preact';
import { useMemo } from 'preact/hooks';
import { marked } from 'marked';
import { CheckCircleIcon, XCircleIcon, LoaderIcon } from './Icons';

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true,
});

export function UserMessageBubble({
  text,
  images,
  timestamp,
  status,
}: {
  text: string;
  images?: string[];
  timestamp: number;
  status: 'sending' | 'sent' | 'error';
}): VNode {
  const timeStr = useMemo(() => {
    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }, [timestamp]);

  return (
    <div class="user-bubble-row">
      <div class={`user-bubble ${status}`}>
        {images && images.length > 0 && (
          <div class="flex flex-wrap gap-2 mb-2">
            {images.map((img, idx) => (
              <img key={idx} src={img} style="max-height: 120px; border-radius: 8px;" alt="attachment" />
            ))}
          </div>
        )}
        <div class="selectable" style="white-space: pre-wrap;">{text}</div>
        <div class="user-bubble-time flex items-center justify-end gap-1">
          {status === 'sending' && <LoaderIcon size={10} />}
          {status === 'error' && <span style="color: #ffc4c4;">发送失败</span>}
          <span>{timeStr}</span>
        </div>
      </div>
    </div>
  );
}

export function AssistantMessageBubble({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming?: boolean;
}): VNode {
  const html = useMemo(() => {
    if (!text) return '';
    try {
      return marked.parse(text) as string;
    } catch {
      return text;
    }
  }, [text]);

  return (
    <div class="assistant-bubble">
      <div
        class="markdown-body selectable"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {isStreaming && (
        <div class="inline-flex items-center gap-1 text-xs text-muted mt-1" style="color: var(--accent-primary);">
          <span class="animate-pulse">●</span>
          <span>生成中...</span>
        </div>
      )}
    </div>
  );
}
