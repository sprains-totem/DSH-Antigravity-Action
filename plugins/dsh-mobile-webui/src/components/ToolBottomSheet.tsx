import { h, VNode } from 'preact';
import { useState } from 'preact/hooks';
import { ToolExecution } from '../store/types';
import { CloseIcon, CopyIcon, CheckIcon, TerminalIcon, FileTextIcon, SearchIcon, CheckCircleIcon, XCircleIcon, LoaderIcon } from './Icons';

export function ToolBottomSheet({
  tool,
  onClose,
}: {
  tool: ToolExecution | null;
  onClose: () => void;
}): VNode | null {
  if (!tool) return null;

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'output' | 'input'>('output');

  let parsedArgs: any = {};
  try {
    parsedArgs = JSON.parse(tool.arguments || '{}');
  } catch {
    parsedArgs = { raw: tool.arguments };
  }

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const durationSec = tool.endTime && tool.startTime
    ? ((tool.endTime - tool.startTime) / 1000).toFixed(2) + 's'
    : '';

  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet-card" onClick={(e) => e.stopPropagation()}>
        {/* Handle Bar */}
        <div class="sheet-handle-bar">
          <div class="sheet-handle"></div>
        </div>

        {/* Header */}
        <div class="sheet-header">
          <div class="flex items-center gap-2">
            <div class="tool-icon-wrapper" style="width: 32px; height: 32px;">
              {tool.name === 'bash' ? <TerminalIcon size={16} /> :
               tool.name.includes('read') || tool.name.includes('edit') || tool.name.includes('write') ? <FileTextIcon size={16} /> :
               <SearchIcon size={16} />}
            </div>
            <div>
              <div class="sheet-title">{tool.name}</div>
              <div class="text-xs text-muted">ID: {tool.callId}</div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            {tool.status === 'running' && (
              <span class="status-badge running">
                <LoaderIcon size={12} />
                <span>执行中</span>
              </span>
            )}
            {tool.status === 'completed' && (
              <span class="status-badge completed">
                <CheckCircleIcon size={12} />
                <span>{durationSec || '已完成'}</span>
              </span>
            )}
            {tool.status === 'error' && (
              <span class="status-badge error">
                <XCircleIcon size={12} />
                <span>执行失败</span>
              </span>
            )}

            <button class="icon-btn" onClick={onClose} aria-label="关闭">
              <CloseIcon size={20} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style="display: flex; border-bottom: 1px solid var(--border-subtle); padding: 0 16px;">
          <button
            style={`padding: 10px 16px; font-size: 13px; font-weight: 600; border: none; background: transparent; cursor: pointer; color: ${activeTab === 'output' ? 'var(--accent-primary)' : 'var(--text-secondary)'}; border-bottom: 2px solid ${activeTab === 'output' ? 'var(--accent-primary)' : 'transparent'};`}
            onClick={() => setActiveTab('output')}
          >
            输出结果 {tool.result ? `(${tool.result.length} 字符)` : ''}
          </button>
          <button
            style={`padding: 10px 16px; font-size: 13px; font-weight: 600; border: none; background: transparent; cursor: pointer; color: ${activeTab === 'input' ? 'var(--accent-primary)' : 'var(--text-secondary)'}; border-bottom: 2px solid ${activeTab === 'input' ? 'var(--accent-primary)' : 'transparent'};`}
            onClick={() => setActiveTab('input')}
          >
            调用参数
          </button>
        </div>

        {/* Content Area */}
        <div class="sheet-content selectable">
          {activeTab === 'output' ? (
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 12px; color: var(--text-secondary);">执行日志与返回值</span>
                {tool.result && (
                  <button
                    class="chip-btn"
                    onClick={() => copyToClipboard(tool.result || '')}
                    style="font-size: 11px; padding: 3px 8px;"
                  >
                    {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                    <span>{copied ? '已复制' : '复制结果'}</span>
                  </button>
                )}
              </div>

              {tool.status === 'running' && !tool.result ? (
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 40px 0; color: var(--text-muted);">
                  <LoaderIcon size={18} />
                  <span>正在执行，等待输出...</span>
                </div>
              ) : (
                <pre style="background: #090d13; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.5; color: ${tool.isError ? '#ff7b72' : '#e6edf3'}; white-space: pre-wrap; word-break: break-all; max-height: 48vh; overflow-y: auto;">
                  {tool.result || '(无输出返回)'}
                </pre>
              )}
            </div>
          ) : (
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 12px; color: var(--text-secondary);">传入参数 (JSON / Command)</span>
                <button
                  class="chip-btn"
                  onClick={() => copyToClipboard(tool.arguments)}
                  style="font-size: 11px; padding: 3px 8px;"
                >
                  {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                  <span>{copied ? '已复制' : '复制参数'}</span>
                </button>
              </div>

              {tool.name === 'bash' && parsedArgs.command ? (
                <div style="margin-bottom: 10px;">
                  <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Command:</div>
                  <pre style="background: #090d13; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: var(--accent-primary); white-space: pre-wrap; word-break: break-all;">
                    {parsedArgs.command}
                  </pre>
                </div>
              ) : null}

              <pre style="background: #090d13; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.5; color: #7ee787; white-space: pre-wrap; word-break: break-all; max-height: 48vh; overflow-y: auto;">
                {JSON.stringify(parsedArgs, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
