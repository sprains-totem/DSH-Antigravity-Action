import { h, VNode } from 'preact';
import { ModelCatalogItem } from '../store/types';
import { CloseIcon, CpuIcon, ShieldIcon, CheckIcon } from './Icons';

export function ModelPickerSheet({
  isOpen,
  models,
  currentModel,
  currentPermission,
  onSelectModel,
  onSelectPermission,
  onClose,
}: {
  isOpen: boolean;
  models: ModelCatalogItem[];
  currentModel: { provider: string; model: string };
  currentPermission: string;
  onSelectModel: (modelId: string, provider: string) => void;
  onSelectPermission: (preset: string) => void;
  onClose: () => void;
}): VNode | null {
  if (!isOpen) return null;

  const defaultModels: ModelCatalogItem[] = models.length > 0 ? models : [
    { id: 'gemini-3.7-flash-high', name: 'Gemini 3.7 Flash High', description: '旗舰模型，支持深度混合推理思考' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '快速低延迟，适合轻量快速问答' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '强大代码能力，支持复杂工程重构' },
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash', description: '最新下一代闪电模型' },
  ];

  const presets = [
    { id: 'danger-full-access', name: 'Full Access (完全放行)', desc: '完全访问文件与命令，不弹窗中断' },
    { id: 'workspace-write', name: 'Workspace Write (仅工作区)', desc: '限制在工作区写入，越界需单次确认' },
    { id: 'read-only', name: 'Read Only (只读安全)', desc: '禁止修改任何文件或执行写操作' },
  ];

  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet-card" onClick={(e) => e.stopPropagation()}>
        <div class="sheet-handle-bar">
          <div class="sheet-handle"></div>
        </div>

        <div class="sheet-header">
          <div class="flex items-center gap-2">
            <CpuIcon size={18} className="text-accent" />
            <span class="sheet-title">模型与权限配置</span>
          </div>
          <button class="icon-btn" onClick={onClose} aria-label="关闭">
            <CloseIcon size={20} />
          </button>
        </div>

        <div class="sheet-content">
          {/* 1. Model Selector */}
          <div style="margin-bottom: 20px;">
            <div style="font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">
              选择对话模型
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              {defaultModels.map((m) => {
                const isSelected = currentModel.model === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => onSelectModel(m.id, 'antigravity')}
                    style={`display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}; background: ${isSelected ? 'var(--accent-glass)' : 'var(--bg-tertiary)'}; cursor: pointer; transition: all 0.15s;`}
                  >
                    <div>
                      <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">
                        {m.name || m.id}
                      </div>
                      {m.description && (
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                          {m.description}
                        </div>
                      )}
                    </div>
                    {isSelected && <CheckIcon size={16} className="text-accent" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Permission Preset */}
          <div>
            <div style="font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <ShieldIcon size={14} />
              <span>沙箱与权限预设</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              {presets.map((p) => {
                const isSelected = currentPermission === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectPermission(p.id)}
                    style={`display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid ${isSelected ? 'var(--warning)' : 'var(--border-subtle)'}; background: ${isSelected ? 'var(--warning-glass)' : 'var(--bg-tertiary)'}; cursor: pointer; transition: all 0.15s;`}
                  >
                    <div>
                      <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">
                        {p.name}
                      </div>
                      <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                        {p.desc}
                      </div>
                    </div>
                    {isSelected && <CheckIcon size={16} className="text-warning" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
