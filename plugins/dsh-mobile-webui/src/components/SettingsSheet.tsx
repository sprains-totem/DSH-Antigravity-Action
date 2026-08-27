import { h, VNode, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { store } from '../store/state';
import {
  CloseIcon,
  CpuIcon,
  SearchIcon,
  ShieldIcon,
  SparklesIcon,
  CheckIcon,
  CheckCircleIcon,
  LoaderIcon,
} from './Icons';

export function SettingsSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): VNode | null {
  if (!isOpen) return null;

  const [theme, setThemeState] = useState<string>(
    localStorage.getItem('dsh_mobile_theme') || 'dark'
  );
  const [searchProvider, setSearchProvider] = useState<string>('antigravity');
  const [defaultModel, setDefaultModel] = useState<string>('gemini-3.7-flash-high');
  const [defaultPreset, setDefaultPreset] = useState<string>('danger-full-access');
  const [saving, setSaving] = useState(false);
  const [savedTip, setSavedTip] = useState(false);

  useEffect(() => {
    // Load current settings from backend
    store.client.rpc<{ namespaces: any[] }>('settings.describe').then((res) => {
      if (res && Array.isArray(res.namespaces)) {
        for (const ns of res.namespaces) {
          if (ns.ns === 'web-search-selector') {
            const val = ns.user?.provider || ns.resolved?.provider || ns.base?.provider;
            if (val) setSearchProvider(val);
          } else if (ns.ns === 'agent-default-model') {
            const val = ns.user?.model || ns.resolved?.model || ns.base?.model;
            if (val) setDefaultModel(val);
          } else if (ns.ns === 'permission') {
            const val = ns.user?.defaultPreset || ns.resolved?.defaultPreset || ns.base?.defaultPreset;
            if (val) setDefaultPreset(val);
          }
        }
      }
    }).catch(console.error);
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setThemeState(newTheme);
    localStorage.setItem('dsh_mobile_theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const handleSearchProviderChange = async (prov: string) => {
    setSearchProvider(prov);
    setSaving(true);
    try {
      await store.client.rpc('settings.update', {
        ns: 'web-search-selector',
        patch: { provider: prov },
      });
      showSavedToast();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDefaultModelChange = async (mId: string) => {
    setDefaultModel(mId);
    setSaving(true);
    try {
      await store.client.rpc('settings.update', {
        ns: 'agent-default-model',
        patch: { provider: 'antigravity', model: mId },
      });
      // Also update active session model
      await store.selectModel(mId, 'antigravity');
      showSavedToast();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDefaultPresetChange = async (preset: string) => {
    setDefaultPreset(preset);
    setSaving(true);
    try {
      await store.client.rpc('settings.update', {
        ns: 'permission',
        patch: { defaultPreset: preset },
      });
      await store.setPermissionPreset(preset);
      showSavedToast();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const showSavedToast = () => {
    setSavedTip(true);
    setTimeout(() => setSavedTip(false), 2000);
  };

  const currentSession = store.getCurrentSession();
  const stats = currentSession?.sessionStats;
  const tokenUsage = currentSession?.tokenUsage;

  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet-card" onClick={(e) => e.stopPropagation()} style="max-height: 88dvh;">
        <div class="sheet-handle-bar">
          <div class="sheet-handle"></div>
        </div>

        <div class="sheet-header">
          <div class="flex items-center gap-2">
            <span style="font-size: 18px;">⚙️</span>
            <span class="sheet-title">移动端系统设置</span>
            {saving && <LoaderIcon size={14} className="text-accent" />}
            {savedTip && (
              <span class="status-badge completed" style="font-size: 11px;">
                <CheckCircleIcon size={11} />
                <span>已保存</span>
              </span>
            )}
          </div>
          <button class="icon-btn" onClick={onClose} aria-label="关闭设置">
            <CloseIcon size={20} />
          </button>
        </div>

        <div class="sheet-content">
          {/* 1. Model & Reasoning */}
          <div class="settings-section">
            <div class="settings-section-title">
              <CpuIcon size={14} />
              <span>默认模型 (Default Model)</span>
            </div>
            <div class="settings-card">
              {[
                { id: 'gemini-3.7-flash-high', name: 'Gemini 3.7 Flash High', desc: '深度思考推理旗舰（推荐）' },
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: '毫秒级响应，极速问答' },
                { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: '超大上下文，复杂代码重构' },
                { id: 'gemini-3-flash', name: 'Gemini 3 Flash', desc: '下一代闪电模型' },
              ].map((item) => {
                const isSelected = defaultModel === item.id;
                return (
                  <div
                    key={item.id}
                    class="settings-row"
                    onClick={() => handleDefaultModelChange(item.id)}
                  >
                    <div>
                      <div class="settings-row-label">{item.name}</div>
                      <div class="settings-row-desc">{item.desc}</div>
                    </div>
                    {isSelected && <CheckIcon size={16} className="text-accent" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Web Search Provider */}
          <div class="settings-section">
            <div class="settings-section-title">
              <SearchIcon size={14} />
              <span>联网搜索源 (Web Search Provider)</span>
            </div>
            <div class="settings-card">
              {[
                { id: 'antigravity', name: 'Antigravity (Google 搜索源)', desc: '支持精准实时联网与多源聚合（推荐）' },
                { id: 'deepseek-official', name: 'DeepSeek 官方搜索源', desc: 'DeepSeek 官方提供的搜索代理服务' },
              ].map((item) => {
                const isSelected = searchProvider === item.id;
                return (
                  <div
                    key={item.id}
                    class="settings-row"
                    onClick={() => handleSearchProviderChange(item.id)}
                  >
                    <div>
                      <div class="settings-row-label">{item.name}</div>
                      <div class="settings-row-desc">{item.desc}</div>
                    </div>
                    {isSelected && <CheckIcon size={16} className="text-accent" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Sandbox Permission Presets */}
          <div class="settings-section">
            <div class="settings-section-title">
              <ShieldIcon size={14} />
              <span>沙箱与审批策略 (Permissions)</span>
            </div>
            <div class="settings-card">
              {[
                { id: 'danger-full-access', name: 'Full Access (完全放行)', desc: '完全访问文件与工具，自动执行不弹窗' },
                { id: 'workspace-write', name: 'Workspace Write (工作区写入)', desc: '限制在工作区，越界操作需单次弹窗确认' },
                { id: 'read-only', name: 'Read Only (只读安全模式)', desc: '禁止修改任何文件或执行写命令' },
              ].map((item) => {
                const isSelected = defaultPreset === item.id;
                return (
                  <div
                    key={item.id}
                    class="settings-row"
                    onClick={() => handleDefaultPresetChange(item.id)}
                  >
                    <div>
                      <div class="settings-row-label">{item.name}</div>
                      <div class="settings-row-desc">{item.desc}</div>
                    </div>
                    {isSelected && <CheckIcon size={16} className="text-warning" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Appearance Theme */}
          <div class="settings-section">
            <div class="settings-section-title">
              <SparklesIcon size={14} />
              <span>界面外观 (Theme)</span>
            </div>
            <div class="settings-card">
              {[
                { id: 'dark', name: '🌙 暗黑深色模式 (Dark)', desc: '默认黑夜色系，OLED 省电且护眼' },
                { id: 'light', name: '☀️ 明亮浅色模式 (Light)', desc: '清新白色风格，适合户外强光阅读' },
              ].map((item) => {
                const isSelected = theme === item.id;
                return (
                  <div
                    key={item.id}
                    class="settings-row"
                    onClick={() => handleThemeChange(item.id)}
                  >
                    <div>
                      <div class="settings-row-label">{item.name}</div>
                      <div class="settings-row-desc">{item.desc}</div>
                    </div>
                    {isSelected && <CheckIcon size={16} className="text-accent" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Session Stats & Usage */}
          {stats && (
            <div class="settings-section">
              <div class="settings-section-title">
                <span>当前会话用量与统计</span>
              </div>
              <div class="settings-card" style="padding: 12px 14px; gap: 8px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px;">
                  <span style="color: var(--text-secondary);">执行总轮次 / 步骤</span>
                  <span style="font-weight: 600; color: var(--text-primary);">{stats.turns || 0} 轮 / {stats.steps || 0} 步</span>
                </div>
                {tokenUsage && (
                  <>
                    <div style="display: flex; justify-content: space-between; font-size: 13px;">
                      <span style="color: var(--text-secondary);">输出 Token</span>
                      <span style="font-weight: 600; color: var(--text-primary);">{tokenUsage.outputTokens?.toLocaleString() || 0}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 13px;">
                      <span style="color: var(--text-secondary);">缓存读取 Token (Cache Read)</span>
                      <span style="font-weight: 600; color: var(--success);">{tokenUsage.cacheReadTokens?.toLocaleString() || 0}</span>
                    </div>
                  </>
                )}
                {stats.llmMs !== undefined && (
                  <div style="display: flex; justify-content: space-between; font-size: 13px;">
                    <span style="color: var(--text-secondary);">模型推理总耗时</span>
                    <span style="font-weight: 600; color: var(--text-primary);">{(stats.llmMs / 1000).toFixed(1)} 秒</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 6. Active Plugins Info */}
          <div class="settings-section" style="margin-bottom: 8px;">
            <div class="settings-section-title">
              <span>已挂载插件套件</span>
            </div>
            <div class="settings-card" style="padding: 12px 14px; gap: 6px; font-size: 12px; color: var(--text-muted);">
              <div class="flex items-center justify-between">
                <span>⚡ dsh-mobile-webui</span>
                <span class="text-success">active (Port 3080 /mobile)</span>
              </div>
              <div class="flex items-center justify-between">
                <span>🤖 dsh-llm-antigravity</span>
                <span class="text-success">active (Gemini 3.7)</span>
              </div>
              <div class="flex items-center justify-between">
                <span>🌐 dsh-web-search-selector</span>
                <span class="text-success">active</span>
              </div>
              <div class="flex items-center justify-between">
                <span>🛡️ dsh-fail-soft</span>
                <span class="text-success">active</span>
              </div>
              <div class="flex items-center justify-between">
                <span>☁️ dsh-cloudflare-tunnel</span>
                <span class="text-success">online</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
