import { h, VNode } from 'preact';
import { store } from '../store/state';
import { ConnectionStatus } from './ConnectionStatus';
import { MenuIcon, PlusIcon, ListTodoIcon, CpuIcon, SettingsIcon } from './Icons';

export function Header({
  title,
  todosCount,
  modelName,
  connectionState,
  onOpenDrawer,
  onNewChat,
  onOpenModelPicker,
  onOpenTodos,
  onOpenSessionSettings,
}: {
  title: string;
  todosCount: number;
  modelName: string;
  connectionState: any;
  onOpenDrawer: () => void;
  onNewChat: () => void;
  onOpenModelPicker: () => void;
  onOpenTodos: () => void;
  onOpenSessionSettings: () => void;
}): VNode {
  const shortModel = modelName.replace('gemini-', 'G-').replace('-high', '').replace('-medium', '');

  return (
    <header class="app-header">
      <div class="header-left">
        <button class="icon-btn" onClick={onOpenDrawer} aria-label="打开会话列表" title="会话列表">
          <MenuIcon size={20} />
        </button>
        <button class="icon-btn" onClick={onNewChat} aria-label="新建会话" title="新建会话">
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

        <button class="chip-btn" onClick={onOpenModelPicker} aria-label="切换模型" title="切换当前模型">
          <CpuIcon size={13} />
          <span style="max-width: 65px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            {shortModel || 'Gemini'}
          </span>
        </button>

        <button
          class="icon-btn"
          style="width: 32px; height: 32px;"
          onClick={onOpenSessionSettings}
          aria-label="当前会话独立设置"
          title="当前会话独立设置"
        >
          <SettingsIcon size={16} />
        </button>

        <ConnectionStatus state={connectionState} />
      </div>
    </header>
  );
}
