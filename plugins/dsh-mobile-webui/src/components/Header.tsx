import { h, VNode } from 'preact';
import { store } from '../store/state';
import { ConnectionStatus } from './ConnectionStatus';
import { MenuIcon, PlusIcon, ListTodoIcon, CpuIcon } from './Icons';

export function Header({
  title,
  todosCount,
  modelName,
  connectionState,
  onOpenDrawer,
  onNewChat,
  onOpenModelPicker,
  onOpenTodos,
}: {
  title: string;
  todosCount: number;
  modelName: string;
  connectionState: any;
  onOpenDrawer: () => void;
  onNewChat: () => void;
  onOpenModelPicker: () => void;
  onOpenTodos: () => void;
}): VNode {
  const shortModel = modelName.replace('gemini-', 'G-').replace('-high', '').replace('-medium', '');

  return (
    <header class="app-header">
      <div class="header-left">
        <button class="icon-btn" onClick={onOpenDrawer} aria-label="打开会话列表">
          <MenuIcon size={20} />
        </button>
        <button class="icon-btn" onClick={onNewChat} aria-label="新建会话">
          <PlusIcon size={20} />
        </button>
      </div>

      <div class="header-center">
        <div class="session-title" title={title}>
          {title || '新对话'}
        </div>
      </div>

      <div class="header-right">
        {todosCount > 0 && (
          <button class="chip-btn" onClick={onOpenTodos} style="background: var(--accent-glass); color: var(--accent-primary); border-color: transparent;">
            <ListTodoIcon size={13} />
            <span>{todosCount}</span>
          </button>
        )}

        <button class="chip-btn" onClick={onOpenModelPicker} aria-label="切换模型">
          <CpuIcon size={13} />
          <span style="max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            {shortModel || 'Gemini'}
          </span>
        </button>

        <ConnectionStatus state={connectionState} />
      </div>
    </header>
  );
}
