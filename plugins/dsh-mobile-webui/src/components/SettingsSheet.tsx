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
  const [deepseekApiKey, setDeepseekApiKey] = useState<string>('');

  // Plugin Settings
  const [searchProvider, setSearchProvider] = useState<string>('antigravity');

  // UI state
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
        for (const ns of res.namespaces) {
          const val = ns.user || ns.resolved || ns.base || {};
          if (ns.ns === 'agent-default-model') {
            if (val.provider) setDefaultProvider(val.provider);
            if (val.model) setDefaultModel(val.model);
            if (val.reasoningEffort) setReasoningEffort(val.reasoningEffort);
          } else if (ns.ns === 'web-search-selector') {
            if (val.provider) setSearchProvider(val.provider);
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
    } catch (e) {
      console.error(`[mobile-settings] Failed to update ${ns}:`, e);
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

  const handleSearchProviderChange = async (prov: string) => {
    setSearchProvider(prov);
    await updateNamespace('web-search-selector', { provider: prov });
  };

  // Generate YAML preview of settings
  const yamlContent = `ui-onboarding:
  welcomeNoticeVersion: 2026-08-13.1
web-search-selector:
  provider: ${searchProvider}
agent-default-model:
  provider: ${defaultProvider}
  model: ${defaultModel}
permission:
  defaultPreset: ${defaultPreset}
agent-loop:
  maxParallelToolCalls: ${maxParallelTools}
shell:
  timeoutMs: ${shellTimeout}`;

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
            <span class="sheet-title">全局系统设置 (Settings)</span>
            {saving && <LoaderIcon size={14} className="text-accent" />}
            {savedTip && (
              <span class="status-badge completed" style="font-size: 11px;">
                <CheckCircleIcon size={11} />
                <span>已同步保存</span>
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
            🛠️ 通用设置
          </button>
          <button
            class={`settings-tab-btn ${activeTab === 'models' ? 'active' : ''}`}
            onClick={() => setActiveTab('models')}
          >
            🧠 模型与提供方
          </button>
          <button
            class={`settings-tab-btn ${activeTab === 'plugins' ? 'active' : ''}`}
            onClick={() => setActiveTab('plugins')}
          >
            🔌 插件与工具
          </button>
          <button
            class={`settings-tab-btn ${activeTab === 'yaml' ? 'active' : ''}`}
            onClick={() => setActiveTab('yaml')}
          >
            📄 配置文件
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
              {/* Default Model */}
              <div class="settings-section">
                <div class="settings-section-title">
                  <CpuIcon size={14} />
                  <span>全局默认 Agent 模型 (Default Model)</span>
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

              {/* Reasoning Effort */}
              <div class="settings-section">
                <div class="settings-section-title">
                  <span>🧠 思考等级 (Reasoning Effort)</span>
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

              {/* Configured Providers */}
              <div class="settings-section">
                <div class="settings-section-title">
                  <span>🔑 模型提供方凭据与端点 (Providers)</span>
                </div>
                <div class="settings-card" style="padding: 12px 14px; gap: 12px;">
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <span style="font-weight: 600; font-size: 14px; color: var(--text-primary);">Google Antigravity (OAuth 2.0)</span>
                      <span class="status-badge completed">已连接 Active</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
                      • 凭据环境变量: <code style="color: var(--accent-primary);">ANTIGRAVITY_REFRESH_TOKEN</code><br />
                      • 服务端点: <code style="font-size: 11px;">https://daily-cloudcode-pa.googleapis.com/v1internal</code><br />
                      • 生图模型: <code style="font-size: 11px;">gemini-3.1-flash-image</code>
                    </div>
                  </div>

                  <div style="border-top: 1px solid var(--border-subtle); padding-top: 10px;">
                    <div class="flex items-center justify-between mb-1">
                      <span style="font-weight: 600; font-size: 14px; color: var(--text-primary);">DeepSeek Official</span>
                      <span class="status-badge" style="background: var(--bg-secondary); color: var(--text-secondary);">可选配置</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
                      • API 密钥变量: <code style="color: var(--accent-primary);">DEEPSEEK_API_KEY</code><br />
                      • 官方端点: <code style="font-size: 11px;">https://api.deepseek.com</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: 插件与工具 ================= */}
          {activeTab === 'plugins' && (
            <div>
              {/* Web Search Provider */}
              <div class="settings-section">
                <div class="settings-section-title">
                  <SearchIcon size={14} />
                  <span>联网搜索提供方 (web-search-selector)</span>
                </div>
                <div class="settings-card">
                  {[
                    { id: 'antigravity', name: 'Google Antigravity 搜索源 (推荐)', desc: '基于 Google 原生联网与多源聚合，支持实时抓取' },
                    { id: 'deepseek-official', name: 'DeepSeek 官方搜索源', desc: '调用 DeepSeek 原生 web_search 服务器工具' },
                  ].map((p) => (
                    <div
                      key={p.id}
                      class="settings-row"
                      onClick={() => handleSearchProviderChange(p.id)}
                    >
                      <div>
                        <div class="settings-row-label">{p.name}</div>
                        <div class="settings-row-desc">{p.desc}</div>
                      </div>
                      {searchProvider === p.id && <CheckIcon size={16} className="text-accent" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Cloudflare Tunnel & Worker Router */}
              <div class="settings-section">
                <div class="settings-section-title">
                  <span>☁️ 网络穿透与反代 (Cloudflare Tunnel)</span>
                </div>
                <div class="settings-card" style="padding: 12px 14px; gap: 8px; font-size: 12px;">
                  <div class="flex items-center justify-between">
                    <span style="color: var(--text-secondary);">Tunnel 运行状态</span>
                    <span class="status-badge completed">在线 Online</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span style="color: var(--text-secondary);">本地服务端口</span>
                    <span style="font-weight: 600; color: var(--text-primary);">3080</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span style="color: var(--text-secondary);">Worker 专属反代域名</span>
                    <a href="https://dsh.b-1.workers.dev" target="_blank" style="color: var(--accent-primary); text-decoration: none;">dsh.b-1.workers.dev</a>
                  </div>
                </div>
              </div>

              {/* Installed Plugins Roster */}
              <div class="settings-section">
                <div class="settings-section-title">
                  <span>📦 已挂载插件清单 (Plugin Roster)</span>
                </div>
                <div class="settings-card" style="padding: 10px 14px; gap: 6px; font-size: 12px;">
                  {[
                    { name: 'dsh-mobile-webui', desc: '独立移动端原生 WebUI 插件 (/mobile)', status: 'active' },
                    { name: 'dsh-llm-antigravity', desc: 'Google Gemini 旗舰多模态推理引擎', status: 'active' },
                    { name: 'dsh-web-search-selector', desc: '多源动态联网搜索选择器', status: 'active' },
                    { name: 'dsh-image-gen-antigravity', desc: 'Gemini 3.1 图像生成与修改', status: 'active' },
                    { name: 'dsh-fail-soft', desc: '全局运行时故障软隔离与异常保护', status: 'active' },
                    { name: 'dsh-cloudflare-tunnel', desc: 'Cloudflare 隧道管理与路由同步', status: 'online' },
                  ].map((p, idx) => (
                    <div key={idx} class="flex items-center justify-between py-1" style="border-bottom: 1px solid var(--border-subtle);">
                      <div>
                        <div style="font-weight: 600; color: var(--text-primary);">{p.name}</div>
                        <div style="color: var(--text-muted); font-size: 11px;">{p.desc}</div>
                      </div>
                      <span class="status-badge completed" style="font-size: 10px;">{p.status}</span>
                    </div>
                  ))}
                </div>
              </div>
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
