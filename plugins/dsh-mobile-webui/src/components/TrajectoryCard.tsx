import { h, VNode } from 'preact';
import { ToolExecution } from '../store/types';
import {
  TerminalIcon,
  FileTextIcon,
  SearchIcon,
  ListTodoIcon,
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon,
  LoaderIcon,
} from './Icons';

function parseToolSummary(name: string, argsStr: string): { icon: any; summary: string; detail: string } {
  let parsed: any = {};
  try {
    parsed = JSON.parse(argsStr || '{}');
  } catch {
    parsed = { raw: argsStr };
  }

  switch (name) {
    case 'bash':
      return {
        icon: TerminalIcon,
        summary: parsed.description || parsed.command?.split('\n')[0] || 'Bash 命令',
        detail: parsed.command || '',
      };
    case 'read':
    case 'read_audio':
    case 'read_image':
    case 'read_pdf':
    case 'read_video':
      return {
        icon: FileTextIcon,
        summary: `读取 ${parsed.file_path ? parsed.file_path.split('/').pop() : ''}`,
        detail: parsed.file_path || '',
      };
    case 'write':
      return {
        icon: FileTextIcon,
        summary: `创建/写入 ${parsed.file_path ? parsed.file_path.split('/').pop() : ''}`,
        detail: parsed.file_path || '',
      };
    case 'edit':
      return {
        icon: FileTextIcon,
        summary: `修改 ${parsed.file_path ? parsed.file_path.split('/').pop() : ''}`,
        detail: parsed.file_path || '',
      };
    case 'grep':
      return {
        icon: SearchIcon,
        summary: `搜索内容: "${parsed.pattern || ''}"`,
        detail: parsed.path || '',
      };
    case 'glob':
      return {
        icon: SearchIcon,
        summary: `查找文件: "${parsed.pattern || ''}"`,
        detail: parsed.path || '',
      };
    case 'web_search':
      return {
        icon: SearchIcon,
        summary: `联网搜索: ${Array.isArray(parsed.queries) ? parsed.queries.join(', ') : ''}`,
        detail: 'Web Search',
      };
    case 'todo_write':
      return {
        icon: ListTodoIcon,
        summary: `更新任务规划清单 (${parsed.todos?.length || 0} 项)`,
        detail: 'Plan Updates',
      };
    case 'subagent':
    case 'subagent_fork':
      return {
        icon: SparklesIcon,
        summary: `派发子任务: ${parsed.description || 'Subagent'}`,
        detail: parsed.prompt?.slice(0, 40) || '',
      };
    default:
      return {
        icon: TerminalIcon,
        summary: name || '工具调用',
        detail: typeof argsStr === 'string' ? argsStr.slice(0, 40) : '',
      };
  }
}

export function TrajectoryCard({
  tool,
  onClick,
}: {
  tool: ToolExecution;
  onClick: (tool: ToolExecution) => void;
}): VNode {
  const { icon: IconComponent, summary, detail } = parseToolSummary(tool.name, tool.arguments);

  const durationSec = tool.endTime && tool.startTime
    ? ((tool.endTime - tool.startTime) / 1000).toFixed(1) + 's'
    : '';

  return (
    <div class="trajectory-step-card" onClick={() => onClick(tool)}>
      <div class="trajectory-step-left">
        <div class="tool-icon-wrapper">
          <IconComponent size={15} />
        </div>
        <div class="trajectory-info">
          <span class="trajectory-name">{summary}</span>
          {detail && <span class="trajectory-args-preview">{detail}</span>}
        </div>
      </div>

      <div class="trajectory-step-right">
        {tool.status === 'running' && (
          <span class="status-badge running">
            <LoaderIcon size={11} />
            <span>执行中</span>
          </span>
        )}
        {tool.status === 'completed' && (
          <span class="status-badge completed">
            <CheckCircleIcon size={11} />
            <span>{durationSec || '完成'}</span>
          </span>
        )}
        {tool.status === 'error' && (
          <span class="status-badge error">
            <XCircleIcon size={11} />
            <span>失败</span>
          </span>
        )}
      </div>
    </div>
  );
}
