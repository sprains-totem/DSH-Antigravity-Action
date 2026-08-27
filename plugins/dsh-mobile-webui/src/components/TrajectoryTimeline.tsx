import { h, VNode } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { TurnRecord, ToolExecution } from '../store/types';
import { UserMessageBubble, AssistantMessageBubble } from './MessageBubble';
import { ExecutionProcessAccordion } from './ExecutionProcessAccordion';

export function TrajectoryTimeline({
  turns,
  isGenerating,
  onToolClick,
}: {
  turns: TurnRecord[];
  isGenerating?: boolean;
  onToolClick: (tool: ToolExecution) => void;
}): VNode {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new content arrives
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [turns, isGenerating]);

  if (!turns || turns.length === 0) {
    return (
      <div class="chat-container flex flex-col items-center justify-center text-center text-muted" style="min-height: 60vh;">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
          <span style="font-size: 26px;">⚡</span>
        </div>
        <h3 style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">DeepSeek Harness Mobile</h3>
        <p style="font-size: 13px; max-width: 260px; line-height: 1.5;">移动端专属原生体验，支持实时思考流、工具轨迹与多智能体协作。</p>
      </div>
    );
  }

  return (
    <div class="chat-container" ref={scrollRef}>
      {turns.map((turn, tIdx) => {
        const isLastTurn = tIdx === turns.length - 1;
        const lastStep = turn.steps.length > 0 ? turn.steps[turn.steps.length - 1] : null;

        return (
          <div key={tIdx} class="turn-container">
            {/* 1. User Message */}
            {turn.userMessage && (
              <UserMessageBubble
                text={turn.userMessage.text}
                images={turn.userMessage.images}
                timestamp={turn.userMessage.timestamp}
                status={turn.userMessage.status}
              />
            )}

            {/* 2. Intermediate Execution Steps (Folded by Default!) */}
            {turn.steps.length > 0 && (
              <ExecutionProcessAccordion
                steps={turn.steps}
                status={turn.status}
                isTurnGenerating={isLastTurn && isGenerating}
                onToolClick={onToolClick}
                defaultExpanded={false}
              />
            )}

            {/* 3. Final Assistant Reply */}
            {lastStep && (lastStep.assistantText || lastStep.isTextStreaming) && (
              <AssistantMessageBubble
                text={lastStep.assistantText}
                isStreaming={lastStep.isTextStreaming}
              />
            )}
          </div>
        );
      })}
      <div ref={bottomRef} style="height: 1px;" />
    </div>
  );
}
