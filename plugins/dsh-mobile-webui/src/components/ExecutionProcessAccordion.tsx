import { h, VNode } from 'preact';
import { useState } from 'preact/hooks';
import { StepRecord, ToolExecution } from '../store/types';
import { ReasoningView } from './ReasoningView';
import { TrajectoryCard } from './TrajectoryCard';
import { AssistantMessageBubble } from './MessageBubble';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  SparklesIcon,
  CheckCircleIcon,
  LoaderIcon,
  XCircleIcon,
} from './Icons';

export function ExecutionProcessAccordion({
  steps,
  status,
  isTurnGenerating,
  onToolClick,
}: {
  steps: StepRecord[];
  status: 'running' | 'completed' | 'error';
  isTurnGenerating?: boolean;
  onToolClick: (tool: ToolExecution) => void;
}): VNode | null {
  const isRunning = isTurnGenerating || status === 'running';

  // 用户显式手动切换状态（null 表示遵从默认策略：运行中展开，结束后折叠）
  const [userOverride, setUserOverride] = useState<boolean | null>(null);

  // 执行过程中默认展开显示，执行结束后默认折叠
  const isExpanded = userOverride !== null ? userOverride : isRunning;

  const totalTools = steps.reduce((acc, s) => acc + s.toolCalls.length, 0);
  const hasReasoning = steps.some(s => Boolean(s.reasoning));

  // If there are no intermediate steps (no tools and no reasoning), don't render accordion
  if (totalTools === 0 && !hasReasoning) {
    return null;
  }

  // Calculate total execution time of tools
  let totalToolDuration = 0;
  for (const step of steps) {
    for (const tool of step.toolCalls) {
      if (tool.startTime && tool.endTime) {
        totalToolDuration += (tool.endTime - tool.startTime) / 1000;
      }
    }
  }
  const durationStr = totalToolDuration > 0 ? `${totalToolDuration.toFixed(1)}s` : '';

  const toggleExpand = (e: MouseEvent) => {
    e.stopPropagation();
    setUserOverride(!isExpanded);
  };

  return (
    <div class={`process-accordion ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div
        class="process-accordion-header"
        onClick={toggleExpand}
        aria-expanded={isExpanded}
      >
        <div class="process-accordion-title">
          {isRunning ? (
            <div class="flex items-center gap-2" style="color: var(--accent-primary);">
              <LoaderIcon size={14} />
              <span>正在执行中 (第 {steps.length} 步 · {totalTools} 个工具)...</span>
            </div>
          ) : status === 'error' ? (
            <div class="flex items-center gap-2" style="color: var(--danger);">
              <XCircleIcon size={14} />
              <span>运行中断 ({totalTools} 个工具 · {steps.length} 轮思考)</span>
            </div>
          ) : (
            <div class="flex items-center gap-2" style="color: var(--text-secondary);">
              <SparklesIcon size={14} className="text-accent" />
              <span>运行过程：已执行 {totalTools} 个工具 · {steps.length} 轮思考</span>
            </div>
          )}
        </div>

        <div class="process-accordion-meta">
          {!isRunning && durationStr && (
            <span class="status-badge completed" style="font-size: 11px; padding: 1px 6px;">
              <CheckCircleIcon size={10} />
              <span>{durationStr}</span>
            </span>
          )}
          <span style="font-size: 12px; color: var(--text-muted);">
            {isExpanded ? '收起' : '展开'}
          </span>
          {isExpanded ? <ChevronDownIcon size={15} /> : <ChevronRightIcon size={15} />}
        </div>
      </div>

      {isExpanded && (
        <div class="process-accordion-body">
          {steps.map((step, idx) => (
            <div key={idx} style="display: flex; flex-direction: column; gap: 6px;">
              {steps.length > 1 && (
                <div class="step-divider">
                  <span>第 {step.step || (idx + 1)} 步</span>
                </div>
              )}

              {/* 1. Reasoning Thought */}
              {step.reasoning && (
                <ReasoningView
                  text={step.reasoning}
                  isStreaming={step.isReasoningStreaming}
                />
              )}

              {/* 2. Tool Calls in this Step */}
              {step.toolCalls && step.toolCalls.length > 0 && (
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  {step.toolCalls.map((tool, tIdx) => (
                    <TrajectoryCard
                      key={tool.callId || tIdx}
                      tool={tool}
                      onClick={onToolClick}
                    />
                  ))}
                </div>
              )}

              {/* 3. Intermediate Assistant Commentary (if not final) */}
              {idx < steps.length - 1 && step.assistantText && (
                <div style="padding: 4px 6px; font-size: 13px; color: var(--text-secondary); border-left: 2px solid var(--border-subtle); margin: 4px 0;">
                  <AssistantMessageBubble
                    text={step.assistantText}
                    isStreaming={false}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
