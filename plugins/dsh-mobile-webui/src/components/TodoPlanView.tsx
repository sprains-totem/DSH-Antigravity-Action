import { h, VNode } from 'preact';
import { GoalData, TodoItem } from '../store/types';
import { CloseIcon, ListTodoIcon, CheckCircleIcon, LoaderIcon } from './Icons';

export function TodoPlanView({
  isOpen,
  goal,
  todos,
  onClose,
}: {
  isOpen: boolean;
  goal: GoalData | null;
  todos: TodoItem[];
  onClose: () => void;
}): VNode | null {
  if (!isOpen) return null;

  const completedCount = todos.filter(t => t.status === 'completed').length;
  const progressPercent = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet-card" onClick={(e) => e.stopPropagation()}>
        <div class="sheet-handle-bar">
          <div class="sheet-handle"></div>
        </div>

        <div class="sheet-header">
          <div class="flex items-center gap-2">
            <ListTodoIcon size={18} className="text-accent" />
            <span class="sheet-title">任务规划与执行清单</span>
          </div>
          <button class="icon-btn" onClick={onClose} aria-label="关闭">
            <CloseIcon size={20} />
          </button>
        </div>

        <div class="sheet-content">
          {goal && (
            <div style="background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-md); margin-bottom: 14px; border-left: 3px solid var(--accent-primary);">
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--accent-primary); margin-bottom: 4px;">
                当前总体目标 ({goal.phase || 'active'})
              </div>
              <div style="font-size: 14px; font-weight: 500; color: var(--text-primary); line-height: 1.4;">
                {goal.objective}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {todos.length > 0 && (
            <div style="margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
                <span>任务进度 ({completedCount}/{todos.length})</span>
                <span>{progressPercent}%</span>
              </div>
              <div style="width: 100%; height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">
                <div style={`width: ${progressPercent}%; height: 100%; background: var(--success); transition: width 0.3s;`}></div>
              </div>
            </div>
          )}

          {/* Todo List */}
          <div style="display: flex; flex-direction: column; gap: 8px;">
            {todos.length === 0 ? (
              <div style="text-align: center; color: var(--text-muted); padding: 30px 0; font-size: 14px;">
                暂无规划清单
              </div>
            ) : (
              todos.map((item, idx) => (
                <div
                  key={idx}
                  style={`display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: var(--radius-md); background: ${item.status === 'in_progress' ? 'var(--accent-glass)' : 'var(--bg-tertiary)'}; border: 1px solid ${item.status === 'in_progress' ? 'var(--accent-primary)' : 'transparent'};`}
                >
                  <div style="margin-top: 2px;">
                    {item.status === 'completed' && <CheckCircleIcon size={16} className="text-success" />}
                    {item.status === 'in_progress' && <LoaderIcon size={16} className="text-accent" />}
                    {item.status === 'pending' && (
                      <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--text-muted);"></span>
                    )}
                  </div>
                  <div style={`font-size: 14px; line-height: 1.4; color: ${item.status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)'}; text-decoration: ${item.status === 'completed' ? 'line-through' : 'none'};`}>
                    {item.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
