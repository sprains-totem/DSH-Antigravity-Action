import { h, VNode, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { store } from '../store/state';
import { t, subscribeLocale } from '../i18n';
import {
  CloseIcon,
  CpuIcon,
  ShieldIcon,
  BrainIcon,
  CheckIcon,
  CopyIcon,
  TrashIcon,
  CheckCircleIcon,
  LoaderIcon,
  ListTodoIcon,
  SettingsIcon,
} from './Icons';

export function SessionSettingsSheet({
  isOpen,
  onClose,
  onOpenGlobalSettings,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenGlobalSettings: () => void;
}): VNode | null {
  if (!isOpen) return null;

  const [, setLocaleTick] = useState(0);
  useEffect(() => {
    return subscribeLocale(() => setLocaleTick(t => t + 1));
  }, []);

  const currentSession = store.getCurrentSession();
  const sessionId = store.currentSessionId || '';
  const currentTitle = currentSession?.title || t('newSession');

  // Editable title state
  const [titleDraft, setTitleDraft] = useState(currentTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);

  // Model & Reasoning state
  const [reasoningEffort, setReasoningEffort] = useState('high');
  const [copiedId, setCopiedId] = useState(false);
  const [exportedTip, setExportedTip] = useState(false);
  const [clearedTip, setClearedTip] = useState(false);

  useEffect(() => {
    setTitleDraft(currentTitle);
  }, [currentTitle, sessionId]);

  const handleSaveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === currentTitle) {
      setIsEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    try {
      await store.renameSession(sessionId, trimmed);
    } catch (e) {
      console.error('[SessionSettings] failed to save title:', e);
    } finally {
      setSavingTitle(false);
      setIsEditingTitle(false);
    }
  };

  const handleCopySessionId = () => {
    if (!sessionId) return;
    navigator.clipboard.writeText(sessionId).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  // Export current conversation history to Markdown
  const handleExportMarkdown = () => {
    let md = `# 会话记录: ${currentTitle}\n\n`;
    md += `- **Session ID**: \`${sessionId}\`\n`;
    md += `- **导出时间**: ${new Date().toLocaleString()}\n`;
    md += `- **当前模型**: \`${store.currentModel.model}\`\n`;
    md += `- **权限模式**: \`${store.currentPermission}\`\n\n---\n\n`;

    for (const turn of store.turns) {
      md += `## 👤 User (Turn ${turn.turn})\n\n`;
      if (turn.userMessage) {
        md += `${turn.userMessage.text || ''}\n\n`;
      }

      for (const step of turn.steps) {
        if (step.reasoning) {
          md += `> 💭 **Thinking / 推理**:\n> ${step.reasoning.split('\n').join('\n> ')}\n\n`;
        }
        for (const tool of step.toolCalls) {
          md += `### 🛠️ 工具调用: \`${tool.name}\`\n`;
          md += `\`\`\`json\n${tool.arguments || '{}'}\n\`\`\`\n\n`;
          if (tool.result) {
            md += `**执行输出**:\n\`\`\`text\n${tool.result.slice(0, 1000)}\n\`\`\`\n\n`;
          }
        }
        if (step.assistantText) {
          md += `## 🤖 Assistant\n\n${step.assistantText}\n\n`;
        }
      }
      md += `---\n\n`;
    }

    navigator.clipboard.writeText(md).then(() => {
      setExportedTip(true);
      setTimeout(() => setExportedTip(false), 2500);
    });
  };

  // Clear current turns
  const handleClearHistory = () => {
    if (confirm('确定清空当前会话的历史消息记录吗？（注意：这会重置当前界面的对话气泡）')) {
      store.turns = [];
      setClearedTip(true);
      setTimeout(() => setClearedTip(false), 2000);
    }
  };

  // Delete session
  const handleDeleteSession = () => {
    if (confirm(`确定彻底删除会话 "${currentTitle}" 吗？此操作不可撤销。`)) {
      store.deleteSession(sessionId);
      onClose();
    }
  };

  // Calculate session token & step totals
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheTokens = 0;
  let totalReasoningTokens = 0;
  let totalToolCalls = 0;

  for (const turn of store.turns) {
    for (const step of turn.steps) {
      if (step.usage) {
        totalInputTokens += step.usage.inputTokens || 0;
        totalOutputTokens += step.usage.outputTokens || 0;
        totalCacheTokens += step.usage.cacheReadTokens || 0;
        totalReasoningTokens += step.usage.reasoningTokens || 0;
      }
      totalToolCalls += step.toolCalls.length;
    }
  }

  // Model catalog
  const availableModels = [
    { id: 'gemini-3.7-flash-high', prov: 'antigravity', name: 'Gemini 3.7 Flash High', desc: '深度思考推理旗舰模型（推荐）' },
    { id: 'gemini-2.5-pro', prov: 'antigravity', name: 'Gemini 2.5 Pro', desc: '百万上下文窗口，复杂代码重构' },
    { id: 'gemini-2.5-flash', prov: 'antigravity', name: 'Gemini 2.5 Flash', desc: '极速低延迟，适合轻量快速问答' },
    { id: 'gemini-3-flash', prov: 'antigravity', name: 'Gemini 3 Flash', desc: '下一代极速多模态推理模型' },
    { id: 'deepseek-v4-flash', prov: 'deepseek-official', name: 'DeepSeek-V4-Flash', desc: 'DeepSeek 官方推理大模型' },
    { id: 'claude-sonnet-4-6', prov: 'antigravity', name: 'Claude Sonnet 4.6', desc: 'Claude 代码与结构化能力模型' },
  ];

  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet-card" onClick={(e) => e.stopPropagation()} style="max-height: 90dvh;">
        <div class="sheet-handle-bar">
          <div class="sheet-handle"></div>
        </div>

        {/* Header */}
        <div class="sheet-header">
          <div class="flex items-center gap-2">
            <span style="font-size: 18px;">💬</span>
            <span class="sheet-title">{t('sessionSettingsTitle')}</span>
          </div>
          <button class="icon-btn" onClick={onClose} aria-label={t('close')}>
            <CloseIcon size={20} />
          </button>
        </div>

        <div class="sheet-content">
          {/* 1. Session Title & ID Card */}
          <div class="settings-section">
            <div class="settings-section-title">
              <span>🏷️ {t('sessionTitleAndId')}</span>
            </div>
            <div class="settings-card" style="padding: 12px 14px; gap: 10px;">
              <div class="flex items-center justify-between gap-2">
                {isEditingTitle ? (
                  <div class="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      class="settings-input"
                      value={titleDraft}
                      onInput={(e: any) => setTitleDraft(e.target.value)}
                      placeholder="输入新标题..."
                      autoFocus
                    />
                    <button
                      class="chip-btn"
                      style="background: var(--accent-primary); color: #fff; border-color: transparent;"
                      onClick={handleSaveTitle}
                      disabled={savingTitle}
                    >
                      {savingTitle ? <LoaderIcon size={12} /> : <CheckIcon size={12} />}
                      <span>{t('save')}</span>
                    </button>
                    <button
                      class="chip-btn"
                      onClick={() => {
                        setTitleDraft(currentTitle);
                        setIsEditingTitle(false);
                      }}
                    >
                      {t('cancel')}
                    </button>
                  </div>
                ) : (
                  <div class="flex items-center justify-between w-full">
                    <span style="font-weight: 600; font-size: 14px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      {currentTitle}
                    </span>
                    <button
                      class="chip-btn"
                      style="font-size: 11px; padding: 2px 8px;"
                      onClick={() => setIsEditingTitle(true)}
                    >
                      {t('rename')}
                    </button>
                  </div>
                )}
              </div>

              <div class="flex items-center justify-between pt-1" style="border-top: 1px solid var(--border-subtle); font-size: 11px; color: var(--text-muted);">
                <div class="flex items-center gap-1">
                  <span>ID:</span>
                  <code style="color: var(--text-secondary);">{sessionId.slice(0, 16)}...</code>
                </div>
                <button
                  class="chip-btn"
                  style="font-size: 10px; padding: 2px 6px;"
                  onClick={handleCopySessionId}
                >
                  {copiedId ? <CheckIcon size={10} /> : <CopyIcon size={10} />}
                  <span>{copiedId ? t('copied') : t('copy')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Session Independent Model Selection */}
          <div class="settings-section">
            <div class="settings-section-title">
              <CpuIcon size={14} />
              <span>{t('sessionModel')}</span>
            </div>
            <div class="settings-card">
              {availableModels.map((m) => {
                const isSelected = store.currentModel.model === m.id;
                return (
                  <div
                    key={m.id}
                    class="settings-row"
                    onClick={() => store.selectModel(m.id, m.prov, reasoningEffort)}
                  >
                    <div>
                      <div class="settings-row-label">{m.name}</div>
                      <div class="settings-row-desc">{m.desc}</div>
                    </div>
                    {isSelected && <CheckIcon size={16} className="text-accent" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Session Reasoning Effort */}
          <div class="settings-section">
            <div class="settings-section-title">
              <BrainIcon size={14} />
              <span>{t('reasoningEffortTitle')}</span>
            </div>
            <div class="settings-card">
              {[
                { id: 'high', name: t('thinkingHigh'), desc: t('thinkingHighDesc') },
                { id: 'medium', name: t('thinkingMedium'), desc: t('thinkingMediumDesc') },
                { id: 'low', name: t('thinkingLow'), desc: t('thinkingLowDesc') },
              ].map((eff) => (
                <div
                  key={eff.id}
                  class="settings-row"
                  onClick={() => {
                    setReasoningEffort(eff.id);
                    let targetModel = store.currentModel.model;
                    if (targetModel.startsWith('gemini-3.7-flash-')) {
                      targetModel = `gemini-3.7-flash-${eff.id}`;
                    } else if (targetModel.startsWith('gemini-3.6-flash-')) {
                      targetModel = `gemini-3.6-flash-${eff.id}`;
                    }
                    store.selectModel(targetModel, store.currentModel.provider, eff.id);
                  }}
                >
                  <div>
                    <div class="settings-row-label">{eff.name}</div>
                    <div class="settings-row-desc">{eff.desc}</div>
                  </div>
                  {reasoningEffort === eff.id && <CheckIcon size={16} className="text-accent" />}
                </div>
              ))}
            </div>
          </div>

          {/* 4. Session Sandbox Permission Mode */}
          <div class="settings-section">
            <div class="settings-section-title">
              <ShieldIcon size={14} />
              <span>{t('defaultPermPreset')}</span>
            </div>
            <div class="settings-card">
              {[
                { id: 'danger-full-access', name: t('permFull'), desc: t('permFullDesc') },
                { id: 'workspace-write', name: t('permWorkspace'), desc: t('permWorkspaceDesc') },
                { id: 'read-only', name: t('permReadOnly'), desc: t('permReadOnlyDesc') },
              ].map((p) => (
                <div
                  key={p.id}
                  class="settings-row"
                  onClick={() => store.setPermissionPreset(p.id)}
                >
                  <div>
                    <div class="settings-row-label">{p.name}</div>
                    <div class="settings-row-desc">{p.desc}</div>
                  </div>
                  {store.currentPermission === p.id && <CheckIcon size={16} className="text-warning" />}
                </div>
              ))}
            </div>
          </div>

          {/* 5. Session Context & Token Metrics */}
          <div class="settings-section">
            <div class="settings-section-title">
              <span>📊 {t('sessionStatsTitle')}</span>
            </div>
            <div class="settings-card" style="padding: 12px 14px; gap: 8px; font-size: 12px;">
              <div class="flex items-center justify-between">
                <span style="color: var(--text-secondary);">对话轮次 (Turns)</span>
                <span style="font-weight: 600; color: var(--text-primary);">{store.turns.length} 轮</span>
              </div>
              <div class="flex items-center justify-between">
                <span style="color: var(--text-secondary);">{t('totalRequests')}</span>
                <span style="font-weight: 600; color: var(--text-primary);">{totalToolCalls} 次</span>
              </div>
              <div class="flex items-center justify-between">
                <span style="color: var(--text-secondary);">活跃任务 / 计划</span>
                <span style="font-weight: 600; color: var(--accent-primary);">
                  {store.todos.filter(t => t.status !== 'completed').length} 项待完成
                </span>
              </div>
              {(totalInputTokens > 0 || totalOutputTokens > 0) && (
                <div class="pt-2 mt-1" style="border-top: 1px solid var(--border-subtle);">
                  <div class="flex items-center justify-between py-0.5">
                    <span style="color: var(--text-muted);">{t('inputTokens')}:</span>
                    <span style="color: var(--text-primary);">{totalInputTokens.toLocaleString()}</span>
                  </div>
                  <div class="flex items-center justify-between py-0.5">
                    <span style="color: var(--text-muted);">{t('outputTokens')}:</span>
                    <span style="color: var(--text-primary);">{totalOutputTokens.toLocaleString()}</span>
                  </div>
                  {totalCacheTokens > 0 && (
                    <div class="flex items-center justify-between py-0.5">
                      <span style="color: var(--text-muted);">前缀缓存读取:</span>
                      <span style="color: #10b981;">{totalCacheTokens.toLocaleString()} (节省)</span>
                    </div>
                  )}
                  {totalReasoningTokens > 0 && (
                    <div class="flex items-center justify-between py-0.5">
                      <span style="color: var(--text-muted);">思考链 Tokens:</span>
                      <span style="color: var(--text-primary);">{totalReasoningTokens.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 6. Session Quick Actions */}
          <div class="settings-section">
            <div class="settings-section-title">
              <span>⚡ {t('sessionActionsTitle')}</span>
            </div>
            <div class="settings-card" style="padding: 10px 12px; gap: 8px;">
              <button
                class="settings-row"
                style="border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px 12px;"
                onClick={handleExportMarkdown}
              >
                <div class="flex items-center gap-2">
                  <span>📥</span>
                  <div>
                    <div class="settings-row-label">{t('exportMarkdown')}</div>
                    <div class="settings-row-desc">将完整对话、思考过程与工具调用复制到剪贴板</div>
                  </div>
                </div>
                {exportedTip ? (
                  <span class="status-badge completed" style="font-size: 11px;">
                    <CheckCircleIcon size={12} />
                    <span>{t('copied')}</span>
                  </span>
                ) : (
                  <CopyIcon size={14} />
                )}
              </button>

              <button
                class="settings-row"
                style="border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px 12px;"
                onClick={handleClearHistory}
              >
                <div class="flex items-center gap-2">
                  <span>🧹</span>
                  <div>
                    <div class="settings-row-label">{t('clearHistory')}</div>
                    <div class="settings-row-desc">{t('clearHistoryDesc')}</div>
                  </div>
                </div>
                {clearedTip && (
                  <span class="status-badge completed" style="font-size: 11px;">
                    已清空
                  </span>
                )}
              </button>

              <button
                class="settings-row"
                style="border: 1px solid var(--danger-border, #ef444433); border-radius: var(--radius-sm); padding: 8px 12px; background: rgba(239, 68, 68, 0.05);"
                onClick={handleDeleteSession}
              >
                <div class="flex items-center gap-2">
                  <TrashIcon size={16} className="text-danger" />
                  <div>
                    <div class="settings-row-label" style="color: #ef4444;">{t('deleteSessionPermanent')}</div>
                    <div class="settings-row-desc">{t('deleteSessionDesc')}</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 7. Bottom Navigation to Global System Settings */}
          <div class="pt-2 pb-4">
            <button
              style="width: 100%; height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); background: var(--bg-card); color: var(--text-primary); font-size: 13px; font-weight: 500; cursor: pointer;"
              onClick={() => {
                onClose();
                onOpenGlobalSettings();
              }}
            >
              <SettingsIcon size={15} />
              <span>{t('goToGlobalSettings')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
