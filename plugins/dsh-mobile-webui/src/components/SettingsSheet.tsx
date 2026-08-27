import { h, VNode, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { store } from '../store/state';
import {
  CloseIcon,
  CpuIcon,
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

  // Dynamic Open Plugins state (Multi-level disclosure card model)
  const [rawNamespaces, setRawNamespaces] = useState<any[]>([]);
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({ 'llm-antigravity': true });
  const [draftEdits, setDraftEdits] = useState<Record<string, Record<string, any>>>({});
  const [activePluginSubTab, setActivePluginSubTab] = useState<'quota' | 'usage' | 'valuation' | 'config'>('quota');

  // Antigravity Live Dashboard states
  const [quotaData, setQuotaData] = useState<any>(null);
  const [loadingQuota, setLoadingQuota] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<any>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [clearingUsage, setClearingUsage] = useState(false);
  const [draftToken, setDraftToken] = useState('');
  const [draftBaseUrl, setDraftBaseUrl] = useState('');
  const [activeValPeriod, setActiveValPeriod] = useState<'5h' | 'weekly' | 'all'>('5h');
  const [mobilePricing, setMobilePricing] = useState<Record<string, { input: number; output: number; cache: number }>>(() => {
    try {
      const saved = localStorage.getItem('antigravity_pricing_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      'gemini-3.7-flash-high': { input: 0.10, output: 0.40, cache: 0.025 },
      'gemini-3.7-flash-medium': { input: 0.10, output: 0.40, cache: 0.025 },
      'gemini-3.7-flash-low': { input: 0.10, output: 0.40, cache: 0.025 },
      'gemini-2.5-pro': { input: 1.25, output: 5.00, cache: 0.3125 },
      'gemini-2.5-flash': { input: 0.10, output: 0.40, cache: 0.025 },
      'claude-sonnet-4-6': { input: 3.00, output: 15.00, cache: 0.30 },
      'claude-opus-4-6-thinking': { input: 15.00, output: 75.00, cache: 1.50 },
    };
  });

  // UI status
  const [savingNs, setSavingNs] = useState<string | null>(null);
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
          const val = ns.user || ns.value || ns.base || {};
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
    setSavingNs(ns);
    try {
      try {
        await store.client.rpc('settings.update', {
          ns,
          patch,
        });
      } catch {
        const ops = Object.entries(patch).map(([k, v]) => ({
          op: 'set' as const,
          path: [k],
          value: v,
        }));
        await store.client.rpc('settings.mutate', {
          ns,
          ops,
        });
      }
      showSavedToast();
      // Clear draft for this card
      setDraftEdits(prev => {
        const next = { ...prev };
        delete next[ns];
        return next;
      });
      await loadAllGlobalSettings();
    } catch (e) {
      console.error(`[mobile-settings] Failed to update ${ns}:`, e);
    } finally {
      setSavingNs(null);
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
        setUsageData(data.stats || data);
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
      await fetch('/api/antigravity/usage', { method: 'DELETE' });
      await fetchAntigravityUsage();
    } catch (err) {
      console.error(err);
    } finally {
      setClearingUsage(false);
    }
  };

  const saveAntigravityConfig = async () => {
    setSavingNs('llm-antigravity');
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
      setSavingNs(null);
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

  // Gemini model + reasoning effort mapping
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
    // If current model is a Gemini 3.7 / 3.6 tiered model, map to corresponding thinking tier
    let targetModel = defaultModel;
    if (defaultModel.startsWith('gemini-3.7-flash-')) {
      targetModel = `gemini-3.7-flash-${effort}`;
      setDefaultModel(targetModel);
    } else if (defaultModel.startsWith('gemini-3.6-flash-')) {
      targetModel = `gemini-3.6-flash-${effort}`;
      setDefaultModel(targetModel);
    }

    await updateNamespace('agent-default-model', {
      provider: defaultProvider,
      model: targetModel,
      reasoningEffort: effort,
    });
    await store.selectModel(targetModel, defaultProvider);
  };

  // Multi-level Card Toggle
  const toggleCard = (ns: string) => {
    const isOpening = !openCards[ns];
    setOpenCards(prev => ({ ...prev, [ns]: isOpening }));
    if (isOpening && (ns === 'llm-antigravity' || ns === 'dsh-llm-antigravity')) {
      fetchAntigravityQuota();
      fetchAntigravityUsage();
    }
  };

  // Card draft editing
  const editCardField = (ns: string, field: string, value: any) => {
    setDraftEdits(prev => {
      const cardDraft = prev[ns] || {};
      return {
        ...prev,
        [ns]: {
          ...cardDraft,
          [field]: value,
        },
      };
    });
  };

  const discardCardEdits = (ns: string) => {
    setDraftEdits(prev => {
      const next = { ...prev };
      delete next[ns];
      return next;
    });
  };

  const saveCardEdits = async (ns: string) => {
    const patch = draftEdits[ns] || {};
    await updateNamespace(ns, patch);
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
            {savingNs && <LoaderIcon size={14} className="text-accent" />}
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
            🔌 插件管理
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
                    { id: 'gemini-3.7-flash-medium', prov: 'antigravity', name: 'Gemini 3.7 Flash Medium', desc: '中等思考深度，平衡性能与时延' },
                    { id: 'gemini-3.7-flash-low', prov: 'antigravity', name: 'Gemini 3.7 Flash Low', desc: '极速低思考预算，适合轻量快速任务' },
                    { id: 'gemini-2.5-pro', prov: 'antigravity', name: 'Gemini 2.5 Pro', desc: '百万上下文窗口，复杂代码重构' },
                    { id: 'gemini-2.5-flash', prov: 'antigravity', name: 'Gemini 2.5 Flash', desc: '极速低延迟快速问答' },
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
                  <span>🧠 思考深度档位 (Reasoning Effort)</span>
                </div>
                <div class="settings-card">
                  {[
                    { id: 'high', name: 'High (深度思考 - 推荐)', desc: '充分展开思维链，最强逻辑与代码推理（路由至 gemini-3.7-flash-high）' },
                    { id: 'medium', name: 'Medium (中等思考)', desc: '平衡思考深度与响应速度（路由至 gemini-3.7-flash-medium）' },
                    { id: 'low', name: 'Low (快速生成)', desc: '缩减思考过程，追求首字响应时延（路由至 gemini-3.7-flash-low）' },
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

          {/* ================= TAB 3: 原版多层级折叠卡片列表 (Disclosure Plugin Cards) ================= */}
          {activeTab === 'plugins' && (
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <div class="settings-section-title" style="margin-bottom: 4px;">
                <span>🔌 已注册插件配置列表 (Plugin Cards)</span>
              </div>

              {rawNamespaces.length === 0 ? (
                <div style="font-size: 12px; color: var(--text-muted); padding: 20px; text-align: center;">
                  正在自省发现插件配置...
                </div>
              ) : (
                rawNamespaces.map((nsItem) => {
                  const ns = nsItem.ns;
                  const isOpen = Boolean(openCards[ns]);
                  const resolvedVal = nsItem.user || nsItem.value || nsItem.base || {};
                  const stagedDraft = draftEdits[ns] || {};
                  const currentEffective = { ...resolvedVal, ...stagedDraft };
                  const isDirty = Object.keys(stagedDraft).length > 0;
                  const isSavingThis = savingNs === ns;

                  return (
                    <div
                      key={ns}
                      style={{
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        background: isOpen ? 'var(--bg-secondary)' : 'var(--bg-card)',
                        overflow: 'hidden',
                        transition: 'background 0.2s, border-color 0.2s',
                      }}
                    >
                      {/* Multi-level Card Header */}
                      <button
                        type="button"
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          border: 0,
                          background: 'transparent',
                          color: 'inherit',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        onClick={() => toggleCard(ns)}
                        aria-expanded={isOpen}
                      >
                        <div style="min-width: 0; flex: 1; padding-right: 8px;">
                          <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-weight: 600; font-size: 14px; color: var(--text-primary);">
                              {nsItem.title || ns}
                            </span>
                            {isDirty && (
                              <span style="font-size: 11px; color: #f59e0b; font-weight: 500;">
                                • 未保存修改
                              </span>
                            )}
                          </div>
                          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                            {nsItem.description || `命名空间: ${ns}`}
                          </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 8px;">
                          <span class="status-badge completed" style="font-size: 10px;">Active</span>
                          <span style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', color: 'var(--text-muted)' }}>
                            ▾
                          </span>
                        </div>
                      </button>

                      {/* Multi-level Card Body (Expanded inline) */}
                      {isOpen && (
                        <div style="padding: 0 14px 14px; border-top: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 12px; margin-top: 4px; padding-top: 12px;">
                          {/* Case A: Antigravity rich interactive dashboard */}
                          {(ns === 'llm-antigravity' || ns === 'dsh-llm-antigravity') ? (
                            <div>
                              {/* Sub tabs */}
                              <div class="settings-tabs" style="margin-bottom: 10px;">
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
                                  class={`settings-tab-btn ${activePluginSubTab === 'valuation' ? 'active' : ''}`}
                                  onClick={() => setActivePluginSubTab('valuation')}
                                >
                                  💰 额度估算
                                </button>
                                <button
                                  class={`settings-tab-btn ${activePluginSubTab === 'config' ? 'active' : ''}`}
                                  onClick={() => setActivePluginSubTab('config')}
                                >
                                  ⚙️ 凭据配置
                                </button>
                              </div>

                              {activePluginSubTab === 'quota' && (
                                <div style="display: flex; flex-direction: column; gap: 10px;">
                                  <div class="flex items-center justify-between">
                                    <span style="font-size: 12px; color: var(--text-muted);">
                                      项目: {quotaData?.projectId || '自动识别'} • 权益: {quotaData?.tier || 'Pro'}
                                    </span>
                                    <button
                                      class="chip-btn"
                                      onClick={() => fetchAntigravityQuota(true)}
                                      disabled={loadingQuota}
                                      style="font-size: 11px; padding: 2px 8px;"
                                    >
                                      {loadingQuota ? <LoaderIcon size={12} /> : '🔄 刷新'}
                                    </button>
                                  </div>

                                  {quotaData?.limit5h && (
                                    <div>
                                      <div class="flex items-center justify-between" style="font-size: 12px;">
                                        <span style="color: var(--text-secondary);">5小时限额剩余</span>
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

                                  {Array.isArray(quotaData?.models) && (
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                      {quotaData.models.map((m: any, idx: number) => (
                                        <div key={idx} style="background: var(--bg-tertiary); padding: 6px 10px; border-radius: var(--radius-sm);">
                                          <div class="flex items-center justify-between" style="font-size: 11px;">
                                            <span style="color: var(--text-primary);">{m.modelId || m.name}</span>
                                            <span style="color: var(--accent-primary); font-weight: 600;">{m.pctRemaining ?? 100}%</span>
                                          </div>
                                          <div class="quota-progress-track" style="margin: 3px 0 1px;">
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
                              )}

                              {activePluginSubTab === 'usage' && (
                                <div>
                                  <div class="flex items-center justify-between mb-2">
                                    <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">调用与缓存统计</span>
                                    <div class="flex items-center gap-2">
                                      <button class="chip-btn" onClick={fetchAntigravityUsage} disabled={loadingUsage} style="font-size: 11px; padding: 2px 6px;">
                                        刷新
                                      </button>
                                      <button class="chip-btn" onClick={clearAntigravityUsage} disabled={clearingUsage} style="font-size: 11px; padding: 2px 6px; color: #ef4444;">
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
                                      <span class="plugin-metric-label">实际输入 Tokens</span>
                                      <span class="plugin-metric-value">{(usageData?.totalInput ?? 0).toLocaleString()}</span>
                                    </div>
                                    <div class="plugin-metric-box">
                                      <span class="plugin-metric-label">实际输出 Tokens</span>
                                      <span class="plugin-metric-value">{(usageData?.totalOutput ?? 0).toLocaleString()}</span>
                                    </div>
                                    <div class="plugin-metric-box">
                                      <span class="plugin-metric-label">缓存命中率</span>
                                      <span class="plugin-metric-value" style="color: #10b981;">{usageData?.cacheHitRate ?? '0%'}</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {activePluginSubTab === 'valuation' && (() => {
                                // Find bucket
                                let targetBucket: any = null;
                                if (quotaData && Array.isArray(quotaData.groups)) {
                                  const geminiGroup = quotaData.groups.find((g: any) => (g.displayName || '').toLowerCase().includes('gemini')) || quotaData.groups[0];
                                  if (geminiGroup && Array.isArray(geminiGroup.buckets)) {
                                    if (activeValPeriod === '5h') {
                                      targetBucket = geminiGroup.buckets.find((b: any) => b.window === '5h') || geminiGroup.buckets[1] || geminiGroup.buckets[0];
                                    } else if (activeValPeriod === 'weekly') {
                                      targetBucket = geminiGroup.buckets.find((b: any) => b.window === 'weekly') || geminiGroup.buckets[0];
                                    }
                                  }
                                }

                                const bucketResetTime = targetBucket?.resetTime;
                                const bucketRemFraction = typeof targetBucket?.remainingFraction === 'number' ? targetBucket.remainingFraction : null;
                                const bucketResetInSec = targetBucket?.resetInSeconds || 0;

                                const nowMs = Date.now();
                                let endMs = nowMs;
                                if (bucketResetTime) {
                                  const parsed = new Date(bucketResetTime).getTime();
                                  if (!isNaN(parsed)) endMs = parsed;
                                }
                                let startMs = 0;
                                if (activeValPeriod === '5h') {
                                  startMs = endMs - 5 * 3600 * 1000;
                                } else if (activeValPeriod === 'weekly') {
                                  startMs = endMs - 7 * 24 * 3600 * 1000;
                                } else {
                                  startMs = 0;
                                  endMs = nowMs + 86400000;
                                }

                                const hist = (usageData && Array.isArray(usageData.history) && usageData.history.length > 0)
                                  ? usageData.history
                                  : ((usageData && Array.isArray(usageData.recent)) ? usageData.recent : []);

                                const modelStats: Record<string, { requests: number; inputTokens: number; outputTokens: number; reasoningTokens: number; cacheReadTokens: number }> = {};
                                for (const rec of hist) {
                                  const t = new Date(rec.timestamp).getTime();
                                  if (isNaN(t)) continue;
                                  if (t >= startMs && t <= endMs) {
                                    const m = rec.model || 'unknown';
                                    if (!modelStats[m]) {
                                      modelStats[m] = { requests: 0, inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0 };
                                    }
                                    modelStats[m].requests++;
                                    modelStats[m].inputTokens += (rec.inputTokens || 0);
                                    modelStats[m].outputTokens += (rec.outputTokens || 0);
                                    modelStats[m].reasoningTokens += (rec.reasoningTokens || 0);
                                    modelStats[m].cacheReadTokens += (rec.cacheReadTokens || 0);
                                  }
                                }

                                let totalIn = 0;
                                let totalOut = 0;
                                let totalCache = 0;
                                let totalCost = 0;

                                const modelList = Object.keys(modelStats).length > 0 ? Object.keys(modelStats) : ['gemini-3.7-flash-high'];
                                const rows = modelList.map(mId => {
                                  const st = modelStats[mId] || { requests: 0, inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0 };
                                  const p = mobilePricing[mId] || { input: 0.10, output: 0.40, cache: 0.025 };
                                  const outWithReasoning = (st.outputTokens || 0) + (st.reasoningTokens || 0);
                                  const cost = (st.inputTokens * p.input + outWithReasoning * p.output + st.cacheReadTokens * p.cache) / 1000000;
                                  totalIn += st.inputTokens;
                                  totalOut += outWithReasoning;
                                  totalCache += st.cacheReadTokens;
                                  totalCost += cost;
                                  return { mId, st, p, outWithReasoning, cost };
                                });

                                const remPct = typeof bucketRemFraction === 'number' ? Math.round(bucketRemFraction * 1000) / 10 : null;
                                const usedFraction = typeof bucketRemFraction === 'number' ? Math.max(0, 1 - bucketRemFraction) : null;
                                const usedPct = usedFraction !== null ? Math.round(usedFraction * 1000) / 10 : null;

                                let estTotalUsd: number | null = null;
                                let estRemUsd: number | null = null;
                                if (usedFraction !== null && usedFraction > 0.0001 && totalCost > 0) {
                                  estTotalUsd = totalCost / usedFraction;
                                  estRemUsd = estTotalUsd * (bucketRemFraction ?? 0);
                                }

                                const formatUsd = (num: number | null) => {
                                  if (num === null) return '—';
                                  if (num < 0.01 && num > 0) return `$${num.toFixed(4)}`;
                                  return `$${num.toFixed(2)}`;
                                };

                                return (
                                  <div style="display: flex; flex-direction: column; gap: 10px;">
                                    {/* Period Pills */}
                                    <div class="flex items-center justify-between">
                                      <div class="flex items-center gap-1" style="background: var(--bg-tertiary); padding: 2px; border-radius: var(--radius-sm);">
                                        <button
                                          class={`chip-btn ${activeValPeriod === '5h' ? 'active' : ''}`}
                                          style={{ fontSize: '11px', padding: '2px 8px', background: activeValPeriod === '5h' ? 'var(--accent-primary)' : 'transparent', color: activeValPeriod === '5h' ? '#fff' : 'var(--text-secondary)' }}
                                          onClick={() => setActiveValPeriod('5h')}
                                        >
                                          5小时
                                        </button>
                                        <button
                                          class={`chip-btn ${activeValPeriod === 'weekly' ? 'active' : ''}`}
                                          style={{ fontSize: '11px', padding: '2px 8px', background: activeValPeriod === 'weekly' ? 'var(--accent-primary)' : 'transparent', color: activeValPeriod === 'weekly' ? '#fff' : 'var(--text-secondary)' }}
                                          onClick={() => setActiveValPeriod('weekly')}
                                        >
                                          周额度
                                        </button>
                                        <button
                                          class={`chip-btn ${activeValPeriod === 'all' ? 'active' : ''}`}
                                          style={{ fontSize: '11px', padding: '2px 8px', background: activeValPeriod === 'all' ? 'var(--accent-primary)' : 'transparent', color: activeValPeriod === 'all' ? '#fff' : 'var(--text-secondary)' }}
                                          onClick={() => setActiveValPeriod('all')}
                                        >
                                          全部
                                        </button>
                                      </div>
                                      <button class="chip-btn" onClick={() => { fetchAntigravityQuota(true); fetchAntigravityUsage(); }} style="font-size: 11px; padding: 2px 6px;">
                                        🔄 刷新
                                      </button>
                                    </div>

                                    {/* Window info */}
                                    <div style="font-size: 11px; color: var(--text-muted); background: var(--bg-tertiary); padding: 6px 10px; border-radius: var(--radius-sm);">
                                      <span>倒推窗口: {new Date(startMs).toLocaleTimeString()} ~ {new Date(endMs).toLocaleTimeString()}</span>
                                      {bucketResetTime && (
                                        <span style="float: right;">倒计时: {formatSeconds(bucketResetInSec)}</span>
                                      )}
                                    </div>

                                    {/* KPI cards */}
                                    <div class="plugin-metric-grid">
                                      <div class="plugin-metric-box">
                                        <span class="plugin-metric-label">周期已消耗</span>
                                        <span class="plugin-metric-value">{formatUsd(totalCost)}</span>
                                      </div>
                                      <div class="plugin-metric-box">
                                        <span class="plugin-metric-label">额度消耗比</span>
                                        <span class="plugin-metric-value">{usedPct !== null ? `${usedPct}%` : '—'}</span>
                                      </div>
                                      <div class="plugin-metric-box">
                                        <span class="plugin-metric-label">🔮 估算总额度</span>
                                        <span class="plugin-metric-value" style="color: var(--accent-primary);">{estTotalUsd !== null ? formatUsd(estTotalUsd) : (usedPct === 0 ? '100% 完整' : '待推算')}</span>
                                      </div>
                                      <div class="plugin-metric-box">
                                        <span class="plugin-metric-label">🛡️ 估算剩余可用</span>
                                        <span class="plugin-metric-value" style="color: #10b981;">{estRemUsd !== null ? formatUsd(estRemUsd) : (usedPct === 0 ? '完全就绪' : '待推算')}</span>
                                      </div>
                                    </div>

                                    {/* Model Pricing & Cost list */}
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                      <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">各模型定价与周期折算 ($/1M)</div>
                                      {rows.map(({ mId, st, p, outWithReasoning, cost }) => (
                                        <div key={mId} style="background: var(--bg-tertiary); padding: 8px 10px; border-radius: var(--radius-sm); font-size: 11px;">
                                          <div class="flex items-center justify-between" style="font-weight: 600; margin-bottom: 4px;">
                                            <span>{mId}</span>
                                            <span style="color: var(--accent-primary);">{formatUsd(cost)}</span>
                                          </div>
                                          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; color: var(--text-muted); font-size: 10px;">
                                            <div>
                                              入: {(st.inputTokens || 0).toLocaleString()}
                                              <input
                                                type="number"
                                                step="0.01"
                                                style="width: 100%; height: 20px; font-size: 10px; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 0 2px; background: var(--bg-primary); color: var(--text-primary); margin-top: 2px;"
                                                value={p.input}
                                                onInput={(e: any) => {
                                                  const val = parseFloat(e.target.value) || 0;
                                                  const next = { ...mobilePricing, [mId]: { ...p, input: val } };
                                                  setMobilePricing(next);
                                                  try { localStorage.setItem('antigravity_pricing_v1', JSON.stringify(next)); } catch {}
                                                }}
                                              />
                                            </div>
                                            <div>
                                              出+思: {outWithReasoning.toLocaleString()}
                                              <input
                                                type="number"
                                                step="0.01"
                                                style="width: 100%; height: 20px; font-size: 10px; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 0 2px; background: var(--bg-primary); color: var(--text-primary); margin-top: 2px;"
                                                value={p.output}
                                                onInput={(e: any) => {
                                                  const val = parseFloat(e.target.value) || 0;
                                                  const next = { ...mobilePricing, [mId]: { ...p, output: val } };
                                                  setMobilePricing(next);
                                                  try { localStorage.setItem('antigravity_pricing_v1', JSON.stringify(next)); } catch {}
                                                }}
                                              />
                                            </div>
                                            <div>
                                              缓存: {(st.cacheReadTokens || 0).toLocaleString()}
                                              <input
                                                type="number"
                                                step="0.001"
                                                style="width: 100%; height: 20px; font-size: 10px; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 0 2px; background: var(--bg-primary); color: var(--text-primary); margin-top: 2px;"
                                                value={p.cache}
                                                onInput={(e: any) => {
                                                  const val = parseFloat(e.target.value) || 0;
                                                  const next = { ...mobilePricing, [mId]: { ...p, cache: val } };
                                                  setMobilePricing(next);
                                                  try { localStorage.setItem('antigravity_pricing_v1', JSON.stringify(next)); } catch {}
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}

                              {activePluginSubTab === 'config' && (
                                <div style="display: flex; flex-direction: column; gap: 10px;">
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
                                  </div>
                                  <div>
                                    <label style="font-size: 12px; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">
                                      Base URL 端点
                                    </label>
                                    <input
                                      type="text"
                                      class="settings-input"
                                      value={draftBaseUrl}
                                      onInput={(e: any) => setDraftBaseUrl(e.target.value)}
                                    />
                                  </div>
                                  <button
                                    class="chip-btn"
                                    style="background: var(--accent-primary); color: #fff; border-color: transparent; height: 36px; justify-content: center;"
                                    onClick={saveAntigravityConfig}
                                    disabled={Boolean(savingNs)}
                                  >
                                    {savingNs === 'llm-antigravity' ? <LoaderIcon size={14} /> : <CheckIcon size={14} />}
                                    <span>保存 Antigravity 凭据</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Case B: Universal Dynamic multi-level schema fields */
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                              {Object.keys(currentEffective).length === 0 ? (
                                <div style="font-size: 12px; color: var(--text-muted); padding: 6px 0;">
                                  该插件使用默认参数运行。
                                </div>
                              ) : (
                                Object.entries(currentEffective).map(([key, val]) => {
                                  const isBool = typeof val === 'boolean';
                                  const isNum = typeof val === 'number';

                                  return (
                                    <div key={key} style="display: flex; flex-direction: column; gap: 4px;">
                                      <label style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">
                                        {key}
                                      </label>
                                      {isBool ? (
                                        <select
                                          class="settings-select"
                                          value={String(val)}
                                          onChange={(e: any) => editCardField(ns, key, e.target.value === 'true')}
                                        >
                                          <option value="true">true (启用)</option>
                                          <option value="false">false (禁用)</option>
                                        </select>
                                      ) : isNum ? (
                                        <input
                                          type="number"
                                          class="settings-input"
                                          value={val}
                                          onInput={(e: any) => editCardField(ns, key, Number(e.target.value))}
                                        />
                                      ) : (
                                        <input
                                          type="text"
                                          class="settings-input"
                                          value={String(val || '')}
                                          onInput={(e: any) => editCardField(ns, key, e.target.value)}
                                        />
                                      )}
                                    </div>
                                  );
                                })
                              )}

                              {/* Card Footer for Save / Discard */}
                              {isDirty && (
                                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--border-subtle);">
                                  <button
                                    class="chip-btn"
                                    onClick={() => discardCardEdits(ns)}
                                    disabled={isSavingThis}
                                    style="font-size: 12px;"
                                  >
                                    放弃
                                  </button>
                                  <button
                                    class="chip-btn"
                                    style="background: var(--accent-primary); color: #fff; border-color: transparent; font-size: 12px;"
                                    onClick={() => saveCardEdits(ns)}
                                    disabled={isSavingThis}
                                  >
                                    {isSavingThis ? <LoaderIcon size={12} /> : <CheckIcon size={12} />}
                                    <span>保存</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
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
