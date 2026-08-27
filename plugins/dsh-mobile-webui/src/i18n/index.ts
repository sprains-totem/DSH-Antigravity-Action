export type Locale = 'zh-CN' | 'en-US';

export const translations = {
  'zh-CN': {
    // Header & Common
    newChat: '新建会话',
    sessionList: '会话列表',
    switchModel: '切换模型',
    sessionSettings: '会话管理',
    newSession: '新对话',
    active: '运行中',
    save: '保存',
    saved: '已保存',
    cancel: '取消',
    confirm: '确认',
    refresh: '刷新',
    clear: '清空',
    close: '关闭',
    delete: '删除',
    export: '导出',
    rename: '重命名',
    copy: '复制',
    copied: '已复制',
    offline: '离线',
    connecting: '连接中',
    connected: '在线',
    error: '错误',
    loading: '加载中...',

    // Composer
    placeholder: '给 Agent 发送消息或任务指令...',
    stop: '停止',
    send: '发送',
    permission: '权限',
    permFull: '完全控制',
    permWorkspace: '工作区读写',
    permReadOnly: '只读模式',

    // Tabs in Settings
    settingsTitle: '系统设置',
    tabGeneral: '常规',
    tabModels: '模型',
    tabPlugins: '插件',
    tabYaml: 'YAML',

    // General Settings
    appearance: '外观模式 (Theme)',
    themeDark: '暗色模式 (Dark)',
    themeDarkDesc: '沉浸式深色界面，夜间护眼',
    themeLight: '亮色模式 (Light)',
    themeLightDesc: '明亮通透的白天视觉风格',
    language: '界面语言 (Language)',
    langZh: '简体中文 (Chinese)',
    langEn: 'English (US)',
    defaultPermPreset: '默认权限预设 (Default Permission)',
    permFullDesc: '跳过所有文件与命令审批，全自主执行',
    permWorkspaceDesc: '仅允许修改工作区文件，外部需审批',
    permReadOnlyDesc: '禁止所有文件与命令写操作',
    execEngine: '执行引擎参数 (Execution Engine)',
    maxParallelTools: '最大并行工具调用数',
    shellTimeout: 'Shell 命令执行超时',
    concurrencyUnit: '个并发',
    secondsUnit: '秒',
    defaultSuffix: ' (默认)',

    // Models Settings
    defaultModelTitle: '新建会话默认 Agent 模型 (Default Model)',
    thinkingTierTitle: '🧠 思考深度档位 (Reasoning Effort)',
    thinkingHigh: 'High (深度思考 - 推荐)',
    thinkingHighDesc: '充分展开思维链，最强逻辑与代码推理（路由至 gemini-3.7-flash-high）',
    thinkingMedium: 'Medium (中等思考)',
    thinkingMediumDesc: '平衡思考深度与响应速度（路由至 gemini-3.7-flash-medium）',
    thinkingLow: 'Low (快速生成)',
    thinkingLowDesc: '缩减思考过程，追求首字响应时延（路由至 gemini-3.7-flash-low）',

    // Plugins Settings
    pluginsListTitle: '🔌 已注册插件配置列表 (Plugin Cards)',
    discoveringPlugins: '正在自省发现插件配置...',
    unsavedChanges: '• 未保存修改',
    quotaTab: '📊 实时额度',
    usageTab: '📈 用量统计',
    valuationTab: '💰 额度估算',
    configTab: '⚙️ 凭据配置',
    project: '项目',
    tier: '权益',
    autoDetect: '自动识别',
    fiveHourRemaining: '5小时限额剩余',
    weeklyRemaining: '每周限额剩余',
    resetsIn: '后重置',
    callingAndCacheStats: '调用与缓存统计',
    totalRequests: '调用总次数',
    inputTokens: '实际输入 Tokens',
    outputTokens: '实际输出 Tokens',
    cacheSavingsRate: '缓存节省率',
    clearUsageConfirm: '确定清空所有 Antigravity 历史调用统计记录吗？',
    tokenConfigTip: '配置 Google Cloud Code OAuth 2.0 Refresh Token 与 Base URL：',
    saveConfig: '保存配置',

    // Valuation
    valuationTitle: '额度消耗与价值估算 (USD Valuation)',
    period5h: '当前 5h 周期',
    periodWeekly: '当前周度',
    periodAll: '历史全量',
    grossTokens: '总计 Tokens',
    estValue: '等效商业价值',
    savedRate: '缓存节省率',
    pricingCustomTitle: '自定义模型计费单价 ($/1M Tokens)',

    // Session Settings Sheet
    sessionSettingsTitle: '当前会话独立设置 (Session Settings)',
    sessionTitleAndId: '会话标题与标识',
    sessionModel: '本会话专属模型 (SESSION MODEL)',
    reasoningEffortTitle: '思考推理深度 (REASONING EFFORT)',
    sessionStatsTitle: '本会话 Token 与工具用量',
    sessionActionsTitle: '会话操作 (ACTIONS)',
    exportMarkdown: '导出完整对话为 Markdown',
    clearHistory: '清空当前视图历史消息',
    clearHistoryDesc: '重置当前会话的对话气泡，保持上下文清爽',
    deleteSessionPermanent: '彻底删除当前会话',
    deleteSessionDesc: '永久删除本会话及所有历史记录',
    goToGlobalSettings: '⚙️ 前往系统全局设置 (Global Settings) →',
  },
  'en-US': {
    // Header & Common
    newChat: 'New Chat',
    sessionList: 'Sessions',
    switchModel: 'Switch Model',
    sessionSettings: 'Session Settings',
    newSession: 'New Chat',
    active: 'Active',
    save: 'Save',
    saved: 'Saved',
    cancel: 'Cancel',
    confirm: 'Confirm',
    refresh: 'Refresh',
    clear: 'Clear',
    close: 'Close',
    delete: 'Delete',
    export: 'Export',
    rename: 'Rename',
    copy: 'Copy',
    copied: 'Copied',
    offline: 'Offline',
    connecting: 'Connecting',
    connected: 'Online',
    error: 'Error',
    loading: 'Loading...',

    // Composer
    placeholder: 'Message or assign a task to Agent...',
    stop: 'Stop',
    send: 'Send',
    permission: 'Permission',
    permFull: 'Full Access',
    permWorkspace: 'Workspace',
    permReadOnly: 'Read-only',

    // Tabs in Settings
    settingsTitle: 'Settings',
    tabGeneral: 'General',
    tabModels: 'Models',
    tabPlugins: 'Plugins',
    tabYaml: 'YAML',

    // General Settings
    appearance: 'Appearance (Theme)',
    themeDark: 'Dark Theme',
    themeDarkDesc: 'Immersive dark interface, easier on the eyes',
    themeLight: 'Light Theme',
    themeLightDesc: 'Clean and bright daytime visual style',
    language: 'Language',
    langZh: '简体中文 (Chinese)',
    langEn: 'English (US)',
    defaultPermPreset: 'Default Permission Preset',
    permFullDesc: 'Skip all approvals for files and commands, full autonomy',
    permWorkspaceDesc: 'Allow workspace writes only; external actions require approval',
    permReadOnlyDesc: 'Disallow all file and command writes',
    execEngine: 'Execution Engine',
    maxParallelTools: 'Max Parallel Tool Calls',
    shellTimeout: 'Shell Command Timeout',
    concurrencyUnit: ' concurrent',
    secondsUnit: 's',
    defaultSuffix: ' (Default)',

    // Models Settings
    defaultModelTitle: 'Default Agent Model for New Sessions',
    thinkingTierTitle: '🧠 Reasoning Effort',
    thinkingHigh: 'High (Deep Reasoning - Recommended)',
    thinkingHighDesc: 'Full chain-of-thought, best logic and code generation (routes to gemini-3.7-flash-high)',
    thinkingMedium: 'Medium (Balanced)',
    thinkingMediumDesc: 'Balanced reasoning depth and latency (routes to gemini-3.7-flash-medium)',
    thinkingLow: 'Low (Fast Generation)',
    thinkingLowDesc: 'Minimal reasoning, lowest time-to-first-token (routes to gemini-3.7-flash-low)',

    // Plugins Settings
    pluginsListTitle: '🔌 Registered Plugin Configuration Cards',
    discoveringPlugins: 'Discovering registered plugins...',
    unsavedChanges: '• Unsaved changes',
    quotaTab: '📊 Live Quota',
    usageTab: '📈 Usage Stats',
    valuationTab: '💰 Valuation',
    configTab: '⚙️ Credentials',
    project: 'Project',
    tier: 'Tier',
    autoDetect: 'Auto-detected',
    fiveHourRemaining: '5h Window Remaining',
    weeklyRemaining: 'Weekly Quota Remaining',
    resetsIn: 'resets in',
    callingAndCacheStats: 'Execution & Cache Statistics',
    totalRequests: 'Total Requests',
    inputTokens: 'Input Tokens',
    outputTokens: 'Output Tokens',
    cacheSavingsRate: 'Cache Savings',
    clearUsageConfirm: 'Are you sure you want to clear all Antigravity usage records?',
    tokenConfigTip: 'Configure Google Cloud Code OAuth 2.0 Refresh Token & Base URL:',
    saveConfig: 'Save Configuration',

    // Valuation
    valuationTitle: 'Quota Consumption & Valuation (USD)',
    period5h: 'Current 5h Window',
    periodWeekly: 'Current Week',
    periodAll: 'All-Time History',
    grossTokens: 'Gross Tokens',
    estValue: 'Equivalent Market Value',
    savedRate: 'Cache Savings Rate',
    pricingCustomTitle: 'Custom Model Pricing ($/1M Tokens)',

    // Session Settings Sheet
    sessionSettingsTitle: 'Session Settings',
    sessionTitleAndId: 'Session Title & ID',
    sessionModel: 'Session Dedicated Model (SESSION MODEL)',
    reasoningEffortTitle: 'Reasoning Effort',
    sessionStatsTitle: 'Session Token & Tool Usage',
    sessionActionsTitle: 'Session Actions (ACTIONS)',
    exportMarkdown: 'Export Full Chat as Markdown',
    clearHistory: 'Clear Chat History',
    clearHistoryDesc: 'Reset message bubbles in this session view',
    deleteSessionPermanent: 'Delete Session Permanently',
    deleteSessionDesc: 'Permanently remove this session and all history',
    goToGlobalSettings: '⚙️ Go to Global System Settings →',
  },
};

let currentLocale: Locale = (localStorage.getItem('dsh_mobile_locale') as Locale) || 'zh-CN';
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(loc: Locale): void {
  currentLocale = loc;
  localStorage.setItem('dsh_mobile_locale', loc);
  for (const listener of listeners) {
    try { listener(); } catch {}
  }
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key: keyof typeof translations['zh-CN']): string {
  const dict = translations[currentLocale] || translations['zh-CN'];
  return (dict as any)[key] || (translations['zh-CN'] as any)[key] || key;
}
