import { h, VNode } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { BrainIcon, ChevronDownIcon, ChevronRightIcon, LoaderIcon } from './Icons';

export function ReasoningView({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming?: boolean;
}): VNode | null {
  if (!text && !isStreaming) return null;

  // Auto-expand while streaming so user can see live thoughts
  const [isOpen, setIsOpen] = useState(isStreaming === true);

  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true);
    }
  }, [isStreaming]);

  const lineCount = text ? text.split('\n').filter(Boolean).length : 0;
  const preview = text ? text.trim().split('\n')[0] : '';

  return (
    <div class="reasoning-box">
      <div class="reasoning-header" onClick={() => setIsOpen(!isOpen)}>
        <div class="reasoning-title">
          <BrainIcon size={14} className={isStreaming ? 'text-accent' : ''} />
          <span>{isStreaming ? '思考中...' : `思考过程 (${lineCount} 行)`}</span>
          {isStreaming && <LoaderIcon size={12} />}
        </div>
        <div>
          {isOpen ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
        </div>
      </div>

      {isOpen && (
        <div class="reasoning-body selectable">
          {text || (isStreaming ? '正在组织思维链...' : '')}
        </div>
      )}
    </div>
  );
}
