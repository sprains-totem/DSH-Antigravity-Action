import { h, VNode } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { SendIcon, StopIcon, ShieldIcon } from './Icons';

export function Composer({
  isGenerating,
  currentPermission,
  onSend,
  onCancel,
  onOpenModelPicker,
}: {
  isGenerating: boolean;
  currentPermission: string;
  onSend: (text: string, images?: string[]) => void;
  onCancel: () => void;
  onOpenModelPicker: () => void;
}): VNode {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = (e: any) => {
    setText(e.target.value);
    autoResize();
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  };

  const handleSubmit = () => {
    if (isGenerating) {
      onCancel();
      return;
    }
    if (!text.trim()) return;

    const toSend = text;
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '38px';
    }
    onSend(toSend);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // If desktop keyboard, enter sends
      if (window.innerWidth >= 768) {
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  const shortPerm = currentPermission === 'danger-full-access' ? 'Full' :
                    currentPermission === 'workspace-write' ? 'Workspace' : 'Read-only';

  return (
    <div class="app-composer-wrapper">
      <div class="composer-toolbar">
        <button
          class="chip-btn"
          onClick={onOpenModelPicker}
          style="font-size: 11px; padding: 2px 8px;"
        >
          <ShieldIcon size={12} />
          <span>{shortPerm}</span>
        </button>

        {isGenerating && (
          <span style="font-size: 11px; color: var(--accent-primary); display: flex; align-items: center; gap: 4px;">
            <span class="animate-spin">●</span>
            <span>Agent 正在执行中...</span>
          </span>
        )}
      </div>

      <div class="composer-input-row">
        <textarea
          ref={textareaRef}
          class="composer-textarea"
          rows={1}
          placeholder={isGenerating ? "Agent 正在执行...输入内容将作为后续引导" : "输入消息或指令 (/ 触发命令)..."}
          value={text}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
        />

        <button
          class={`send-btn ${isGenerating ? 'stop' : ''}`}
          disabled={!isGenerating && !text.trim()}
          onClick={handleSubmit}
          aria-label={isGenerating ? "停止生成" : "发送消息"}
        >
          {isGenerating ? <StopIcon size={16} /> : <SendIcon size={16} />}
        </button>
      </div>
    </div>
  );
}
