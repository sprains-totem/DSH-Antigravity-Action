import { h, VNode } from 'preact';
import { SessionMetadata } from '../store/types';
import { CloseIcon, PlusIcon, TrashIcon, LoaderIcon } from './Icons';

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export function SessionDrawer({
  isOpen,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onOpenSettings,
  onClose,
}: {
  isOpen: boolean;
  sessions: SessionMetadata[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenSettings: () => void;
  onClose: () => void;
}): VNode | null {
  if (!isOpen) return null;

  return (
    <div class="drawer-backdrop" onClick={onClose}>
      <div class="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div class="drawer-header">
          <div class="flex items-center gap-2">
            <span style="font-size: 18px;">⚡</span>
            <span style="font-size: 16px; font-weight: 700; color: var(--text-primary);">DSH Mobile</span>
          </div>
          <button class="icon-btn" onClick={onClose} aria-label="关闭侧边栏">
            <CloseIcon size={20} />
          </button>
        </div>

        {/* New Chat Button */}
        <div style="padding: 12px 14px 4px;">
          <button
            style="width: 100%; height: 42px; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: var(--radius-md); border: 1px dashed var(--accent-primary); background: var(--accent-glass); color: var(--accent-primary); font-size: 14px; font-weight: 600; cursor: pointer;"
            onClick={() => {
              onNewChat();
              onClose();
            }}
          >
            <PlusIcon size={18} />
            <span>新建对话</span>
          </button>
        </div>

        {/* Sessions List */}
        <div class="drawer-list">
          {sessions.length === 0 ? (
            <div style="text-align: center; color: var(--text-muted); padding: 40px 0; font-size: 13px;">
              暂无历史会话
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = s.sessionId === currentSessionId;
              return (
                <div
                  key={s.sessionId}
                  class={`session-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onSelectSession(s.sessionId);
                    onClose();
                  }}
                >
                  <div style="display: flex; flex-direction: column; min-width: 0; flex: 1; padding-right: 8px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      {s.running && <LoaderIcon size={12} className="text-accent" />}
                      <span class="session-item-title">{s.title || '新对话'}</span>
                    </div>
                    <span style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                      {formatRelativeTime(s.updatedAt)}
                    </span>
                  </div>

                  <button
                    class="icon-btn"
                    style="width: 28px; height: 28px; color: var(--text-muted);"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('确定删除此对话吗？')) {
                        onDeleteSession(s.sessionId);
                      }
                    }}
                    title="删除会话"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Settings Bar */}
        <div style="padding: 6px 12px; border-top: 1px solid var(--border-subtle);">
          <div
            class="session-item"
            style="color: var(--text-primary);"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
          >
            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500;">
              <span>⚙️</span>
              <span>系统与模型设置</span>
            </div>
            <span style="font-size: 12px; color: var(--text-muted);">配置 →</span>
          </div>
        </div>

        {/* Drawer Footer */}
        <div style="padding: 10px 16px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-muted);">
          <a href="/" style="color: var(--accent-primary); text-decoration: none;">
            切换至桌面版 UI →
          </a>
          <span>v1.0 Mobile</span>
        </div>
      </div>
    </div>
  );
}
