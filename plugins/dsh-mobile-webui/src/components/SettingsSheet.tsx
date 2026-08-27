import { h, VNode, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { store } from '../store/state';
import { t, getLocale, setLocale as setI18nLocale, subscribeLocale } from '../i18n';
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
      'gemini-3.7-flash-high': { input: 0.75, output: 3.75, cache: 0.1875 },
      'gemini-3.7-flash-medium': { input: 0.75, output: 3.75, cache: 0.1875 },
      'gemini-3.7-flash-low': { input: 0.75, output: 3.75, cache: 0.1875 },
      'gemini-3.7-flash-tiered': { input: 0.75, output: 3.75, cache: 0.1875 },
      'gemini-3.6-flash-high': { input: 0.75, output: 3.75, cache: 0.1875 },
      'gemini-3.5-flash-low': { input: 1.50, output: 9.00, cache: 0.15 },
      'gemini-3-flash': { input: 0.75, output: 3.75, cache: 0.1875 },
      'gemini-3.1-pro-high': { input: 2.00, output: 12.00, cache: 0.20 },
      'gemini-3.1-flash-lite': { input: 0.25, output: 1.50, cache: 0.025 },
      'gemini-2.5-pro': { input: 1.25, output: 10.00, cache: 0.125 },
      'gemini-2.5-flash': { input: 0.10, output: 0.40, cache: 0.025 },
      'gemini-2.5-flash-thinking': { input: 0.30, output: 2.50, cache: 0.075 },
      'claude-sonnet-4-6': { input: 3.00, output: 15.00, cache: 0.30 },
      'claude-opus-4-6-thinking': { input: 15.00, output: 75.00, cache: 1.50 },
      'gpt-oss-120b-medium': { input: 0.50, output: 2.00, cache: 0.10 },
    };
  });

  // UI status
  const [savingNs, setSavingNs] = useState<string | null>(null);
  const [savedTip, setSavedTip] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadAllGlobalSettings();
    if (isOpen) {
      fetchAntigravityQuota();
      fetchAntigravityUsage();
    }
  }, [isOpen]);

  useEffect(() => {
    const unsub = subscribeLocale(() => {
      setLocaleState(getLocale());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (activeTab === 'plugins') {
      fetchAntigravityQuota();
      fetchAntigravityUsage();
    }
  }, [activeTab]);

  const loadAllGlobalSettings = async () => {
    try {
      const res = await store.client.rpc<{ namespaces: any[] }>('settings.describe');
      if (res && Array.isArray(res.namespaces)) {
        setRawNamespaces(res.namespaces);

        for (const item of res.namespaces) {
          const ns = item.ns || item.name || item.id || '';
          const val = item.user || item.value || item.base || {};
          if (ns === 'agent-default-model') {
            if (val.provider) setDefaultProvider(val.provider);
            if (val.model) setDefaultModel(val.model);
            if (val.reasoningEffort) setReasoningEffort(val.reasoningEffort);
          } else if (ns === 'permission') {
            if (val.defaultPreset) setDefaultPreset(val.defaultPreset);
          } else if (ns === 'agent-loop') {
            if (val.maxParallelToolCalls) setMaxParallelTools(val.maxParallelToolCalls);
          } else if (ns === 'shell') {
            if (val.timeoutMs) setShellTimeout(val.timeoutMs);
          } else if (ns === 'locale') {
            if (val.locale) {
              setLocaleState(val.locale);
              setI18nLocale(val.locale as any);
            }
          } else if (ns === 'ui-theme') {
            if (val.theme) {
              setThemeState(val.theme);
              if (val.theme === 'light') {
                document.documentElement.setAttribute('data-theme', 'light');
              } else {
                document.documentElement.removeAttribute('data-theme');
              }
            }
          } else if (ns === 'llm-antigravity' || ns === 'dsh-llm-antigravity') {
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
    if (!confirm(t('clearUsageConfirm'))) return;
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
    setI18nLocale(newLoc as any);
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
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
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
            <span class="sheet-title">{t('settingsTitle')}</span>
            {savingNs && <LoaderIcon size={14} className="text-accent" />}
            {savedTip && (
              <span class="status-badge completed" style="font-size: 11px;">
                <CheckCircleIcon size={11} />
                <span>{t('saved')}</span>
              </span>
            )}
          </div>
          <button class="icon-btn" onClick={onClose} aria-label={t('close')}>
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Top Tab Navigation */}
        <div class="settings-tabs">
          <button
            class={`settings-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            ⚙️ {t('tabGeneral')}
          </button>
          <button
            class={`settings-tab-btn ${activeTab === 'models' ? 'active' : ''}`}
            onClick={() => setActiveTab('models')}
          >
            🤖 {t('tabModels')}
          </button>
          <button
            class={`settings-tab-btn ${activeTab === 'plugins' ? 'active' : ''}`}
            onClick={() => setActiveTab('plugins')}
          >
            🔌 {t('tabPlugins')}
          </button>
          <button
            class={`settings-tab-btn ${activeTab === 'yaml' ? 'active' : ''}`}
            onClick={() => setActiveTab('yaml')}
          >
            📜 {t('tabYaml')}
          </button>
        </div>

        <div class="sheet-content">
          {/* ================= TAB 1: 常规设置 ================= */}
          {activeTab === 'general' && (
            <div>
              {/* Theme Settings */}
              <div class="settings-section">
                <div class="settings-section-title">
                  <SparklesIcon size={14} />
                  <span>{t('appearance')}</span>
                </div>
                <div class="settings-card">
                  {[
                    { id: 'dark', name: t('themeDark'), desc: t('themeDarkDesc') },
                    { id: 'light', name: t('themeLight'), desc: t('themeLightDesc') },
                  ].map((th) => (
                    <div
                      key={th.id}
                      class="settings-row"
                      onClick={() => handleThemeChange(th.id)}
                    >
                      <div>
                        <div class="settings-row-label">{th.name}</div>
                        <div class="settings-row-desc">{th.desc}</div>
                      </div>
                      {theme === th.id && <CheckIcon size={16} className="text-accent" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Language Settings */}
              <div class="settings-section">
                <div class="settings-section-title">
                  <span>🌐 {t('language')}</span>
                </div>
                <div class="settings-card">
                  {[
                    { id: 'zh-CN', name: t('langZh'), desc: '简体中文界面' },
                    { id: 'en-US', name: t('langEn'), desc: 'English interface' },
                  ].map((loc) => (
                    <div
                      key={loc.id}
                      class="settings-row"
                      onClick={() => handleLocaleChange(loc.id)}
                    >
                      <div>
                        <div class="settings-row-label">{loc.name}</div>
                        <div class="settings-row-desc">{loc.desc}</div>
                      </div>
                      {locale === loc.id && <CheckIcon size={16} className="text-accent" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Default Permission Preset */}
              <div class="settings-section">
                <div class="settings-section-title">
                  <ShieldIcon size={14} />
                  <span>{t('defaultPermPreset')}</span>
                </div>
                <div class="settings-card">
                  {[
                    { id: 'danger-full-access', name: `${t('permFull')}${t('defaultSuffix')}`, desc: t('permFullDesc') },
                    { id: 'workspace-write', name: t('permWorkspace'), desc: t('permWorkspaceDesc') },
                    { id: 'read-only', name: t('permReadOnly'), desc: t('permReadOnlyDesc') },
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
                  <span>{t('execEngine')}</span>
                </div>
                <div class="settings-card">
                  <div class="settings-row" style="cursor: default;">
                    <div>
                      <div class="settings-row-label">{t('maxParallelTools')}</div>
                      <div class="settings-row-desc">agent-loop.maxParallelToolCalls</div>
                    </div>
                    <select
                      class="settings-select"
                      value={maxParallelTools}
                      onChange={(e: any) => handleParallelToolsChange(Number(e.target.value))}
                    >
                      <option value={5}>5 {t('concurrencyUnit')}</option>
                      <option value={10}>10 {t('concurrencyUnit')}{t('defaultSuffix')}</option>
                      <option value={20}>20 {t('concurrencyUnit')}</option>
                    </select>
                  </div>
                  <div class="settings-row" style="cursor: default;">
                    <div>
                      <div class="settings-row-label">{t('shellTimeout')}</div>
                      <div class="settings-row-desc">shell.timeoutMs</div>
                    </div>
                    <select
                      class="settings-select"
                      value={shellTimeout}
                      onChange={(e: any) => handleShellTimeoutChange(Number(e.target.value))}
                    >
                      <option value={30000}>30 {t('secondsUnit')}</option>
                      <option value={60000}>60 {t('secondsUnit')}{t('defaultSuffix')}</option>
                      <option value={120000}>120 {t('secondsUnit')}</option>
                      <option value={300000}>300 {t('secondsUnit')}</option>
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
                  <span>{t('defaultModelTitle')}</span>
                </div>
                <div class="settings-card">
                  {[
                    { id: 'gemini-3.7-flash-high', prov: 'antigravity', name: 'Gemini 3.7 Flash High', desc: '深度思考推理旗舰模型（推荐）' },
                    { id: 'gemini-3.7-flash-medium', prov: 'antigravity', name: 'Gemini 3.7 Flash Medium', desc: '中等思考深度，平衡性能与时延' },
                    { id: 'gemini-3.7-flash-low', prov: 'antigravity', name: 'Gemini 3.7 Flash Low', desc: '极速低思考预算，适合轻量快速任务' },
                    { id: 'gemini-pro-agent', prov: 'antigravity', name: 'Gemini Pro Agent', desc: '百万上下文窗口，复杂代码与长程任务' },
                    { id: 'gemini-3.6-flash-high', prov: 'antigravity', name: 'Gemini 3.6 Flash High', desc: '高性能推理模型' },
                    { id: 'gemini-3.1-flash-lite', prov: 'antigravity', name: 'Gemini 3.1 Flash Lite', desc: '轻量极速多模态模型' },
                    { id: 'claude-sonnet-4-6', prov: 'antigravity', name: 'Claude Sonnet 4.6', desc: 'Claude 顶尖编程与架构分析模型' },
                    { id: 'claude-opus-4-6-thinking', prov: 'antigravity', name: 'Claude Opus 4.6 Thinking', desc: 'Claude 顶尖推理与超长程分析模型' },
                    { id: 'gpt-oss-120b-medium', prov: 'antigravity', name: 'GPT-OSS 120B Medium', desc: '开源百亿级代码推理模型' },
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
                  <span>{t('thinkingTierTitle')}</span>
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
                <span>{t('pluginsListTitle')}</span>
              </div>

              {rawNamespaces.length === 0 ? (
                <div style="font-size: 12px; color: var(--text-muted); padding: 20px; text-align: center;">
                  {t('discoveringPlugins')}
                </div>
              ) : (
                rawNamespaces.map((nsItem) => {
                  const ns = nsItem.ns || nsItem.name || nsItem.id || 'unknown';
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
                                {t('unsavedChanges')}
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
                                  {t('quotaTab')}
                                </button>
                                <button
                                  class={`settings-tab-btn ${activePluginSubTab === 'usage' ? 'active' : ''}`}
                                  onClick={() => setActivePluginSubTab('usage')}
                                >
                                  {t('usageTab')}
                                </button>
                                <button
                                  class={`settings-tab-btn ${activePluginSubTab === 'valuation' ? 'active' : ''}`}
                                  onClick={() => setActivePluginSubTab('valuation')}
                                >
                                  {t('valuationTab')}
                                </button>
                                <button
                                  class={`settings-tab-btn ${activePluginSubTab === 'config' ? 'active' : ''}`}
                                  onClick={() => setActivePluginSubTab('config')}
                                >
                                  {t('configTab')}
                                </button>
                              </div>

                              {activePluginSubTab === 'quota' && (() => {
                                let limit5h: any = null;
                                let limitWeekly: any = null;
                                if (quotaData && Array.isArray(quotaData.groups)) {
                                  for (const g of quotaData.groups) {
                                    if (Array.isArray(g.buckets)) {
                                      for (const b of g.buckets) {
                                        if (b.window === '5h' || b.bucketId?.includes('5h')) limit5h = b;
                                        if (b.window === 'weekly' || b.bucketId?.includes('weekly')) limitWeekly = b;
                                      }
                                    }
                                  }
                                  if (!limit5h && quotaData.groups[0]?.buckets?.[1]) limit5h = quotaData.groups[0].buckets[1];
                                  if (!limit5h && quotaData.groups[0]?.buckets?.[0]) limit5h = quotaData.groups[0].buckets[0];
                                  if (!limitWeekly && quotaData.groups[0]?.buckets?.[0]) limitWeekly = quotaData.groups[0].buckets[0];
                                }

                                return (
                                  <div style="display: flex; flex-direction: column; gap: 10px;">
                                    <div class="flex items-center justify-between">
                                      <span style="font-size: 12px; color: var(--text-muted);">
                                        {t('project')}: {quotaData?.projectId || t('autoDetect')} • {t('tier')}: {quotaData?.tier || 'Pro'}
                                      </span>
                                      <button
                                        class="chip-btn"
                                        onClick={() => fetchAntigravityQuota(true)}
                                        disabled={loadingQuota}
                                        style="font-size: 11px; padding: 2px 8px;"
                                      >
                                        {loadingQuota ? <LoaderIcon size={12} /> : `🔄 ${t('refresh')}`}
                                      </button>
                                    </div>

                                    {limit5h && (
                                      <div style="background: var(--bg-tertiary); padding: 10px; border-radius: var(--radius-md);">
                                        <div class="flex items-center justify-between" style="font-size: 12px;">
                                          <span style="color: var(--text-primary); font-weight: 600;">{limit5h.displayName || t('fiveHourRemaining')}</span>
                                          <span style={{ fontWeight: 700, color: (limit5h.remainingPercent ?? 100) < 20 ? '#ef4444' : 'var(--accent-primary)' }}>
                                            {limit5h.remainingPercent ?? 100}% ({formatSeconds(limit5h.resetInSeconds)}{t('resetsIn')})
                                          </span>
                                        </div>
                                        <div class="quota-progress-track" style="margin-top: 6px;">
                                          <div
                                            class="quota-progress-fill"
                                            style={{
                                              width: `${Math.max(0, Math.min(100, limit5h.remainingPercent ?? 100))}%`,
                                              background: (limit5h.remainingPercent ?? 100) < 20 ? '#ef4444' : 'var(--accent-primary)',
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {limitWeekly && (
                                      <div style="background: var(--bg-tertiary); padding: 10px; border-radius: var(--radius-md);">
                                        <div class="flex items-center justify-between" style="font-size: 12px;">
                                          <span style="color: var(--text-primary); font-weight: 600;">{limitWeekly.displayName || t('weeklyRemaining')}</span>
                                          <span style={{ fontWeight: 700, color: (limitWeekly.remainingPercent ?? 100) < 20 ? '#ef4444' : '#10b981' }}>
                                            {limitWeekly.remainingPercent ?? 100}% ({formatSeconds(limitWeekly.resetInSeconds)}{t('resetsIn')})
                                          </span>
                                        </div>
                                        <div class="quota-progress-track" style="margin-top: 6px;">
                                          <div
                                            class="quota-progress-fill"
                                            style={{
                                              width: `${Math.max(0, Math.min(100, limitWeekly.remainingPercent ?? 100))}%`,
                                              background: (limitWeekly.remainingPercent ?? 100) < 20 ? '#ef4444' : '#10b981',
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {Array.isArray(quotaData?.models) && quotaData.models.length > 0 && (
                                      <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                                        {quotaData.models.map((m: any, idx: number) => {
                                          const pct = typeof m.remainingPercent === 'number' ? m.remainingPercent : (typeof m.remainingFraction === 'number' ? Math.round(m.remainingFraction * 100) : 100);
                                          return (
                                            <div key={idx} style="background: var(--bg-tertiary); padding: 6px 10px; border-radius: var(--radius-sm);">
                                              <div class="flex items-center justify-between" style="font-size: 11px;">
                                                <span style="color: var(--text-primary); font-weight: 500;">{m.displayName || m.id || m.name}</span>
                                                <span style={{ color: pct < 20 ? '#ef4444' : 'var(--accent-primary)', fontWeight: 600 }}>{pct}%</span>
                                              </div>
                                              <div class="quota-progress-track" style="margin: 3px 0 1px;">
                                                <div
                                                  class="quota-progress-fill"
                                                  style={{
                                                    width: `${Math.max(0, Math.min(100, pct))}%`,
                                                    background: pct < 20 ? '#ef4444' : '#10b981',
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {activePluginSubTab === 'usage' && (() => {
                                const summary = usageData?.summary || usageData || {};
                                const totalReq = summary.totalRequests ?? 0;
                                const totalIn = summary.totalInputTokens ?? summary.totalInput ?? 0;
                                const totalOut = summary.totalOutputTokens ?? summary.totalOutput ?? 0;
                                const cacheRate = summary.cacheSavingsRate ?? summary.cacheHitRate ?? '0%';

                                return (
                                  <div>
                                    <div class="flex items-center justify-between mb-2">
                                      <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">{t('callingAndCacheStats')}</span>
                                      <div class="flex items-center gap-2">
                                        <button class="chip-btn" onClick={fetchAntigravityUsage} disabled={loadingUsage} style="font-size: 11px; padding: 2px 6px;">
                                          {t('refresh')}
                                        </button>
                                        <button class="chip-btn" onClick={clearAntigravityUsage} disabled={clearingUsage} style="font-size: 11px; padding: 2px 6px; color: #ef4444;">
                                          {t('clear')}
                                        </button>
                                      </div>
                                    </div>
                                    <div class="plugin-metric-grid">
                                      <div class="plugin-metric-box">
                                        <span class="plugin-metric-label">{t('totalRequests')}</span>
                                        <span class="plugin-metric-value">{totalReq}</span>
                                      </div>
                                      <div class="plugin-metric-box">
                                        <span class="plugin-metric-label">{t('inputTokens')}</span>
                                        <span class="plugin-metric-value">{totalIn.toLocaleString()}</span>
                                      </div>
                                      <div class="plugin-metric-box">
                                        <span class="plugin-metric-label">{t('outputTokens')}</span>
                                        <span class="plugin-metric-value">{totalOut.toLocaleString()}</span>
                                      </div>
                                      <div class="plugin-metric-box">
                                        <span class="plugin-metric-label">{t('cacheSavingsRate')}</span>
                                        <span class="plugin-metric-value" style="color: #10b981;">{cacheRate}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

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
                                  const tMs = new Date(rec.timestamp).getTime();
                                  if (isNaN(tMs)) continue;
                                  if (tMs >= startMs && tMs <= endMs) {
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

                                let totalGrossIn = 0;
                                let totalOut = 0;
                                let totalCache = 0;
                                let totalValuationUSD = 0;
                                let rawValuationWithoutCache = 0;

                                for (const [mName, s] of Object.entries(modelStats)) {
                                  const pr = mobilePricing[mName] || { input: 0.75, output: 3.75, cache: 0.1875 };
                                  totalGrossIn += (s.inputTokens + s.cacheReadTokens);
                                  totalOut += s.outputTokens;
                                  totalCache += s.cacheReadTokens;

                                  const costWithCache = (s.inputTokens / 1e6 * pr.input) + (s.outputTokens / 1e6 * pr.output) + (s.cacheReadTokens / 1e6 * pr.cache);
                                  const costNoCache = ((s.inputTokens + s.cacheReadTokens) / 1e6 * pr.input) + (s.outputTokens / 1e6 * pr.output);
                                  totalValuationUSD += costWithCache;
                                  rawValuationWithoutCache += costNoCache;
                                }

                                const totalGrossTokens = totalGrossIn + totalOut;
                                const cacheSaveRatio = totalGrossIn > 0 ? (totalCache / totalGrossIn * 100).toFixed(1) : '0.0';

                                return (
                                  <div style="display: flex; flex-direction: column; gap: 10px;">
                                    <div class="flex items-center justify-between">
                                      <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">
                                        {t('valuationTitle')}
                                      </span>
                                      <div class="flex gap-1">
                                        <button
                                          class={`chip-btn ${activeValPeriod === '5h' ? 'active' : ''}`}
                                          onClick={() => setActiveValPeriod('5h')}
                                          style={activeValPeriod === '5h' ? 'background: var(--accent-glass); color: var(--accent-primary);' : ''}
                                        >
                                          {t('period5h')}
                                        </button>
                                        <button
                                          class={`chip-btn ${activeValPeriod === 'weekly' ? 'active' : ''}`}
                                          onClick={() => setActiveValPeriod('weekly')}
                                          style={activeValPeriod === 'weekly' ? 'background: var(--accent-glass); color: var(--accent-primary);' : ''}
                                        >
                                          {t('periodWeekly')}
                                        </button>
                                        <button
                                          class={`chip-btn ${activeValPeriod === 'all' ? 'active' : ''}`}
                                          onClick={() => setActiveValPeriod('all')}
                                          style={activeValPeriod === 'all' ? 'background: var(--accent-glass); color: var(--accent-primary);' : ''}
                                        >
                                          {t('periodAll')}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Valuation Hero Box */}
                                    <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(59, 130, 246, 0.12)); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-md); padding: 12px;">
                                      <div class="flex items-center justify-between">
                                        <span style="font-size: 12px; color: var(--text-secondary);">{t('estValue')}</span>
                                        <span style="font-size: 20px; font-weight: 800; color: #10b981;">
                                          ${totalValuationUSD.toFixed(3)}
                                        </span>
                                      </div>
                                      <div class="flex items-center justify-between mt-2 pt-2 border-t border-[rgba(255,255,255,0.06)]" style="font-size: 11px; color: var(--text-muted);">
                                        <span>{t('grossTokens')}: {totalGrossTokens.toLocaleString()}</span>
                                        <span>{t('savedRate')}: <strong style="color: #10b981;">{cacheSaveRatio}%</strong></span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {activePluginSubTab === 'config' && (
                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                  <div style="font-size: 12px; color: var(--text-muted);">
                                    {t('tokenConfigTip')}
                                  </div>
                                  <div>
                                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 3px;">
                                      Refresh Token (1//...)
                                    </label>
                                    <input
                                      type="password"
                                      class="composer-textarea"
                                      style="width: 100%; height: 36px; min-height: 36px; padding: 6px 10px; border-radius: var(--radius-sm); font-size: 12px;"
                                      placeholder="留空保持现有凭据不变"
                                      value={draftToken}
                                      onInput={(e: any) => setDraftToken(e.target.value)}
                                    />
                                  </div>

                                  <div>
                                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 3px;">
                                      API Base URL
                                    </label>
                                    <input
                                      type="text"
                                      class="composer-textarea"
                                      style="width: 100%; height: 36px; min-height: 36px; padding: 6px 10px; border-radius: var(--radius-sm); font-size: 12px;"
                                      placeholder="https://daily-cloudcode-pa.googleapis.com/v1internal"
                                      value={draftBaseUrl}
                                      onInput={(e: any) => setDraftBaseUrl(e.target.value)}
                                    />
                                  </div>

                                  <button
                                    class="send-btn"
                                    onClick={saveAntigravityConfig}
                                    disabled={isSavingThis}
                                    style="width: 100%; height: 36px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; margin-top: 4px;"
                                  >
                                    {isSavingThis ? <LoaderIcon size={14} /> : `💾 ${t('saveConfig')}`}
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Case B: Generic Dynamic Form Generator for any other plugin */
                            <div>
                              {Object.entries(resolvedVal).map(([fieldKey, fieldVal]) => {
                                const draftVal = stagedDraft[fieldKey];
                                const effectiveVal = draftVal !== undefined ? draftVal : fieldVal;
                                const isFieldEdited = draftVal !== undefined && draftVal !== fieldVal;
                                const isBool = typeof fieldVal === 'boolean';
                                const isNum = typeof fieldVal === 'number';

                                return (
                                  <div
                                    key={fieldKey}
                                    style={{
                                      display: 'flex',
                                      flexDirection: isBool ? 'row' : 'column',
                                      alignItems: isBool ? 'center' : 'stretch',
                                      justifyContent: 'space-between',
                                      padding: '8px 0',
                                      borderBottom: '1px solid var(--border-subtle)',
                                      gap: '6px',
                                    }}
                                  >
                                    <div>
                                      <div style="display: flex; align-items: center; gap: 4px;">
                                        <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">
                                          {fieldKey}
                                        </span>
                                        {isFieldEdited && (
                                          <span style="font-size: 9px; padding: 1px 4px; border-radius: 3px; background: rgba(245, 158, 11, 0.15); color: #f59e0b;">
                                            Draft
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {isBool ? (
                                      <button
                                        type="button"
                                        onClick={() => editCardField(ns, fieldKey, !effectiveVal)}
                                        style={{
                                          width: '40px',
                                          height: '22px',
                                          borderRadius: '11px',
                                          background: effectiveVal ? 'var(--accent-primary)' : 'var(--border-muted)',
                                          border: 0,
                                          position: 'relative',
                                          cursor: 'pointer',
                                          transition: 'background 0.2s',
                                        }}
                                      >
                                        <div
                                          style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            background: '#ffffff',
                                            position: 'absolute',
                                            top: '2px',
                                            left: effectiveVal ? '20px' : '2px',
                                            transition: 'left 0.2s',
                                          }}
                                        />
                                      </button>
                                    ) : (
                                      <input
                                        type={isNum ? 'number' : 'text'}
                                        class="composer-textarea"
                                        style="width: 100%; height: 32px; min-height: 32px; padding: 4px 8px; border-radius: var(--radius-sm); font-size: 12px;"
                                        value={effectiveVal !== undefined ? effectiveVal : ''}
                                        onInput={(e: any) => editCardField(ns, fieldKey, isNum ? Number(e.target.value) : e.target.value)}
                                      />
                                    )}
                                  </div>
                                );
                              })}

                              {isDirty && (
                                <div class="flex items-center justify-end gap-2 mt-3">
                                  <button
                                    class="chip-btn"
                                    onClick={() => discardCardEdits(ns)}
                                    style="font-size: 11px; padding: 4px 10px;"
                                  >
                                    {t('cancel')}
                                  </button>
                                  <button
                                    class="chip-btn"
                                    onClick={() => saveCardEdits(ns)}
                                    disabled={isSavingThis}
                                    style="background: var(--accent-primary); color: #ffffff; font-size: 11px; padding: 4px 12px; border-color: transparent;"
                                  >
                                    {isSavingThis ? <LoaderIcon size={12} /> : t('save')}
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

          {/* ================= TAB 4: YAML 直出配置视图 ================= */}
          {activeTab === 'yaml' && (
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="settings-section-title" style="margin-bottom: 0;">
                  <span>~/.dsh/settings.yaml (Live Profile)</span>
                </div>
                <button class="chip-btn" onClick={copyYaml} style="font-size: 11px; padding: 2px 8px;">
                  {copied ? (
                    <>
                      <CheckIcon size={12} className="text-accent" />
                      <span>{t('copied')}</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon size={12} />
                      <span>{t('copy')}</span>
                    </>
                  )}
                </button>
              </div>

              <pre style="background: #090d13; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #a5d6ff; line-height: 1.5; overflow-x: auto; white-space: pre;">
                {yamlContent}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
