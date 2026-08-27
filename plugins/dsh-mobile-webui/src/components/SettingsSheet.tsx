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
  CopyIcon,
  TerminalIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from './Icons';

export function SettingsSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): VNode | null {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'general' | 'models' | 'plugins' | 'yaml'>('general');

  // General Settings
  const [theme, setThemeState] = useState<string>(
    localStorage.getItem('dsh_mobile_theme') || 'dark'
  );
  const [locale, setLocaleState] = useState<string>(
    localStorage.getItem('dsh_mobile_locale') || 'zh-CN'
  );
  const [defaultPreset, setDefaultPreset] = useState<string>('danger-full-access');
  const [maxParallelTools, setMaxParallelTools] = useState<number>(10);
  const [shellTimeout, setShellTimeout] = useState<number>(60000);

  // Model & Provider Settings
  const [defaultProvider, setDefaultProvider] = useState<string>('antigravity');
  const [defaultModel, setDefaultModel] = useState<string>('gemini-3.7-flash-high');
  const [reasoningEffort, setReasoningEffort] = useState<string>('high');

  // Dynamic Open Plugins state
  const [rawNamespaces, setRawNamespaces] = useState<any[]>([]);
  const [selectedPluginNs, setSelectedPluginNs] = useState<string | null>(null);
  const [dynamicFormState, setDynamicFormState] = useState<Record<string, any>>({});
  const [activePluginSubTab, setActivePluginSubTab] = useState<'quota' | 'usage' | 'config'>('quota');

  // Antigravity Live Dashboard states
  const [quotaData, setQuotaData] = useState<any>(null);
  const [loadingQuota, setLoadingQuota] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<any>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [clearingUsage, setClearingUsage] = useState(false);
  const [draftToken, setDraftToken] = useState('');
  const [draftBaseUrl, setDraftBaseUrl] = useState('');

  // UI status
  const [saving, setSaving] = useState(false);
  const [savedTip, setSavedTip] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadAllGlobalSettings();
  }, []);

  const loadAllGlobalSettings = async () => {
    try {
      const res = await store.client.rpc<{ namespaces: any[] }>('settings.describe');
      if (res && Array.isArray(res.namespaces)) {
        setRawNamespaces(res.namespaces);

        for (const ns of res.namespaces) {
          const val = ns.user || ns.resolved || ns.base || {};
          if (ns.ns === 'agent-default-model') {
            if (val.provider) setDefaultProvider(val.provider);
            if (val.model) setDefaultModel(val.model);
            if (val.reasoningEffort) setReasoningEffort(val.reasoningEffort);
          } else if (ns.ns === 'permission') {
            if (val.defaultPreset) setDefaultPreset(val.defaultPreset);
          } else if (ns.ns === 'agent-loop') {
            if (val.maxParallelToolCalls) setMaxParallelTools(val.maxParallelToolCalls);
          } else if (ns.ns === 'shell') {
            if (val.timeoutMs) setShellTimeout(val.timeoutMs);
          } else if (ns.ns === 'locale') {
            if (val.locale) setLocaleState(val.locale);
          } else if (ns.ns === 'ui-theme') {
            if (val.theme) setThemeState(val.theme);
          } else if (ns.ns === 'llm-antigravity') {
            if (val.baseURL) setDraftBaseUrl(val.baseURL);
          }
        }
      }
    } catch (e) {
      console.error('[mobile-settings] loadAllGlobalSettings error:', e);
    }
  };

  const showSavedToast = () => {
    setSavedTip(true);
    setTimeout(() => setSavedTip(false), 2000);
  };

  // Mutate backend namespace
  const updateNamespace = async (ns: string, patch: Record<string, any>) => {
    setSaving(true);
    try {
      await store.client.rpc('settings.update', {
        ns,
        patch,
      });
      showSavedToast();
      loadAllGlobalSettings();
    } catch (e) {
      console.error(`[mobile-settings] Failed to update ${ns}:`, e);
    } finally {
      setSaving(false);
    }
  };

  // Antigravity quota & usage fetchers
  const fetchAntigravityQuota = async (force = false) => {
    setLoadingQuota(true);
    setQuotaError(null);
    try {
      const res = await fetch(`/api/antigravity/quota${force ? '?force=true' : ''}`, {
        method: force ? 'POST' : 'GET',
      });
      if (res.ok) {
        const data = await res.json();
        setQuotaData(data);
      } else {
        const text = await res.text().catch(() => '');
        setQuotaError(`HTTP ${res.status}: ${text.slice(0, 100) || '获取失败'}`);
      }
    } catch (err: any) {
      setQuotaError(err?.message || '网络连接失败');
    } finally {
      setLoadingQuota(false);
    }
  };

  const fetchAntigravityUsage = async () => {
    setLoadingUsage(true);
    try {
      const res = await fetch('/api/antigravity/usage');
      if (res.ok) {
        const data = await res.json();
        setUsageData(data);
      }
    } catch (err) {
      console.error('[Antigravity] usage fetch failed:', err);
    } finally {
      setLoadingUsage(false);
    }
  };

  const clearAntigravityUsage = async () => {
    if (!confirm('确定清空所有 Antigravity 历史调用统计记录吗？')) return;
    setClearingUsage(true);
    try {
      await fetch('/api/antigravity/clear-usage', { method: 'POST' });
      await fetchAntigravityUsage();
    } catch (err) {
      console.error(err);
    } finally {
      setClearingUsage(false);
    }
  };

  const saveAntigravityConfig = async () => {
    setSaving(true);
    try {
      if (draftToken.trim()) {
        await store.client.rpc('credentials.set', {
          ref: 'ANTIGRAVITY_REFRESH_TOKEN',
          value: draftToken.trim(),
        }).catch(() => {});
      }
      if (draftBaseUrl.trim()) {
        await updateNamespace('llm-antigravity', { baseURL: draftBaseUrl.trim() });
      }
      showSavedToast();
      fetchAntigravityQuota(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Handlers
  const handleThemeChange = (newTheme: string) => {
    setThemeState(newTheme);
    localStorage.setItem('dsh_mobile_theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    updateNamespace('ui-theme', { theme: newTheme });
  };

  const handleLocaleChange = (newLoc: string) => {
    setLocaleState(newLoc);
    localStorage.setItem('dsh_mobile_locale', newLoc);
    updateNamespace('locale', { locale: newLoc });
  };

  const handleDefaultPresetChange = async (preset: string) => {
    setDefaultPreset(preset);
    await updateNamespace('permission', { defaultPreset: preset });
    await store.setPermissionPreset(preset);
  };

  const handleParallelToolsChange = async (count: number) => {
    setMaxParallelTools(count);
    await updateNamespace('agent-loop', { maxParallelToolCalls: count });
  };

  const handleShellTimeoutChange = async (ms: number) => {
    setShellTimeout(ms);
    await updateNamespace('shell', { timeoutMs: ms });
  };

  const handleDefaultModelChange = async (mId: string, prov = 'antigravity') => {
    setDefaultModel(mId);
    setDefaultProvider(prov);
    await updateNamespace('agent-default-model', {
      provider: prov,
      model: mId,
      reasoningEffort,
    });
    await store.selectModel(mId, prov);
  };

  const handleReasoningEffortChange = async (effort: string) => {
    setReasoningEffort(effort);
    await updateNamespace('agent-default-model', {
      provider: defaultProvider,
      model: defaultModel,
      reasoningEffort: effort,
    });
  };

  // Open dynamic form handlers for any plugin namespace
  const handleOpenPlugin = (ns: string) => {
    setSelectedPluginNs(ns);
    const nsObj = rawNamespaces.find(n => n.ns === ns);
    const currentVal = nsObj ? (nsObj.user || nsObj.resolved || nsObj.base || {}) : {};
    setDynamicFormState({ ...currentVal });

    if (ns === 'llm-antigravity' || ns === 'dsh-llm-antigravity') {
      fetchAntigravityQuota();
      fetchAntigravityUsage();
    }
  };

  const handleSaveDynamicNamespace = async (ns: string) => {
    await updateNamespace(ns, dynamicFormState);
  };

  // Format countdown for quota resets
  const formatSeconds = (sec?: number) => {
    if (!sec || sec <= 0) return '即将重置';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs > 0) return `${hrs}小时 ${mins}分`;
    return `${mins}分钟`;
  };

  // Generate live YAML preview of settings
  const yamlLines: string[] = [];
  for (const item of rawNamespaces) {
    const val = item.user || item.resolved || item.base;
    if (val && Object.keys(val).length > 0) {
      yamlLines.push(`${item.ns}:`);
      for (const [k, v] of Object.entries(val)) {
        if (typeof v === 'object') {
          yamlLines.push(`  ${k}: ${JSON.stringify(v)}`);
        } else {
          yamlLines.push(`  ${k}: ${v}`);
        }
      }
    }
  }
  const yamlContent = yamlLines.length > 0 ? yamlLines.join('\n') : `# ~/.dsh/settings.yaml\nagent-default-model:\n  provider: ${defaultProvider}\n  model: ${defaultModel}\npermission:\n  defaultPreset: ${defaultPreset}`;

  const copyYaml = () => {
    navigator.clipboard.writeText(yamlContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet-card" onClick={(e) => e.stopPropagation()} style="max-height: 90dvh;">
        <div class="sheet-handle-bar">
          <div class="sheet-handle"></div>
        </div>

        {/* Modal Header */}
        <div class="sheet-header">
          <div class="flex items-center gap-2">
            <span style="font-size: 18px;">⚙️</span>
            <span class="sheet-title">系统全局设置 (Global Settings)</span>
            {saving && <LoaderIcon size={14} className="text-accent" />}
            {savedTip && (
              <span class="status-badge completed" style="font-size: 11px;">
                <CheckCircleIcon size={11} />
                <span>已同步</span>
              </span>
            )}
          </div>
          <button class="icon-btn" onClick={onClose} aria-label="关闭设置">
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Top Tab Navigation */}
        <div class="settings-tabs">
          <button
            class={`settings-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            🛠️ 通用系统
          </button>
          <button
            class={`settings-tab-btn ${activeTab === 'models' ? 'active' : ''}`}
            onClick={() => setActiveTab('models')}
          >
            🧠 默认模型
          </button>
          <button
            class={`settings-tab-btn ${activeTab === 'plugins' ? 'active' : ''}`}
            onClick={() => setActiveTab('plugins')}
          >
            🔌 开放插件
          </button>
          <button
            class={`settings-tab-btn ${activeTab === 'yaml' ? 'active' : ''}`}
            onClick={() => setActiveTab('yaml')}
          >
            📄 YAML 配置
          </button>
        </div>

        {/* Tab Content */}
        <div class="sheet-content">
          {/* ================= TAB 1: 通用设置 ================= */}
          {activeTab === 'general' && (
            <div>
              {/* Theme */}
              <div class="settings-section">
                <div class="settings-section-title">
                  <SparklesIcon size={14} />
                  <span>外观与主题 (Theme)</span>
                </div>
                <div class="settings-card">
                  {[
                    { id: 'dark', name: '🌙 暗黑深色 (Dark)', desc: 'OLED 极夜纯黑配色，省电护眼' },
                    { id: 'light', name: '☀️ 清新明亮 (Light)', desc: '经典白亮高对比度，户外阅读更清晰' },
                  ].map((item) => (
                    <div
                      key={item.id}
                      class="settings-row"
                      onClick={() => handleThemeChange(item.id)}
                    >
                      <div>
                        <div class="settings-row-label">{item.name}</div>
                        <div class="settings-row-desc">{item.desc}</div>
                      </div>
                      {theme === item.id && <CheckIcon size={16} className="text-accent" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div class="settings-section">
                <div class="settings-section-title">
                  <span>🌐 界面语言 (Language)</span>
                </div>
                <div class="settings-card">
                  {[
                    { id: 'zh-CN', name: '🇨🇳 简体中文 (Chinese)', desc: '默认界面语言' },
                    { id: 'en-US', name: '🇺🇸 English (英文)', desc: 'English UI Localization' },
                  ].map((item) => (
                    <div
                      key={item.id}
                      class="settings-row"
                      onClick={() => handleLocaleChange(item.id)}
                    >
                      <div>
                        <div class="settings-row-label">{item.name}</div>
                        <div class="settings-row-desc">{item.desc}</div>
                      </div>
                      {locale === item.id && <CheckIcon size={16} className="text-accent" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Default Permissions */}
              <div class="settings-section">
                <div class="settings-section-title">
                  <ShieldIcon size={14} />
                  <span>全局默认沙箱权限 (Permission Preset)</span>
                </div>
                <div class="settings-card">
                  {[
                    { id: 'danger-full-access', name: 'Full Access (完全放行 - 推荐)', desc: '完全访问文件与工具命令，无需频繁手动确认' },
                    { id: 'workspace-write', name: 'Workspace Write (仅工作区写入)', desc: '限制在工作区读写，越界操作需单次弹窗确认' },
                    { id: 'read-only', name: 'Read Only (只读安全)', desc: '禁止任何写操作与破坏性工具' },
                  ].map((item) => (
                    <div
                      key={item.id}
                      class="settings-row"
                      onClick={() => handleDefaultPresetChange(item.id)}
                    >
                      <div>
                        <div class="settings-row-label">{item.name}</div>
                        <div class="settings-row-desc">{item.desc}</div>
                      </div>
                      {defaultPreset === item.id && <CheckIcon size={16} className="text-warning" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Agent Loop & Shell Settings */}
              <div class="settings-section">
                <div class="settings-section-title">
                  <TerminalIcon size={14} />
                  <span>执行引擎参数 (Execution Engine)</span>
                </div>
                <div class="settings-card">
                  <div class="settings-row" style="cursor: default;">
                    <div>
                      <div class="settings-row-label">最大并行工具调用数</div>
                      <div class="settings-row-desc">agent-loop.maxParallelToolCalls</div>
                    </div>
                    <select
                      class="settings-select"
                      value={maxParallelTools}
                      onChange={(e: any) => handleParallelToolsChange(Number(e.target.value))}
                    >
                      <option value={5}>5 个并发</option>
                      <option value={10}>10 个并发 (默认)</option>
                      <option value={20}>20 个并发</option>
                    </select>
                  </div>
                  <div class="settings-row" style="cursor: default;">
                    <div>
                      <div class="settings-row-label">Shell 命令执行超时</div>
                      <div class="settings-row-desc">shell.timeoutMs</div>
                    </div>
                    <select
                      class="settings-select"
                      value={shellTimeout}
                      onChange={(e: any) => handleShellTimeoutChange(Number(e.target.value))}
                    >
                      <option value={30000}>30 秒</option>
                      <option value={60000}>60 秒 (默认)</option>
                      <option value={120000}>120 秒</option>
                      <option value={300000}>300 秒</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: 模型与提供方 ================= */}
          {activeTab === 'models' && (
            <div>
              <div class="settings-section">
                <div class="settings-section-title">
                  <CpuIcon size={14} />
                  <span>新建会话默认 Agent 模型 (Default Model)</span>
                </div>
                <div class="settings-card">
                  {[
                    { id: 'gemini-3.7-flash-high', prov: 'antigravity', name: 'Gemini 3.7 Flash High', desc: '深度思考推理旗舰模型（推荐）' },
                    { id: 'gemini-2.5-flash', prov: 'antigravity', name: 'Gemini 2.5 Flash', desc: '极速低延迟，适合轻量快速问答' },
                    { id: 'gemini-2.5-pro', prov: 'antigravity', name: 'Gemini 2.5 Pro', desc: '百万上下文窗口，复杂代码重构' },
                    { id: 'gemini-3-flash', prov: 'antigravity', name: 'Gemini 3 Flash', desc: '下一代极速多模态模型' },
                    { id: 'deepseek-v4-flash', prov: 'deepseek-official', name: 'DeepSeek-V4-Flash', desc: 'DeepSeek 官方推理大模型' },
                    { id: 'claude-sonnet-4-6', prov: 'antigravity', name: 'Claude Sonnet 4.6', desc: 'Claude 代码能力模型' },
                  ].map((m) => {
                    const isSelected = defaultModel === m.id && defaultProvider === m.prov;
                    return (
                      <div
                        key={`${m.prov}-${m.id}`}
                        class="settings-row"
                        onClick={() => handleDefaultModelChange(m.id, m.prov)}
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

              <div class="settings-section">
                <div class="settings-section-title">
                  <span>🧠 默认思考等级 (Reasoning Effort)</span>
                </div>
                <div class="settings-card">
                  {[
                    { id: 'high', name: 'High (深度思考 - 推荐)', desc: '充分展开思维链，最强逻辑与代码推理' },
                    { id: 'medium', name: 'Medium (中等思考)', desc: '平衡思考深度与响应速度' },
                    { id: 'low', name: 'Low (快速生成)', desc: '缩减思考过程，追求首字响应时延' },
                  ].map((eff) => (
                    <div
                      key={eff.id}
                      class="settings-row"
                      onClick={() => handleReasoningEffortChange(eff.id)}
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
            </div>
          )}

          {/* ================= TAB 3: 开放插件体系 (Open Plugins & Extensions) ================= */}
          {activeTab === 'plugins' && (
            <div>
              {/* If a specific plugin is selected to view */}
              {selectedPluginNs ? (
                <div>
                  {/* Back button */}
                  <div class="flex items-center justify-between mb-3">
                    <button
                      class="chip-btn"
                      onClick={() => setSelectedPluginNs(null)}
                      style="font-size: 12px; padding: 4px 10px;"
                    >
                      ← 返回已挂载插件列表
                    </button>
                    <span style="font-weight: 600; font-size: 13px; color: var(--accent-primary);">
                      {selectedPluginNs}
                    </span>
                  </div>

                  {/* SPECIALIZED DASHBOARD: llm-antigravity / dsh-llm-antigravity */}
                  {(selectedPluginNs === 'llm-antigravity' || selectedPluginNs === 'dsh-llm-antigravity') ? (
                    <div>
                      {/* Sub tab nav */}
                      <div class="settings-tabs" style="margin-bottom: 12px;">
                        <button
                          class={`settings-tab-btn ${activePluginSubTab === 'quota' ? 'active' : ''}`}
                          onClick={() => setActivePluginSubTab('quota')}
                        >
                          📊 实时额度
                        </button>
                        <button
                          class={`settings-tab-btn ${activePluginSubTab === 'usage' ? 'active' : ''}`}
                          onClick={() => setActivePluginSubTab('usage')}
                        >
                          📈 用量统计
                        </button>
                        <button
                          class={`settings-tab-btn ${activePluginSubTab === 'config' ? 'active' : ''}`}
                          onClick={() => setActivePluginSubTab('config')}
                        >
                          ⚙️ 基本配置
                        </button>
                      </div>

                      {/* SubTab 1: Quota */}
                      {activePluginSubTab === 'quota' && (
                        <div class="settings-card" style="padding: 14px; gap: 12px;">
                          <div class="flex items-center justify-between">
                            <div>
                              <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">Google Antigravity 实时额度</div>
                              <div style="font-size: 11px; color: var(--text-muted);">
                                关联项目: {quotaData?.projectId || '未指定'} • 权益: {quotaData?.tier || 'Pro'}
                              </div>
                            </div>
                            <button
                              class="chip-btn"
                              onClick={() => fetchAntigravityQuota(true)}
                              disabled={loadingQuota}
                              style="font-size: 11px; padding: 3px 8px;"
                            >
                              {loadingQuota ? <LoaderIcon size={12} /> : '🔄 刷新'}
                            </button>
                          </div>

                          {quotaError ? (
                            <div style="color: #ef4444; font-size: 12px; padding: 8px; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-sm);">
                              {quotaError}
                            </div>
                          ) : quotaData ? (
                            <div>
                              {/* 5-Hour limit */}
                              {quotaData.limit5h && (
                                <div style="margin-bottom: 12px;">
                                  <div class="flex items-center justify-between" style="font-size: 12px;">
                                    <span style="font-weight: 500; color: var(--text-secondary);">5小时限额剩余</span>
                                    <span style="font-weight: 700; color: quotaData.limit5h.pctRemaining < 20 ? '#ef4444' : 'var(--accent-primary)';">
                                      {quotaData.limit5h.pctRemaining}% ({formatSeconds(quotaData.limit5h.resetsInSeconds)}后重置)
                                    </span>
                                  </div>
                                  <div class="quota-progress-track">
                                    <div
                                      class="quota-progress-fill"
                                      style={{
                                        width: `${Math.max(0, Math.min(100, quotaData.limit5h.pctRemaining))}%`,
                                        background: quotaData.limit5h.pctRemaining < 20 ? '#ef4444' : 'var(--accent-primary)',
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Models quota list */}
                              {Array.isArray(quotaData.models) && (
                                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                                  <div style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">分模型额度状态:</div>
                                  {quotaData.models.map((m: any, idx: number) => (
                                    <div key={idx} style="background: var(--bg-tertiary); padding: 8px 10px; border-radius: var(--radius-sm);">
                                      <div class="flex items-center justify-between" style="font-size: 12px;">
                                        <span style="font-weight: 500; color: var(--text-primary);">{m.modelId || m.name}</span>
                                        <span style="color: var(--accent-primary); font-weight: 600;">{m.pctRemaining ?? 100}%</span>
                                      </div>
                                      <div class="quota-progress-track" style="margin: 4px 0 2px;">
                                        <div
                                          class="quota-progress-fill"
                                          style={{
                                            width: `${Math.max(0, Math.min(100, m.pctRemaining ?? 100))}%`,
                                            background: (m.pctRemaining ?? 100) < 20 ? '#ef4444' : '#10b981',
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 16px;">
                              {loadingQuota ? '正在查询最新额度...' : '点击刷新查询实时额度'}
                            </div>
                          )}
                        </div>
                      )}

                      {/* SubTab 2: Usage */}
                      {activePluginSubTab === 'usage' && (
                        <div class="settings-card" style="padding: 14px; gap: 12px;">
                          <div class="flex items-center justify-between">
                            <span style="font-weight: 600; font-size: 14px; color: var(--text-primary);">Token 用量统计</span>
                            <div class="flex items-center gap-2">
                              <button
                                class="chip-btn"
                                onClick={fetchAntigravityUsage}
                                disabled={loadingUsage}
                                style="font-size: 11px; padding: 3px 8px;"
                              >
                                {loadingUsage ? <LoaderIcon size={12} /> : '刷新'}
                              </button>
                              <button
                                class="chip-btn"
                                onClick={clearAntigravityUsage}
                                disabled={clearingUsage}
                                style="font-size: 11px; padding: 3px 8px; color: #ef4444;"
                              >
                                清空
                              </button>
                            </div>
                          </div>

                          <div class="plugin-metric-grid">
                            <div class="plugin-metric-box">
                              <span class="plugin-metric-label">调用总次数</span>
                              <span class="plugin-metric-value">{usageData?.totalRequests ?? 0}</span>
                            </div>
                            <div class="plugin-metric-box">
                              <span class="plugin-metric-label">输入 Tokens</span>
                              <span class="plugin-metric-value">{(usageData?.totalInput ?? 0).toLocaleString()}</span>
                            </div>
                            <div class="plugin-metric-box">
                              <span class="plugin-metric-label">输出 Tokens</span>
                              <span class="plugin-metric-value">{(usageData?.totalOutput ?? 0).toLocaleString()}</span>
                            </div>
                            <div class="plugin-metric-box">
                              <span class="plugin-metric-label">缓存命中率</span>
                              <span class="plugin-metric-value" style="color: #10b981;">{usageData?.cacheHitRate ?? '0%'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* SubTab 3: Config */}
                      {activePluginSubTab === 'config' && (
                        <div class="settings-card" style="padding: 14px; gap: 12px;">
                          <div>
                            <label style="font-size: 12px; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">
                              OAuth 2.0 Refresh Token
                            </label>
                            <input
                              type="password"
                              class="settings-input"
                              placeholder="填入 Refresh Token（留空保持不变）"
                              value={draftToken}
                              onInput={(e: any) => setDraftToken(e.target.value)}
                            />
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                              保存在系统凭据服务中，用于自动换取 Google Cloud Code 访问凭证
                            </div>
                          </div>

                          <div>
                            <label style="font-size: 12px; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">
                              Base URL 接口端点
                            </label>
                            <input
                              type="text"
                              class="settings-input"
                              placeholder="https://daily-cloudcode-pa.googleapis.com/v1internal"
                              value={draftBaseUrl}
                              onInput={(e: any) => setDraftBaseUrl(e.target.value)}
                            />
                          </div>

                          <button
                            class="chip-btn"
                            style="background: var(--accent-primary); color: #fff; border-color: transparent; height: 38px; font-weight: 600; justify-content: center;"
                            onClick={saveAntigravityConfig}
                            disabled={saving}
                          >
                            {saving ? <LoaderIcon size={14} /> : <CheckIcon size={14} />}
                            <span>保存配置</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* UNIVERSAL DYNAMIC SCHEMA FORM for any other plugin namespace */
                    <div class="settings-card" style="padding: 14px; gap: 12px;">
                      <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">
                        命名空间参数配置 ({selectedPluginNs})
                      </div>
                      <div style="font-size: 11px; color: var(--text-muted);">
                        由插件自身声明的配置项，修改后自动同步至 Cordis 运行时
                      </div>

                      {Object.keys(dynamicFormState).length === 0 ? (
                        <div style="font-size: 12px; color: var(--text-muted); padding: 12px 0;">
                          该插件暂未声明公开属性或使用默认配置。
                        </div>
                      ) : (
                        Object.entries(dynamicFormState).map(([key, val]) => {
                          const isBool = typeof val === 'boolean';
                          const isNum = typeof val === 'number';

                          return (
                            <div key={key} style="display: flex; flex-direction: column; gap: 4px; padding-bottom: 8px; border-bottom: 1px solid var(--border-subtle);">
                              <label style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">
                                {key}
                              </label>
                              {isBool ? (
                                <select
                                  class="settings-select"
                                  value={String(val)}
                                  onChange={(e: any) => setDynamicFormState({ ...dynamicFormState, [key]: e.target.value === 'true' })}
                                >
                                  <option value="true">true (启用)</option>
                                  <option value="false">false (禁用)</option>
                                </select>
                              ) : isNum ? (
                                <input
                                  type="number"
                                  class="settings-input"
                                  value={val}
                                  onInput={(e: any) => setDynamicFormState({ ...dynamicFormState, [key]: Number(e.target.value) })}
                                />
                              ) : (
                                <input
                                  type="text"
                                  class="settings-input"
                                  value={String(val || '')}
                                  onInput={(e: any) => setDynamicFormState({ ...dynamicFormState, [key]: e.target.value })}
                                />
                              )}
                            </div>
                          );
                        })
                      )}

                      <button
                        class="chip-btn"
                        style="background: var(--accent-primary); color: #fff; border-color: transparent; height: 38px; font-weight: 600; justify-content: center; margin-top: 4px;"
                        onClick={() => handleSaveDynamicNamespace(selectedPluginNs)}
                        disabled={saving}
                      >
                        {saving ? <LoaderIcon size={14} /> : <CheckIcon size={14} />}
                        <span>保存此插件配置</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* OPEN PLUGIN ROSTER: Dynamically discovered namespaces and plugins */
                <div>
                  <div class="settings-section">
                    <div class="settings-section-title">
                      <span>📦 运行实例已挂载插件与命名空间 (Open Plugins)</span>
                    </div>
                    <div class="settings-card" style="padding: 10px 14px; gap: 8px;">
                      {rawNamespaces.length === 0 ? (
                        <div style="font-size: 12px; color: var(--text-muted); padding: 12px; text-align: center;">
                          正在自省发现插件...
                        </div>
                      ) : (
                        rawNamespaces.map((nsItem) => {
                          const nsName = nsItem.ns;
                          return (
                            <div
                              key={nsName}
                              class="flex items-center justify-between py-2"
                              style="border-bottom: 1px solid var(--border-subtle); cursor: pointer;"
                              onClick={() => handleOpenPlugin(nsName)}
                            >
                              <div style="min-width: 0; flex: 1; padding-right: 8px;">
                                <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                                  <span>🔌 {nsItem.title || nsName}</span>
                                </div>
                                <div style="color: var(--text-muted); font-size: 11px; margin-top: 2px;">
                                  命名空间: <code style="color: var(--accent-primary);">{nsName}</code>
                                </div>
                              </div>
                              <div class="flex items-center gap-2">
                                <span class="status-badge completed" style="font-size: 10px;">Active</span>
                                <ChevronRightIcon size={14} className="text-muted" />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Network Tunnel Status */}
                  <div class="settings-section">
                    <div class="settings-section-title">
                      <span>☁️ Cloudflare Quick Tunnel 穿透</span>
                    </div>
                    <div class="settings-card" style="padding: 12px 14px; gap: 8px; font-size: 12px;">
                      <div class="flex items-center justify-between">
                        <span style="color: var(--text-secondary);">服务状态</span>
                        <span class="status-badge completed">在线 Online</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span style="color: var(--text-secondary);">Worker 路由域名</span>
                        <a href="https://dsh.b-1.workers.dev" target="_blank" style="color: var(--accent-primary); text-decoration: none;">dsh.b-1.workers.dev</a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 4: 配置文件 (YAML) ================= */}
          {activeTab === 'yaml' && (
            <div>
              <div class="settings-section">
                <div class="flex items-center justify-between mb-2">
                  <div class="settings-section-title" style="margin-bottom: 0;">
                    <span>📄 ~/.dsh/settings.yaml 实时全局配置</span>
                  </div>
                  <button
                    class="chip-btn"
                    onClick={copyYaml}
                    style="font-size: 11px; padding: 3px 8px;"
                  >
                    {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                    <span>{copied ? '已复制' : '复制配置'}</span>
                  </button>
                </div>
                <pre style="background: #090d13; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 1.5; color: #7ee787; overflow-x: auto; white-space: pre-wrap;">
                  {yamlContent}
                </pre>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 8px; line-height: 1.4;">
                  💡 提示：在上方“通用”、“模型”与“插件”分栏中所作的每一项调整，均会自动热发布并持久化写入本配置文件。
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
