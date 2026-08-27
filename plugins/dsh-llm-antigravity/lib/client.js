(function() {
	const NS = "llm-antigravity";
	const TOKEN_REF = "ANTIGRAVITY_REFRESH_TOKEN";

	const en = {
		title: "Antigravity (Google Cloud Code)",
		description: "Google Cloud Code Gemini adapter with OAuth 2.0 refresh_token, live quota, usage statistics & USD valuation estimation.",
		tabQuota: "Real-time Quota",
		tabUsage: "Usage Statistics",
		tabValuation: "Quota Estimation",
		tabConfig: "Settings",
		tokenLabel: "Refresh Token",
		tokenHint: "Google Cloud Code OAuth 2.0 refresh token. Stored securely in credentials service.",
		tokenConfigured: "Configured",
		tokenMissing: "Unconfigured",
		tokenPlaceholder: "OAuth 2.0 Refresh Token",
		tokenPlaceholderSet: "Refresh Token configured (leave blank to keep unchanged)",
		baseUrlLabel: "Base URL",
		baseUrlHint: "Default: https://daily-cloudcode-pa.googleapis.com/v1internal",
		save: "Save",
		saving: "Saving…",
		discard: "Discard",
		unsaved: "Unsaved",
		refreshQuota: "Refresh Quota",
		refreshing: "Refreshing…",
		lastUpdated: "Updated",
		quotaTier: "Tier",
		quotaProject: "Project",
		limit5h: "5-Hour Limit",
		limitWeekly: "Weekly Limit",
		remaining: "Remaining",
		resetsIn: "Resets in",
		resetsAt: "Reset time",
		quotaMissingToken: "No Refresh Token configured. Please configure your token in the Settings tab.",
		gotoConfig: "Go to Settings",
		quotaLoading: "Loading quota data…",
		quotaError: "Failed to load quota",
		retry: "Retry",
		modelsQuota: "Model-specific Quotas",
		usageSummary: "Usage Overview",
		totalRequests: "Total Calls",
		totalInput: "Input Tokens",
		totalOutput: "Output Tokens",
		totalCacheRead: "Cached Read Tokens",
		totalReasoning: "Reasoning Tokens",
		cacheSavings: "Cache Savings",
		cacheHitRate: "Cache Hit Rate",
		modelBreakdown: "Model Usage Breakdown",
		recentRequests: "Recent Calls",
		noUsageData: "No usage data recorded yet. Make some requests to see stats.",
		clearUsage: "Clear Stats",
		confirmClear: "Are you sure you want to clear all usage history?",
		clearing: "Clearing…",
		timeCol: "Time",
		modelCol: "Model",
		tokensCol: "Tokens",
		durationCol: "Latency",
		savingsCol: "Savings",

		// Valuation & Estimation
		period5h: "5-Hour Window",
		periodWeekly: "Weekly Window",
		periodAll: "All Time",
		groupAll: "All Groups",
		groupGemini: "Gemini Group",
		group3p: "Claude / GPT Group",
		windowNotice5h: "5-Hour backward window based on quota reset time",
		windowNoticeWeekly: "7-Day (1-Week) backward window based on quota reset time",
		windowNoticeAll: "Cumulative usage across all recorded history",
		windowRangeLabel: "Calculation Window",
		usedCostTitle: "Consumed USD in Window",
		quotaRemainingPct: "Quota Remaining",
		quotaConsumedPct: "Quota Consumed",
		estTotalQuotaTitle: "Est. Total Quota Value",
		estRemainingQuotaTitle: "Est. Remaining Value",
		estFormulaHint: "Extrapolated proportionally from USD tokens consumed and Google quota deduction ratio",
		estRemainingHint: "Equivalent USD value of remaining tokens available in this cycle",
		estZeroNotice: "Quota is 100% full (0% consumed). Total quota value will be calculated dynamically once requests are made.",
		estExtNotice: "External quota deduction detected, but local token log is empty in this window. Send a prompt to calibrate.",
		noUsageInWindow: "No requests recorded within this window.",
		pricingTableTitle: "Custom Pricing & USD Token Valuation",
		pricingNote: "Prices are in USD per 1 Million Tokens ($/1M). Thinking/reasoning tokens are billed at the output rate.",
		inputTokensCol: "Input Tokens",
		inputPriceCol: "Input ($/1M)",
		outputTokensCol: "Output (inc. Reasoning)",
		outputPriceCol: "Output ($/1M)",
		cacheTokensCol: "Cache Read",
		cachePriceCol: "Cache ($/1M)",
		periodCostCol: "Period Cost (USD)",
		resetPricingBtn: "Reset to Official Defaults",
		savePricingBtn: "Save Pricing",
		pricingSavedToast: "Pricing saved",
		totalPeriodCost: "Total Cost",
		showAllModelsToggle: "Show all supported models",
		hideAllModelsToggle: "Show active models only",
		perModelEstTitle: "Per-Model Quota Breakdown",
		perModelHeader: "Model",
		perModelRemHeader: "Remaining %",
		perModelCostHeader: "Used ($)",
		perModelTotalHeader: "Est. Total ($)",
		perModelRemValHeader: "Est. Remaining ($)"
	};

	const zh = {
		title: "Antigravity (Google Cloud Code)",
		description: "Google Cloud Code Gemini 适配器，支持 OAuth 2.0 认证、实时额度监控、Token 用量统计与 5小时/周额度美元价值预估。",
		tabQuota: "实时额度",
		tabUsage: "用量统计",
		tabValuation: "额度估算",
		tabConfig: "基本配置",
		tokenLabel: "Refresh Token",
		tokenHint: "Google Cloud Code OAuth 2.0 刷新令牌，安全保存在本地凭据库中。",
		tokenConfigured: "已配置",
		tokenMissing: "未配置",
		tokenPlaceholder: "请输入 OAuth 2.0 Refresh Token",
		tokenPlaceholderSet: "Refresh Token 已配置（留空保持不变）",
		baseUrlLabel: "接口地址 (Base URL)",
		baseUrlHint: "默认: https://daily-cloudcode-pa.googleapis.com/v1internal",
		save: "保存",
		saving: "保存中…",
		discard: "放弃修改",
		unsaved: "未保存",
		refreshQuota: "刷新额度",
		refreshing: "刷新中…",
		lastUpdated: "更新于",
		quotaTier: "账号权益",
		quotaProject: "关联项目",
		limit5h: "5小时限额",
		limitWeekly: "每周限额",
		remaining: "剩余",
		resetsIn: "重置倒计时",
		resetsAt: "重置时刻",
		quotaMissingToken: "未检测到 Refresh Token。请先在【基本配置】标签页中填入并保存 Token。",
		gotoConfig: "前往配置",
		quotaLoading: "正在查询实时额度…",
		quotaError: "查询额度失败",
		retry: "重试",
		modelsQuota: "具体模型可用额度",
		usageSummary: "用量总览",
		totalRequests: "调用总次数",
		totalInput: "实际输入 Tokens",
		totalOutput: "实际输出 Tokens",
		totalCacheRead: "前缀缓存读取",
		totalReasoning: "思考链消耗",
		cacheSavings: "缓存节省率",
		cacheHitRate: "缓存命中率",
		modelBreakdown: "各模型用量分布",
		recentRequests: "最近调用记录",
		noUsageData: "暂无用量记录。发起对话后将在此实时统计 Token 与缓存命中率。",
		clearUsage: "清空统计",
		confirmClear: "确定要清空所有历史用量统计吗？",
		clearing: "清空中…",
		timeCol: "时间",
		modelCol: "模型",
		tokensCol: "Token 消耗",
		durationCol: "耗时",
		savingsCol: "缓存节省",

		// Valuation & Estimation
		period5h: "5小时周期",
		periodWeekly: "周额度周期",
		periodAll: "全部历史",
		groupAll: "全部模型组",
		groupGemini: "Gemini 额度组",
		group3p: "Claude / GPT 额度组",
		windowNotice5h: "按照 5小时 额度重置时间往前倒推 5 小时统计各模型用量",
		windowNoticeWeekly: "按照 每周 额度重置时间往前倒推 7 天 (1周) 统计各模型用量",
		windowNoticeAll: "统计本地记录的所有历史调用用量",
		windowRangeLabel: "统计时间窗口",
		usedCostTitle: "本周期已消耗价值",
		quotaRemainingPct: "额度剩余比例",
		quotaConsumedPct: "已消耗额度比例",
		estTotalQuotaTitle: "周期总额度预估价值",
		estRemainingQuotaTitle: "周期剩余可用价值",
		estFormulaHint: "根据本周期实际消耗美元与 Google 额度扣减比例动态反推",
		estRemainingHint: "当前剩余百分比对应的等价 Token 美元可用总额度",
		estZeroNotice: "本周期额度 100% 完整（未发生消耗）。发起请求后将依据消耗比例自动推算总价值额度。",
		estExtNotice: "检测到额度存在扣减，但本地窗口内尚无调用记录。发起请求后将自动校准估值。",
		noUsageInWindow: "当前时间窗口内暂无调用记录。",
		pricingTableTitle: "各模型自定义定价与用量折算",
		pricingNote: "定价单位为美元/百万 Token ($/1M Tokens)。输出定价含思维链 (Reasoning/Thinking) Token。",
		inputTokensCol: "实际输入 Token",
		inputPriceCol: "输入单价 ($/1M)",
		outputTokensCol: "输出 Token (含思维链)",
		outputPriceCol: "输出单价 ($/1M)",
		cacheTokensCol: "缓存读取 Token",
		cachePriceCol: "缓存单价 ($/1M)",
		periodCostCol: "本周期折算 ($)",
		resetPricingBtn: "恢复官方默认定价",
		savePricingBtn: "保存自定义定价",
		pricingSavedToast: "定价配置已保存",
		totalPeriodCost: "总计折算消耗",
		showAllModelsToggle: "展开所有支持的模型",
		hideAllModelsToggle: "仅显示有调用的模型",
		perModelEstTitle: "各模型独立额度与价值测算",
		perModelHeader: "模型名称",
		perModelRemHeader: "剩余比例",
		perModelCostHeader: "已消耗 ($)",
		perModelTotalHeader: "估算总额度 ($)",
		perModelRemValHeader: "估算剩余 ($)"
	};

	const DEFAULT_MODEL_PRICING = {
		"gemini-3.7-flash-high": { input: 0.10, output: 0.40, cache: 0.025 },
		"gemini-3.7-flash-medium": { input: 0.10, output: 0.40, cache: 0.025 },
		"gemini-3.7-flash-low": { input: 0.10, output: 0.40, cache: 0.025 },
		"gemini-3.7-flash-tiered": { input: 0.10, output: 0.40, cache: 0.025 },
		"gemini-3.6-flash-high": { input: 0.10, output: 0.40, cache: 0.025 },
		"gemini-3.6-flash-medium": { input: 0.10, output: 0.40, cache: 0.025 },
		"gemini-3.6-flash-low": { input: 0.10, output: 0.40, cache: 0.025 },
		"gemini-3.6-flash-tiered": { input: 0.10, output: 0.40, cache: 0.025 },
		"gemini-3.5-flash-low": { input: 0.10, output: 0.40, cache: 0.025 },
		"gemini-3.5-flash-extra-low": { input: 0.10, output: 0.40, cache: 0.025 },
		"gemini-3-flash": { input: 0.10, output: 0.40, cache: 0.025 },
		"gemini-3-flash-agent": { input: 0.10, output: 0.40, cache: 0.025 },
		"gemini-3.1-flash-lite": { input: 0.075, output: 0.30, cache: 0.01875 },
		"gemini-3.1-flash-image": { input: 0.10, output: 0.40, cache: 0.025 },
		"gemini-2.5-flash": { input: 0.10, output: 0.40, cache: 0.025 },
		"gemini-2.5-flash-lite": { input: 0.075, output: 0.30, cache: 0.01875 },
		"gemini-2.5-flash-thinking": { input: 0.10, output: 0.40, cache: 0.025 },
		"gemini-2.5-pro": { input: 1.25, output: 5.00, cache: 0.3125 },
		"gemini-3.1-pro-high": { input: 1.25, output: 5.00, cache: 0.3125 },
		"gemini-3.1-pro-low": { input: 1.25, output: 5.00, cache: 0.3125 },
		"gemini-pro-agent": { input: 1.25, output: 5.00, cache: 0.3125 },
		"claude-sonnet-4-6": { input: 3.00, output: 15.00, cache: 0.30 },
		"claude-opus-4-6-thinking": { input: 15.00, output: 75.00, cache: 1.50 },
		"gpt-oss-120b-medium": { input: 0.50, output: 2.00, cache: 0.10 }
	};
	const DEFAULT_FALLBACK_PRICING = { input: 0.10, output: 0.40, cache: 0.025 };

	function getModelGroup(modelId) {
		const lower = (modelId || "").toLowerCase();
		if (lower.startsWith("claude") || lower.startsWith("gpt") || lower.includes("3p")) return "3p";
		return "gemini";
	}

	function formatTokens(num) {
		if (num === void 0 || num === null || isNaN(num)) return "0";
		if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
		if (num >= 1000) return (num / 1000).toFixed(1) + "k";
		return num.toLocaleString();
	}

	function formatCurrency(num) {
		if (num === void 0 || num === null || isNaN(num)) return "$0.00";
		if (num === 0) return "$0.00";
		if (num < 0.0001 && num > 0) return "< $0.0001";
		if (num < 0.01 && num > 0) return "$" + num.toFixed(4);
		if (num < 1) return "$" + num.toFixed(4);
		if (num < 100) return "$" + num.toFixed(2);
		return "$" + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function formatDuration(ms) {
		if (!ms || isNaN(ms)) return "0ms";
		if (ms >= 1000) return (ms / 1000).toFixed(1) + "s";
		return ms + "ms";
	}

	function formatTimeAgo(isoString) {
		if (!isoString) return "";
		try {
			const diff = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
			if (diff < 60) return "刚刚";
			if (diff < 3600) return Math.floor(diff / 60) + " 分钟前";
			if (diff < 86400) return Math.floor(diff / 3600) + " 小时前";
			return Math.floor(diff / 86400) + " 天前";
		} catch (e) {
			return isoString.slice(11, 19);
		}
	}

	function formatCountdown(seconds) {
		if (seconds <= 0) return "即将重置";
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		if (days > 0) return `${days} 天 ${hours} 小时`;
		if (hours > 0) return `${hours} 小时 ${mins} 分钟`;
		return `${mins} 分钟`;
	}

	function getPercentColor(pct) {
		if (pct >= 50) return { bar: "#16a34a", bg: "#dcfce7", text: "#15803d" };
		if (pct >= 20) return { bar: "#d97706", bg: "#fef3c7", text: "#b45309" };
		return { bar: "#dc2626", bg: "#fee2e2", text: "#b91c1c" };
	}

	const factory = (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react_jsx_runtime = require("react/jsx-runtime");
		const react = require("react");
		const _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");

		function AntigravityCard(props) {
			const [open, setOpen] = react.useState(true);
			const [activeTab, setActiveTab] = react.useState("quota"); // 'quota' | 'usage' | 'valuation' | 'config'
			const { t } = props;
			const state = props.useAntigravityCard((snapshot) => snapshot);
			const disabled = !state.writable;
			const dirty = state.draftToken !== void 0 || state.draftBaseUrl !== void 0;

			// Quota & Usage local states
			const [quotaData, setQuotaData] = react.useState(null);
			const [loadingQuota, setLoadingQuota] = react.useState(false);
			const [quotaError, setQuotaError] = react.useState(null);

			const [usageData, setUsageData] = react.useState(null);
			const [loadingUsage, setLoadingUsage] = react.useState(false);
			const [usageError, setUsageError] = react.useState(null);
			const [clearingUsage, setClearingUsage] = react.useState(false);

			// Valuation specific states
			const [activeValuationPeriod, setActiveValuationPeriod] = react.useState("5h"); // '5h' | 'weekly' | 'all'
			const [selectedGroupFilter, setSelectedGroupFilter] = react.useState("all"); // 'all' | 'gemini' | '3p'
			const [showAllCatalogModels, setShowAllCatalogModels] = react.useState(false);
			const [pricingSavedToast, setPricingSavedToast] = react.useState(false);

			const [pricing, setPricing] = react.useState(() => {
				try {
					if (typeof window !== "undefined" && window.localStorage) {
						const saved = window.localStorage.getItem("antigravity_pricing_v1");
						if (saved) {
							const parsed = JSON.parse(saved);
							return { ...DEFAULT_MODEL_PRICING, ...parsed };
						}
					}
				} catch (e) {}
				return { ...DEFAULT_MODEL_PRICING };
			});

			const handlePriceChange = (modelId, key, val) => {
				const num = parseFloat(val);
				const currentModelPricing = pricing[modelId] || DEFAULT_MODEL_PRICING[modelId] || DEFAULT_FALLBACK_PRICING;
				const next = {
					...pricing,
					[modelId]: {
						...currentModelPricing,
						[key]: isNaN(num) ? 0 : num
					}
				};
				setPricing(next);
				try {
					if (typeof window !== "undefined" && window.localStorage) {
						window.localStorage.setItem("antigravity_pricing_v1", JSON.stringify(next));
					}
				} catch (e) {}
			};

			const handleResetPricing = () => {
				setPricing({ ...DEFAULT_MODEL_PRICING });
				try {
					if (typeof window !== "undefined" && window.localStorage) {
						window.localStorage.removeItem("antigravity_pricing_v1");
					}
				} catch (e) {}
				setPricingSavedToast(true);
				setTimeout(() => setPricingSavedToast(false), 2000);
			};

			const handleSavePricing = () => {
				try {
					if (typeof window !== "undefined" && window.localStorage) {
						window.localStorage.setItem("antigravity_pricing_v1", JSON.stringify(pricing));
					}
				} catch (e) {}
				setPricingSavedToast(true);
				setTimeout(() => setPricingSavedToast(false), 2000);
			};

			const fetchQuota = react.useCallback(async (force = false) => {
				if (!state.tokenConfigured) return;
				setLoadingQuota(true);
				setQuotaError(null);
				try {
					const res = await fetch(`/api/antigravity/quota${force ? "?force=true" : ""}`, {
						method: force ? "POST" : "GET"
					});
					if (!res.ok) {
						const text = await res.text().catch(() => "");
						if (res.status === 404) {
							setQuotaError("DSH 后端服务尚未加载最新插件接口，请重启 DSH 服务 (HTTP 404)");
							return;
						}
						setQuotaError(`HTTP ${res.status}: ${text.slice(0, 120)}`);
						return;
					}
					const text = await res.text();
					let json;
					try {
						json = JSON.parse(text);
					} catch {
						setQuotaError("返回数据格式非有效 JSON，请确保 DSH 后端已重启并更新");
						return;
					}
					if (json.ok) {
						setQuotaData(json);
					} else {
						setQuotaError(json.error || "Failed to fetch quota");
					}
				} catch (e) {
					setQuotaError(e.message || "Network error");
				} finally {
					setLoadingQuota(false);
				}
			}, [state.tokenConfigured]);

			const fetchUsage = react.useCallback(async () => {
				setLoadingUsage(true);
				setUsageError(null);
				try {
					const res = await fetch("/api/antigravity/usage");
					if (!res.ok) {
						const text = await res.text().catch(() => "");
						if (res.status === 404) {
							setUsageError("DSH 后端服务尚未加载最新插件接口，请重启 DSH 服务 (HTTP 404)");
							return;
						}
						setUsageError(`HTTP ${res.status}: ${text.slice(0, 120)}`);
						return;
					}
					const text = await res.text();
					let json;
					try {
						json = JSON.parse(text);
					} catch {
						setUsageError("返回数据格式非有效 JSON，请确保 DSH 后端已重启并更新");
						return;
					}
					if (json.ok) {
						setUsageData(json.stats);
					} else {
						setUsageError(json.error || "Failed to fetch usage");
					}
				} catch (e) {
					setUsageError(e.message || "Network error");
				} finally {
					setLoadingUsage(false);
				}
			}, []);

			const handleClearUsage = react.useCallback(async () => {
				if (!confirm(t("confirmClear"))) return;
				setClearingUsage(true);
				try {
					const res = await fetch("/api/antigravity/usage", { method: "DELETE" });
					const json = await res.json();
					if (json.ok) {
						await fetchUsage();
					}
				} catch (e) {
					console.error(e);
				} finally {
					setClearingUsage(false);
				}
			}, [t, fetchUsage]);

			// Auto fetch when opening tab
			react.useEffect(() => {
				if (open && (activeTab === "quota" || activeTab === "valuation") && !quotaData && state.tokenConfigured) {
					fetchQuota(false);
				}
				if (open && (activeTab === "usage" || activeTab === "valuation") && !usageData) {
					fetchUsage();
				}
			}, [open, activeTab, state.tokenConfigured, quotaData, usageData, fetchQuota, fetchUsage]);

			// -------------------------------------------------------------
			// Compute Window & Quota Valuation Calculation
			// -------------------------------------------------------------
			let targetBucket = null;
			let bucketResetTime = null;
			let bucketRemainingFraction = null;
			let bucketResetInSeconds = 0;

			if (quotaData && Array.isArray(quotaData.groups)) {
				const geminiGroup = quotaData.groups.find(g => (g.displayName || "").toLowerCase().includes("gemini"));
				const thirdPartyGroup = quotaData.groups.find(g => (g.displayName || "").toLowerCase().includes("claude") || (g.displayName || "").toLowerCase().includes("3p"));

				let activeGroupObj = null;
				if (selectedGroupFilter === "gemini") activeGroupObj = geminiGroup;
				else if (selectedGroupFilter === "3p") activeGroupObj = thirdPartyGroup;
				else activeGroupObj = geminiGroup || quotaData.groups[0];

				if (activeGroupObj && Array.isArray(activeGroupObj.buckets)) {
					if (activeValuationPeriod === "5h") {
						targetBucket = activeGroupObj.buckets.find(b => b.window === "5h") || activeGroupObj.buckets[1] || activeGroupObj.buckets[0];
					} else if (activeValuationPeriod === "weekly") {
						targetBucket = activeGroupObj.buckets.find(b => b.window === "weekly") || activeGroupObj.buckets[0];
					}
				}
				if (targetBucket) {
					bucketResetTime = targetBucket.resetTime;
					bucketRemainingFraction = typeof targetBucket.remainingFraction === "number" ? targetBucket.remainingFraction : null;
					bucketResetInSeconds = targetBucket.resetInSeconds || 0;
				}
			}

			// Time range computation
			const nowMs = Date.now();
			let windowEndMs = nowMs;
			if (bucketResetTime) {
				const parsed = new Date(bucketResetTime).getTime();
				if (!isNaN(parsed)) windowEndMs = parsed;
			}
			let windowStartMs = 0;
			if (activeValuationPeriod === "5h") {
				windowStartMs = windowEndMs - (5 * 3600 * 1000);
			} else if (activeValuationPeriod === "weekly") {
				windowStartMs = windowEndMs - (7 * 24 * 3600 * 1000);
			} else {
				windowStartMs = 0;
				windowEndMs = nowMs + 86400000;
			}

			// Aggregate usage items in [windowStartMs, windowEndMs]
			const historyList = (usageData && Array.isArray(usageData.history) && usageData.history.length > 0)
				? usageData.history
				: ((usageData && Array.isArray(usageData.recent)) ? usageData.recent : []);

			const windowModelStats = {};
			if (activeValuationPeriod === "all" && usageData && usageData.byModel) {
				for (const [mName, mStat] of Object.entries(usageData.byModel)) {
					if (selectedGroupFilter !== "all" && getModelGroup(mName) !== selectedGroupFilter) continue;
					windowModelStats[mName] = {
						requests: mStat.requests || 0,
						inputTokens: mStat.inputTokens || 0,
						outputTokens: mStat.outputTokens || 0,
						reasoningTokens: mStat.reasoningTokens || 0,
						cacheReadTokens: mStat.cacheReadTokens || 0,
						totalTokens: mStat.totalTokens || 0,
					};
				}
			} else {
				for (const rec of historyList) {
					const recTime = new Date(rec.timestamp).getTime();
					if (isNaN(recTime)) continue;
					if (recTime >= windowStartMs && recTime <= windowEndMs) {
						const mName = rec.model || "unknown";
						if (selectedGroupFilter !== "all" && getModelGroup(mName) !== selectedGroupFilter) continue;
						if (!windowModelStats[mName]) {
							windowModelStats[mName] = {
								requests: 0,
								inputTokens: 0,
								outputTokens: 0,
								reasoningTokens: 0,
								cacheReadTokens: 0,
								totalTokens: 0,
							};
						}
						const st = windowModelStats[mName];
						st.requests++;
						st.inputTokens += (rec.inputTokens || 0);
						st.outputTokens += (rec.outputTokens || 0);
						st.reasoningTokens += (rec.reasoningTokens || 0);
						st.cacheReadTokens += (rec.cacheReadTokens || 0);
						st.totalTokens += ((rec.inputTokens || 0) + (rec.outputTokens || 0) + (rec.reasoningTokens || 0));
					}
				}
			}

			// Compile model cost list
			const displayedModelKeys = new Set(Object.keys(windowModelStats));
			if (showAllCatalogModels) {
				for (const k of Object.keys(DEFAULT_MODEL_PRICING)) {
					if (selectedGroupFilter === "all" || getModelGroup(k) === selectedGroupFilter) {
						displayedModelKeys.add(k);
					}
				}
			}

			let totalPeriodInputTokens = 0;
			let totalPeriodOutputTokens = 0;
			let totalPeriodReasoningTokens = 0;
			let totalPeriodCacheReadTokens = 0;
			let totalPeriodUsdCost = 0;

			const modelCostList = [];
			for (const mId of Array.from(displayedModelKeys).sort()) {
				const stats = windowModelStats[mId] || { requests: 0, inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, totalTokens: 0 };
				const p = pricing[mId] || DEFAULT_MODEL_PRICING[mId] || DEFAULT_FALLBACK_PRICING;
				const pIn = typeof p.input === "number" ? p.input : DEFAULT_FALLBACK_PRICING.input;
				const pOut = typeof p.output === "number" ? p.output : DEFAULT_FALLBACK_PRICING.output;
				const pCache = typeof p.cache === "number" ? p.cache : DEFAULT_FALLBACK_PRICING.cache;

				const outputWithReasoning = (stats.outputTokens || 0) + (stats.reasoningTokens || 0);
				const inCost = ((stats.inputTokens || 0) * pIn) / 1000000;
				const outCost = (outputWithReasoning * pOut) / 1000000;
				const cacheCost = ((stats.cacheReadTokens || 0) * pCache) / 1000000;
				const usdCost = inCost + outCost + cacheCost;

				totalPeriodInputTokens += stats.inputTokens;
				totalPeriodOutputTokens += stats.outputTokens;
				totalPeriodReasoningTokens += stats.reasoningTokens;
				totalPeriodCacheReadTokens += stats.cacheReadTokens;
				totalPeriodUsdCost += usdCost;

				modelCostList.push({
					modelId: mId,
					stats,
					pricing: { input: pIn, output: pOut, cache: pCache },
					outputWithReasoning,
					inCost,
					outCost,
					cacheCost,
					usdCost
				});
			}

			// Quota percentage and estimation calculation
			const remainingPct = typeof bucketRemainingFraction === "number" ? Math.round(bucketRemainingFraction * 1000) / 10 : null;
			const usedFraction = typeof bucketRemainingFraction === "number" ? Math.max(0, 1 - bucketRemainingFraction) : null;
			const usedPct = usedFraction !== null ? Math.round(usedFraction * 1000) / 10 : null;

			let estTotalQuotaUsd = null;
			let estRemainingQuotaUsd = null;

			if (usedFraction !== null && usedFraction > 0.0001) {
				if (totalPeriodUsdCost > 0) {
					estTotalQuotaUsd = totalPeriodUsdCost / usedFraction;
					estRemainingQuotaUsd = estTotalQuotaUsd * (bucketRemainingFraction ?? 0);
				}
			}

			return (0, react_jsx_runtime.jsxs)("li", {
				style: {
					borderRadius: 12,
					border: "1px solid var(--dsw-alias-border-l2, #e5e7eb)",
					background: "var(--dsw-alias-bg-layer-2, #ffffff)",
					marginBottom: 16,
					overflow: "hidden",
					listStyle: "none"
				},
				children: [
					// Card Header
					(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						style: {
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							width: "100%",
							padding: "16px 20px",
							background: "none",
							border: "none",
							cursor: "pointer",
							textAlign: "left"
						},
						onClick: () => setOpen(!open),
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								children: [
									(0, react_jsx_runtime.jsx)("div", {
										style: { fontSize: 14, fontWeight: 600, color: "var(--dsw-alias-label-primary, #111827)" },
										children: t("title")
									}),
									(0, react_jsx_runtime.jsx)("div", {
										style: { fontSize: 12, color: "var(--dsw-alias-label-secondary, #6b7280)", marginTop: 4 },
										children: t("description")
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								style: { display: "flex", alignItems: "center", gap: 8 },
								children: [
									state.tokenConfigured ? (0, react_jsx_runtime.jsx)("span", {
										style: { fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#dcfce7", color: "#16a34a", fontWeight: 500 },
										children: t("tokenConfigured")
									}) : (0, react_jsx_runtime.jsx)("span", {
										style: { fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#fee2e2", color: "#dc2626", fontWeight: 500 },
										children: t("tokenMissing")
									}),
									dirty ? (0, react_jsx_runtime.jsx)("span", {
										style: { fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--dsw-alias-brand-subtle, #e0f2fe)", color: "var(--dsw-alias-brand-primary, #0284c7)" },
										children: t("unsaved")
									}) : null,
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {
										style: { transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }
									})
								]
							})
						]
					}),

					// Collapsible Body
					open ? (0, react_jsx_runtime.jsxs)("div", {
						style: { borderTop: "1px solid var(--dsw-alias-border-l3, #f3f4f6)" },
						children: [
							// Navigation Tab Bar
							(0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									gap: 4,
									padding: "10px 20px 0 20px",
									borderBottom: "1px solid var(--dsw-alias-border-l3, #f3f4f6)",
									background: "var(--dsw-alias-bg-layer-1, #f9fafb)",
									overflowX: "auto"
								},
								children: [
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: {
											padding: "8px 16px",
											fontSize: 13,
											fontWeight: activeTab === "quota" ? 600 : 400,
											color: activeTab === "quota" ? "var(--dsw-alias-brand-primary, #0284c7)" : "var(--dsw-alias-label-secondary, #6b7280)",
											background: "none",
											border: "none",
											borderBottom: activeTab === "quota" ? "2px solid var(--dsw-alias-brand-primary, #0284c7)" : "2px solid transparent",
											cursor: "pointer",
											whiteSpace: "nowrap"
										},
										onClick: () => setActiveTab("quota"),
										children: `⚡ ${t("tabQuota")}`
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: {
											padding: "8px 16px",
											fontSize: 13,
											fontWeight: activeTab === "usage" ? 600 : 400,
											color: activeTab === "usage" ? "var(--dsw-alias-brand-primary, #0284c7)" : "var(--dsw-alias-label-secondary, #6b7280)",
											background: "none",
											border: "none",
											borderBottom: activeTab === "usage" ? "2px solid var(--dsw-alias-brand-primary, #0284c7)" : "2px solid transparent",
											cursor: "pointer",
											whiteSpace: "nowrap"
										},
										onClick: () => setActiveTab("usage"),
										children: `📊 ${t("tabUsage")}`
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: {
											padding: "8px 16px",
											fontSize: 13,
											fontWeight: activeTab === "valuation" ? 600 : 400,
											color: activeTab === "valuation" ? "var(--dsw-alias-brand-primary, #0284c7)" : "var(--dsw-alias-label-secondary, #6b7280)",
											background: "none",
											border: "none",
											borderBottom: activeTab === "valuation" ? "2px solid var(--dsw-alias-brand-primary, #0284c7)" : "2px solid transparent",
											cursor: "pointer",
											whiteSpace: "nowrap"
										},
										onClick: () => setActiveTab("valuation"),
										children: `💰 ${t("tabValuation")}`
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: {
											padding: "8px 16px",
											fontSize: 13,
											fontWeight: activeTab === "config" ? 600 : 400,
											color: activeTab === "config" ? "var(--dsw-alias-brand-primary, #0284c7)" : "var(--dsw-alias-label-secondary, #6b7280)",
											background: "none",
											border: "none",
											borderBottom: activeTab === "config" ? "2px solid var(--dsw-alias-brand-primary, #0284c7)" : "2px solid transparent",
											cursor: "pointer",
											whiteSpace: "nowrap"
										},
										onClick: () => setActiveTab("config"),
										children: `⚙️ ${t("tabConfig")}`
									})
								]
							}),

							// Tab 1: Real-time Quota View
							activeTab === "quota" ? (0, react_jsx_runtime.jsxs)("div", {
								style: { padding: "16px 20px 20px 20px" },
								children: [
									// Unconfigured State
									!state.tokenConfigured ? (0, react_jsx_runtime.jsxs)("div", {
										style: {
											padding: "20px",
											textAlign: "center",
											background: "var(--dsw-alias-bg-layer-3, #f9fafb)",
											borderRadius: 8,
											border: "1px dashed var(--dsw-alias-border-l2, #d1d5db)"
										},
										children: [
											(0, react_jsx_runtime.jsx)("p", {
												style: { fontSize: 13, color: "var(--dsw-alias-label-secondary, #6b7280)", margin: "0 0 12px 0" },
												children: t("quotaMissingToken")
											}),
											(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												style: {
													padding: "6px 16px",
													borderRadius: 6,
													border: "none",
													background: "var(--dsw-alias-brand-primary, #0284c7)",
													color: "#ffffff",
													fontSize: 12,
													fontWeight: 500,
													cursor: "pointer"
												},
												onClick: () => setActiveTab("config"),
												children: t("gotoConfig")
											})
										]
									}) : null,

									// Configured: Header Toolbar
									state.tokenConfigured ? (0, react_jsx_runtime.jsxs)("div", {
										style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
										children: [
											(0, react_jsx_runtime.jsxs)("div", {
												style: { display: "flex", alignItems: "center", gap: 8 },
												children: [
													quotaData?.tier ? (0, react_jsx_runtime.jsxs)("span", {
														style: { fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--dsw-alias-bg-module-platform, #f3f4f6)", color: "var(--dsw-alias-label-primary, #111827)", fontWeight: 500 },
														children: [`${t("quotaTier")}: `, quotaData.tier.paidTier || quotaData.tier.name]
													}) : null,
													quotaData?.tier?.project && quotaData.tier.project !== "default" ? (0, react_jsx_runtime.jsxs)("span", {
														style: { fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--dsw-alias-bg-module-platform, #f3f4f6)", color: "var(--dsw-alias-label-secondary, #6b7280)" },
														children: [`${t("quotaProject")}: `, quotaData.tier.project]
													}) : null
												]
											}),
											(0, react_jsx_runtime.jsxs)("div", {
												style: { display: "flex", alignItems: "center", gap: 10 },
												children: [
													quotaData?.updatedAt ? (0, react_jsx_runtime.jsxs)("span", {
														style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary, #9ca3af)" },
														children: [`${t("lastUpdated")} `, quotaData.updatedAt.slice(11, 19)]
													}) : null,
													(0, react_jsx_runtime.jsx)("button", {
														type: "button",
														style: {
															display: "flex",
															alignItems: "center",
															gap: 4,
															padding: "4px 10px",
															borderRadius: 6,
															border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
															background: "var(--dsw-alias-bg-layer-3, #ffffff)",
															fontSize: 12,
															color: "var(--dsw-alias-label-primary, #111827)",
															cursor: loadingQuota ? "default" : "pointer"
														},
														disabled: loadingQuota,
														onClick: () => fetchQuota(true),
														children: loadingQuota ? t("refreshing") : `🔄 ${t("refreshQuota")}`
													})
												]
											})
										]
									}) : null,

									// Error Message
									quotaError ? (0, react_jsx_runtime.jsxs)("div", {
										style: { padding: "12px 16px", borderRadius: 8, background: "#fee2e2", color: "#dc2626", fontSize: 12, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" },
										children: [
											(0, react_jsx_runtime.jsx)("span", { children: `${t("quotaError")}: ${quotaError}` }),
											(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												style: { background: "none", border: "underline", color: "#dc2626", cursor: "pointer", fontSize: 12 },
												onClick: () => fetchQuota(true),
												children: t("retry")
											})
										]
									}) : null,

									// Quota Groups Cards
									quotaData?.groups?.length ? (0, react_jsx_runtime.jsx)("div", {
										style: { display: "flex", flexDirection: "column", gap: 12 },
										children: quotaData.groups.map((group, gIdx) => (0, react_jsx_runtime.jsxs)("div", {
											key: gIdx,
											style: {
												borderRadius: 8,
												border: "1px solid var(--dsw-alias-border-l3, #e5e7eb)",
												background: "var(--dsw-alias-bg-layer-3, #fafafa)",
												padding: "12px 16px"
											},
											children: [
												(0, react_jsx_runtime.jsxs)("div", {
													style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
													children: [
														(0, react_jsx_runtime.jsx)("div", {
															style: { fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary, #111827)" },
															children: group.displayName
														}),
														group.description ? (0, react_jsx_runtime.jsx)("div", {
															style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary, #9ca3af)" },
															children: group.description
														}) : null
													]
												}),
												(0, react_jsx_runtime.jsx)("div", {
													style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
													children: group.buckets?.map((bucket, bIdx) => {
														const colors = getPercentColor(bucket.remainingPercent);
														return (0, react_jsx_runtime.jsxs)("div", {
															key: bIdx,
															style: {
																borderRadius: 6,
																background: "#ffffff",
																border: "1px solid var(--dsw-alias-border-l3, #f3f4f6)",
																padding: "10px 12px"
															},
															children: [
																(0, react_jsx_runtime.jsxs)("div", {
																	style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
																	children: [
																		(0, react_jsx_runtime.jsx)("span", {
																			style: { fontSize: 12, fontWeight: 500, color: "var(--dsw-alias-label-secondary, #4b5563)" },
																			children: bucket.displayName
																		}),
																		(0, react_jsx_runtime.jsx)("span", {
																			style: { fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: colors.bg, color: colors.text },
																			children: `${bucket.remainingPercent}% ${t("remaining")}`
																		})
																	]
																}),
																// Progress Bar
																(0, react_jsx_runtime.jsx)("div", {
																	style: {
																		width: "100%",
																		height: 6,
																		borderRadius: 999,
																		background: "#f3f4f6",
																		overflow: "hidden",
																		marginBottom: 6
																	},
																	children: (0, react_jsx_runtime.jsx)("div", {
																		style: {
																			width: `${Math.min(100, Math.max(0, bucket.remainingPercent))}%`,
																			height: "100%",
																			background: colors.bar,
																			borderRadius: 999,
																			transition: "width 0.3s"
																		}
																	})
																}),
																(0, react_jsx_runtime.jsxs)("div", {
																	style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary, #9ca3af)", display: "flex", justifyContent: "space-between" },
																	children: [
																		(0, react_jsx_runtime.jsx)("span", {
																			children: bucket.resetInSeconds > 0 ? `⏳ ${formatCountdown(bucket.resetInSeconds)}` : "已完全就绪"
																		}),
																		bucket.resetTime ? (0, react_jsx_runtime.jsx)("span", {
																			title: bucket.resetTime,
																			children: bucket.resetTime.slice(11, 16) + " UTC"
																		}) : null
																	]
																})
															]
														});
													})
												})
											]
										}))
									}) : null,

									// Specific Models Overview Table
									quotaData?.models?.length ? (0, react_jsx_runtime.jsxs)("div", {
										style: { marginTop: 14 },
										children: [
											(0, react_jsx_runtime.jsx)("div", {
												style: { fontSize: 12, fontWeight: 600, color: "var(--dsw-alias-label-secondary, #6b7280)", marginBottom: 6 },
												children: t("modelsQuota")
											}),
											(0, react_jsx_runtime.jsx)("div", {
												style: {
													display: "grid",
													gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
													gap: 6
												},
												children: quotaData.models.map((model, mIdx) => {
													const colors = getPercentColor(model.remainingPercent ?? 100);
													return (0, react_jsx_runtime.jsxs)("div", {
														key: mIdx,
														style: {
															padding: "6px 10px",
															borderRadius: 6,
															background: "var(--dsw-alias-bg-layer-3, #fafafa)",
															border: "1px solid var(--dsw-alias-border-l3, #f3f4f6)",
															display: "flex",
															justifyContent: "space-between",
															alignItems: "center"
														},
														children: [
															(0, react_jsx_runtime.jsx)("span", {
																style: { fontSize: 12, color: "var(--dsw-alias-label-primary, #111827)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
																title: model.id,
																children: model.displayName || model.id
															}),
															(0, react_jsx_runtime.jsx)("span", {
																style: { fontSize: 11, fontWeight: 600, color: colors.text },
																children: `${model.remainingPercent}%`
															})
														]
													});
												})
											})
										]
									}) : null
								]
							}) : null,

							// Tab 2: Usage Statistics View
							activeTab === "usage" ? (0, react_jsx_runtime.jsxs)("div", {
								style: { padding: "16px 20px 20px 20px" },
								children: [
									// Toolbar
									(0, react_jsx_runtime.jsxs)("div", {
										style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
										children: [
											(0, react_jsx_runtime.jsx)("div", {
												style: { fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary, #111827)" },
												children: t("usageSummary")
											}),
											(0, react_jsx_runtime.jsxs)("div", {
												style: { display: "flex", gap: 8 },
												children: [
													(0, react_jsx_runtime.jsx)("button", {
														type: "button",
														style: {
															padding: "4px 10px",
															borderRadius: 6,
															border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
															background: "var(--dsw-alias-bg-layer-3, #ffffff)",
															fontSize: 12,
															color: "var(--dsw-alias-label-primary, #111827)",
															cursor: loadingUsage ? "default" : "pointer"
														},
														disabled: loadingUsage,
														onClick: fetchUsage,
														children: loadingUsage ? t("refreshing") : `🔄 ${t("refreshQuota")}`
													}),
													(0, react_jsx_runtime.jsx)("button", {
														type: "button",
														style: {
															padding: "4px 10px",
															borderRadius: 6,
															border: "1px solid #fecaca",
															background: "#fee2e2",
															fontSize: 12,
															color: "#dc2626",
															cursor: clearingUsage ? "default" : "pointer"
														},
														disabled: clearingUsage,
														onClick: handleClearUsage,
														children: clearingUsage ? t("clearing") : t("clearUsage")
													})
												]
											})
										]
									}),

									// KPI Summary Grid
									(0, react_jsx_runtime.jsxs)("div", {
										style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 },
										children: [
											(0, react_jsx_runtime.jsxs)("div", {
												style: { padding: "10px", borderRadius: 8, background: "var(--dsw-alias-bg-layer-3, #fafafa)", border: "1px solid var(--dsw-alias-border-l3, #f3f4f6)", textAlign: "center" },
												children: [
													(0, react_jsx_runtime.jsx)("div", { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary, #9ca3af)", marginBottom: 4 }, children: t("totalRequests") }),
													(0, react_jsx_runtime.jsx)("div", { style: { fontSize: 16, fontWeight: 700, color: "var(--dsw-alias-label-primary, #111827)" }, children: usageData?.summary?.totalRequests ?? 0 })
												]
											}),
											(0, react_jsx_runtime.jsxs)("div", {
												style: { padding: "10px", borderRadius: 8, background: "var(--dsw-alias-bg-layer-3, #fafafa)", border: "1px solid var(--dsw-alias-border-l3, #f3f4f6)", textAlign: "center" },
												children: [
													(0, react_jsx_runtime.jsx)("div", { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary, #9ca3af)", marginBottom: 4 }, children: t("totalInput") }),
													(0, react_jsx_runtime.jsx)("div", { style: { fontSize: 16, fontWeight: 700, color: "var(--dsw-alias-label-primary, #111827)" }, children: formatTokens(usageData?.summary?.totalInputTokens) })
												]
											}),
											(0, react_jsx_runtime.jsxs)("div", {
												style: { padding: "10px", borderRadius: 8, background: "var(--dsw-alias-bg-layer-3, #fafafa)", border: "1px solid var(--dsw-alias-border-l3, #f3f4f6)", textAlign: "center" },
												children: [
													(0, react_jsx_runtime.jsx)("div", { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary, #9ca3af)", marginBottom: 4 }, children: t("totalOutput") }),
													(0, react_jsx_runtime.jsx)("div", { style: { fontSize: 16, fontWeight: 700, color: "var(--dsw-alias-label-primary, #111827)" }, children: formatTokens(usageData?.summary?.totalOutputTokens) })
												]
											}),
											(0, react_jsx_runtime.jsxs)("div", {
												style: { padding: "10px", borderRadius: 8, background: "#ecfdf5", border: "1px solid #a7f3d0", textAlign: "center" },
												children: [
													(0, react_jsx_runtime.jsxs)("div", { style: { fontSize: 11, color: "#047857", marginBottom: 4, display: "flex", justifyContent: "center", gap: 4 }, children: [
														(0, react_jsx_runtime.jsx)("span", { children: "⚡" }),
														(0, react_jsx_runtime.jsx)("span", { children: t("totalCacheRead") })
													] }),
													(0, react_jsx_runtime.jsx)("div", { style: { fontSize: 16, fontWeight: 700, color: "#065f46" }, children: formatTokens(usageData?.summary?.totalCacheReadTokens) }),
													usageData?.summary?.cacheSavingsRate ? (0, react_jsx_runtime.jsx)("div", { style: { fontSize: 10, color: "#059669", marginTop: 2 }, children: `${t("cacheSavings")}: ${usageData.summary.cacheSavingsRate}` }) : null
												]
											}),
											(0, react_jsx_runtime.jsxs)("div", {
												style: { padding: "10px", borderRadius: 8, background: "var(--dsw-alias-bg-layer-3, #fafafa)", border: "1px solid var(--dsw-alias-border-l3, #f3f4f6)", textAlign: "center" },
												children: [
													(0, react_jsx_runtime.jsx)("div", { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary, #9ca3af)", marginBottom: 4 }, children: t("totalReasoning") }),
													(0, react_jsx_runtime.jsx)("div", { style: { fontSize: 16, fontWeight: 700, color: "var(--dsw-alias-label-primary, #111827)" }, children: formatTokens(usageData?.summary?.totalReasoningTokens) })
												]
											})
										]
									}),

									// Model Breakdown Table
									usageData?.byModel && Object.keys(usageData.byModel).length > 0 ? (0, react_jsx_runtime.jsxs)("div", {
										style: { marginBottom: 16 },
										children: [
											(0, react_jsx_runtime.jsx)("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--dsw-alias-label-secondary, #6b7280)", marginBottom: 8 }, children: t("modelBreakdown") }),
											(0, react_jsx_runtime.jsxs)("div", {
												style: { overflowX: "auto" },
												children: [
													(0, react_jsx_runtime.jsxs)("table", {
														style: { width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" },
														children: [
															(0, react_jsx_runtime.jsx)("thead", {
																children: (0, react_jsx_runtime.jsxs)("tr", {
																	style: { borderBottom: "1px solid var(--dsw-alias-border-l2, #e5e7eb)", color: "var(--dsw-alias-label-tertiary, #9ca3af)" },
																	children: [
																		(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px" }, children: t("modelCol") }),
																		(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "right" }, children: t("totalRequests") }),
																		(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "right" }, children: t("totalInput") }),
																		(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "right" }, children: t("totalOutput") }),
																		(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "right" }, children: t("totalCacheRead") }),
																		(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "right" }, children: t("totalReasoning") })
																	]
																})
															}),
															(0, react_jsx_runtime.jsx)("tbody", {
																children: Object.entries(usageData.byModel).map(([mName, mStats], idx) => (0, react_jsx_runtime.jsxs)("tr", {
																	key: idx,
																	style: { borderBottom: "1px solid var(--dsw-alias-border-l3, #f3f4f6)" },
																	children: [
																		(0, react_jsx_runtime.jsx)("td", { style: { padding: "8px", fontWeight: 500, color: "var(--dsw-alias-label-primary, #111827)" }, children: mName }),
																		(0, react_jsx_runtime.jsx)("td", { style: { padding: "8px", textAlign: "right" }, children: mStats.requests }),
																		(0, react_jsx_runtime.jsx)("td", { style: { padding: "8px", textAlign: "right" }, children: formatTokens(mStats.inputTokens) }),
																		(0, react_jsx_runtime.jsx)("td", { style: { padding: "8px", textAlign: "right" }, children: formatTokens(mStats.outputTokens) }),
																		(0, react_jsx_runtime.jsx)("td", { style: { padding: "8px", textAlign: "right", color: "#059669", fontWeight: 500 }, children: formatTokens(mStats.cacheReadTokens) }),
																		(0, react_jsx_runtime.jsx)("td", { style: { padding: "8px", textAlign: "right" }, children: formatTokens(mStats.reasoningTokens) })
																	]
																}))
															})
														]
													})
												]
											})
										]
									}) : null,

									// Recent Requests Stream
									usageData?.recent?.length ? (0, react_jsx_runtime.jsxs)("div", {
										children: [
											(0, react_jsx_runtime.jsx)("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--dsw-alias-label-secondary, #6b7280)", marginBottom: 8 }, children: t("recentRequests") }),
											(0, react_jsx_runtime.jsx)("div", {
												style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" },
												children: usageData.recent.map((rec, rIdx) => (0, react_jsx_runtime.jsxs)("div", {
													key: rIdx,
													style: {
														display: "flex",
														justifyContent: "space-between",
														alignItems: "center",
														padding: "6px 10px",
														borderRadius: 6,
														background: "var(--dsw-alias-bg-layer-3, #fafafa)",
														border: "1px solid var(--dsw-alias-border-l3, #f3f4f6)",
														fontSize: 11
													},
													children: [
														(0, react_jsx_runtime.jsxs)("div", {
															style: { display: "flex", alignItems: "center", gap: 8 },
															children: [
																(0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-tertiary, #9ca3af)" }, children: formatTimeAgo(rec.timestamp) }),
																(0, react_jsx_runtime.jsx)("span", { style: { fontWeight: 500, color: "var(--dsw-alias-label-primary, #111827)" }, children: rec.model }),
																rec.durationMs ? (0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-tertiary, #9ca3af)" }, children: `(${formatDuration(rec.durationMs)})` }) : null
															]
														}),
														(0, react_jsx_runtime.jsxs)("div", {
															style: { display: "flex", alignItems: "center", gap: 10 },
															children: [
																(0, react_jsx_runtime.jsxs)("span", { style: { color: "var(--dsw-alias-label-secondary, #4b5563)" }, children: [
																	`↑${formatTokens(rec.inputTokens)} `,
																	`↓${formatTokens(rec.outputTokens)}`,
																	rec.reasoningTokens > 0 ? ` 💭${formatTokens(rec.reasoningTokens)}` : ""
																] }),
																rec.cacheReadTokens > 0 ? (0, react_jsx_runtime.jsx)("span", {
																	style: { padding: "1px 5px", borderRadius: 4, background: "#dcfce7", color: "#16a34a", fontWeight: 500 },
																	children: `⚡ ${rec.cacheSavingsRatio}%`
																}) : null
															]
														})
													]
												}))
											})
										]
									}) : (0, react_jsx_runtime.jsx)("p", {
										style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary, #9ca3af)", textAlign: "center", margin: "20px 0" },
										children: t("noUsageData")
									})
								]
							}) : null,

							// Tab 3: Quota Estimation & Valuation View
							activeTab === "valuation" ? (0, react_jsx_runtime.jsxs)("div", {
								style: { padding: "16px 20px 20px 20px" },
								children: [
									// Valuation Toolbar (Period Toggle + Group Selector + Actions)
									(0, react_jsx_runtime.jsxs)("div", {
										style: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 },
										children: [
											// Period Selector Pills
											(0, react_jsx_runtime.jsxs)("div", {
												style: { display: "flex", background: "var(--dsw-alias-bg-module-platform, #f3f4f6)", padding: "3px", borderRadius: 8, gap: 2 },
												children: [
													(0, react_jsx_runtime.jsx)("button", {
														type: "button",
														style: {
															padding: "4px 12px",
															borderRadius: 6,
															border: "none",
															fontSize: 12,
															fontWeight: activeValuationPeriod === "5h" ? 600 : 400,
															background: activeValuationPeriod === "5h" ? "var(--dsw-alias-bg-layer-3, #ffffff)" : "none",
															color: activeValuationPeriod === "5h" ? "var(--dsw-alias-brand-primary, #0284c7)" : "var(--dsw-alias-label-secondary, #6b7280)",
															boxShadow: activeValuationPeriod === "5h" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
															cursor: "pointer"
														},
														onClick: () => setActiveValuationPeriod("5h"),
														children: `⏱️ ${t("period5h")}`
													}),
													(0, react_jsx_runtime.jsx)("button", {
														type: "button",
														style: {
															padding: "4px 12px",
															borderRadius: 6,
															border: "none",
															fontSize: 12,
															fontWeight: activeValuationPeriod === "weekly" ? 600 : 400,
															background: activeValuationPeriod === "weekly" ? "var(--dsw-alias-bg-layer-3, #ffffff)" : "none",
															color: activeValuationPeriod === "weekly" ? "var(--dsw-alias-brand-primary, #0284c7)" : "var(--dsw-alias-label-secondary, #6b7280)",
															boxShadow: activeValuationPeriod === "weekly" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
															cursor: "pointer"
														},
														onClick: () => setActiveValuationPeriod("weekly"),
														children: `📅 ${t("periodWeekly")}`
													}),
													(0, react_jsx_runtime.jsx)("button", {
														type: "button",
														style: {
															padding: "4px 12px",
															borderRadius: 6,
															border: "none",
															fontSize: 12,
															fontWeight: activeValuationPeriod === "all" ? 600 : 400,
															background: activeValuationPeriod === "all" ? "var(--dsw-alias-bg-layer-3, #ffffff)" : "none",
															color: activeValuationPeriod === "all" ? "var(--dsw-alias-brand-primary, #0284c7)" : "var(--dsw-alias-label-secondary, #6b7280)",
															boxShadow: activeValuationPeriod === "all" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
															cursor: "pointer"
														},
														onClick: () => setActiveValuationPeriod("all"),
														children: `🌐 ${t("periodAll")}`
													})
												]
											}),

											// Group Filter & Actions
											(0, react_jsx_runtime.jsxs)("div", {
												style: { display: "flex", alignItems: "center", gap: 8 },
												children: [
													(0, react_jsx_runtime.jsxs)("select", {
														style: {
															height: 28,
															fontSize: 12,
															borderRadius: 6,
															border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
															background: "var(--dsw-alias-bg-layer-3, #ffffff)",
															color: "var(--dsw-alias-label-primary, #111827)",
															padding: "0 6px",
															cursor: "pointer"
														},
														value: selectedGroupFilter,
														onChange: (e) => setSelectedGroupFilter(e.target.value),
														children: [
															(0, react_jsx_runtime.jsx)("option", { value: "all", children: t("groupAll") }),
															(0, react_jsx_runtime.jsx)("option", { value: "gemini", children: t("groupGemini") }),
															(0, react_jsx_runtime.jsx)("option", { value: "3p", children: t("group3p") })
														]
													}),
													(0, react_jsx_runtime.jsx)("button", {
														type: "button",
														style: {
															padding: "4px 10px",
															borderRadius: 6,
															border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
															background: "var(--dsw-alias-bg-layer-3, #ffffff)",
															fontSize: 12,
															color: "var(--dsw-alias-label-primary, #111827)",
															cursor: (loadingQuota || loadingUsage) ? "default" : "pointer"
														},
														disabled: loadingQuota || loadingUsage,
														onClick: () => { fetchQuota(true); fetchUsage(); },
														children: (loadingQuota || loadingUsage) ? t("refreshing") : `🔄 ${t("refreshQuota")}`
													})
												]
											})
										]
									}),

									// Period Window & Notice Banner
									(0, react_jsx_runtime.jsxs)("div", {
										style: {
											padding: "10px 14px",
											borderRadius: 8,
											background: "var(--dsw-alias-bg-layer-3, #fafafa)",
											border: "1px solid var(--dsw-alias-border-l3, #f3f4f6)",
											marginBottom: 14,
											display: "flex",
											flexDirection: "column",
											gap: 6
										},
										children: [
											(0, react_jsx_runtime.jsxs)("div", {
												style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, flexWrap: "wrap", gap: 6 },
												children: [
													(0, react_jsx_runtime.jsxs)("div", {
														style: { display: "flex", alignItems: "center", gap: 6 },
														children: [
															(0, react_jsx_runtime.jsx)("span", { style: { fontWeight: 600, color: "var(--dsw-alias-label-primary, #111827)" }, children: `🕒 ${t("windowRangeLabel")}:` }),
															(0, react_jsx_runtime.jsx)("span", {
																style: { color: "var(--dsw-alias-label-secondary, #4b5563)", fontFamily: "monospace" },
																children: `${new Date(windowStartMs).toLocaleTimeString()} ~ ${new Date(windowEndMs).toLocaleTimeString()} (${activeValuationPeriod === "5h" ? t("windowNotice5h") : (activeValuationPeriod === "weekly" ? t("windowNoticeWeekly") : t("windowNoticeAll"))})`
															})
														]
													}),
													bucketResetTime && activeValuationPeriod !== "all" ? (0, react_jsx_runtime.jsxs)("div", {
														style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary, #9ca3af)", display: "flex", alignItems: "center", gap: 6 },
														children: [
															(0, react_jsx_runtime.jsx)("span", { children: `⏳ ${t("resetsIn")}: ${formatCountdown(bucketResetInSeconds)}` }),
															(0, react_jsx_runtime.jsx)("span", { children: `(${bucketResetTime.slice(11, 16)} UTC)` })
														]
													}) : null
												]
											}),
											// Progress bar for quota remaining in selected period
											remainingPct !== null && activeValuationPeriod !== "all" ? (0, react_jsx_runtime.jsxs)("div", {
												children: [
													(0, react_jsx_runtime.jsxs)("div", {
														style: { display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 },
														children: [
															(0, react_jsx_runtime.jsxs)("span", { style: { color: "var(--dsw-alias-label-secondary, #6b7280)" }, children: [`${t("quotaConsumedPct")}: `, (0, react_jsx_runtime.jsx)("b", { style: { color: "#dc2626" }, children: `${usedPct}%` })] }),
															(0, react_jsx_runtime.jsxs)("span", { style: { color: "var(--dsw-alias-label-secondary, #6b7280)" }, children: [`${t("quotaRemainingPct")}: `, (0, react_jsx_runtime.jsx)("b", { style: { color: "#16a34a" }, children: `${remainingPct}%` })] })
														]
													}),
													(0, react_jsx_runtime.jsx)("div", {
														style: { width: "100%", height: 6, borderRadius: 999, background: "#f3f4f6", overflow: "hidden" },
														children: (0, react_jsx_runtime.jsx)("div", {
															style: {
																width: `${Math.min(100, Math.max(0, remainingPct))}%`,
																height: "100%",
																background: getPercentColor(remainingPct).bar,
																borderRadius: 999,
																transition: "width 0.3s"
															}
														})
													})
												]
											}) : null
										]
									}),

									// Valuation KPI Cards Grid
									(0, react_jsx_runtime.jsxs)("div", {
										style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 16 },
										children: [
											// Card 1: Consumed Cost in Period
											(0, react_jsx_runtime.jsxs)("div", {
												style: {
													padding: "12px",
													borderRadius: 8,
													background: "var(--dsw-alias-bg-layer-3, #fafafa)",
													border: "1px solid var(--dsw-alias-border-l3, #f3f4f6)",
													display: "flex",
													flexDirection: "column",
													justifyContent: "space-between"
												},
												children: [
													(0, react_jsx_runtime.jsx)("div", {
														style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary, #9ca3af)", marginBottom: 4 },
														children: t("usedCostTitle")
													}),
													(0, react_jsx_runtime.jsx)("div", {
														style: { fontSize: 18, fontWeight: 700, color: "var(--dsw-alias-label-primary, #111827)", marginBottom: 4 },
														children: formatCurrency(totalPeriodUsdCost)
													}),
													(0, react_jsx_runtime.jsxs)("div", {
														style: { fontSize: 10, color: "var(--dsw-alias-label-secondary, #6b7280)" },
														children: [`↑${formatTokens(totalPeriodInputTokens)}  ↓${formatTokens(totalPeriodOutputTokens + totalPeriodReasoningTokens)}  ⚡${formatTokens(totalPeriodCacheReadTokens)}`]
													})
												]
											}),

											// Card 2: Quota Consumed Ratio
											(0, react_jsx_runtime.jsxs)("div", {
												style: {
													padding: "12px",
													borderRadius: 8,
													background: "var(--dsw-alias-bg-layer-3, #fafafa)",
													border: "1px solid var(--dsw-alias-border-l3, #f3f4f6)",
													display: "flex",
													flexDirection: "column",
													justifyContent: "space-between"
												},
												children: [
													(0, react_jsx_runtime.jsx)("div", {
														style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary, #9ca3af)", marginBottom: 4 },
														children: activeValuationPeriod === "all" ? t("totalRequests") : t("quotaConsumedPct")
													}),
													(0, react_jsx_runtime.jsx)("div", {
														style: { fontSize: 18, fontWeight: 700, color: activeValuationPeriod === "all" ? "var(--dsw-alias-label-primary, #111827)" : (usedPct && usedPct > 80 ? "#dc2626" : "var(--dsw-alias-label-primary, #111827)"), marginBottom: 4 },
														children: activeValuationPeriod === "all" ? `${usageData?.summary?.totalRequests || 0} 次` : (usedPct !== null ? `${usedPct}%` : "—")
													}),
													(0, react_jsx_runtime.jsx)("div", {
														style: { fontSize: 10, color: "var(--dsw-alias-label-secondary, #6b7280)" },
														children: activeValuationPeriod === "all" ? `${formatTokens(usageData?.summary?.totalTokens || 0)} Total Tokens` : (remainingPct !== null ? `${t("remaining")}: ${remainingPct}%` : "—")
													})
												]
											}),

											// Card 3: Est. Total Quota Value
											(0, react_jsx_runtime.jsxs)("div", {
												style: {
													padding: "12px",
													borderRadius: 8,
													background: "#eff6ff",
													border: "1px solid #bfdbfe",
													display: "flex",
													flexDirection: "column",
													justifyContent: "space-between"
												},
												children: [
													(0, react_jsx_runtime.jsxs)("div", {
														style: { fontSize: 11, color: "#1e40af", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 },
														children: [
															(0, react_jsx_runtime.jsx)("span", { children: "🔮" }),
															(0, react_jsx_runtime.jsx)("span", { style: { fontWeight: 600 }, children: t("estTotalQuotaTitle") })
														]
													}),
													(0, react_jsx_runtime.jsx)("div", {
														style: { fontSize: 18, fontWeight: 700, color: "#1d4ed8", marginBottom: 4 },
														children: estTotalQuotaUsd !== null ? formatCurrency(estTotalQuotaUsd) : (usedPct === 0 ? "100% 完整" : "待推算")
													}),
													(0, react_jsx_runtime.jsx)("div", {
														style: { fontSize: 10, color: "#3b82f6" },
														children: t("estFormulaHint")
													})
												]
											}),

											// Card 4: Est. Remaining Value
											(0, react_jsx_runtime.jsxs)("div", {
												style: {
													padding: "12px",
													borderRadius: 8,
													background: "#ecfdf5",
													border: "1px solid #a7f3d0",
													display: "flex",
													flexDirection: "column",
													justifyContent: "space-between"
												},
												children: [
													(0, react_jsx_runtime.jsxs)("div", {
														style: { fontSize: 11, color: "#065f46", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 },
														children: [
															(0, react_jsx_runtime.jsx)("span", { children: "🛡️" }),
															(0, react_jsx_runtime.jsx)("span", { style: { fontWeight: 600 }, children: t("estRemainingQuotaTitle") })
														]
													}),
													(0, react_jsx_runtime.jsx)("div", {
														style: { fontSize: 18, fontWeight: 700, color: "#047857", marginBottom: 4 },
														children: estRemainingQuotaUsd !== null ? formatCurrency(estRemainingQuotaUsd) : (usedPct === 0 ? "完全就绪" : "待推算")
													}),
													(0, react_jsx_runtime.jsx)("div", {
														style: { fontSize: 10, color: "#059669" },
														children: t("estRemainingHint")
													})
												]
											})
										]
									}),

									// Notice if zero usage or external usage
									usedPct === 0 ? (0, react_jsx_runtime.jsxs)("div", {
										style: { padding: "10px 14px", borderRadius: 6, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", fontSize: 11, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 },
										children: [
											(0, react_jsx_runtime.jsx)("span", { children: "💡" }),
											(0, react_jsx_runtime.jsx)("span", { children: t("estZeroNotice") })
										]
									}) : (totalPeriodUsdCost === 0 && usedPct && usedPct > 0 ? (0, react_jsx_runtime.jsxs)("div", {
										style: { padding: "10px 14px", borderRadius: 6, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 11, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 },
										children: [
											(0, react_jsx_runtime.jsx)("span", { children: "ℹ️" }),
											(0, react_jsx_runtime.jsx)("span", { children: t("estExtNotice") })
										]
									}) : null),

									// Pricing & Valuation Table Section
									(0, react_jsx_runtime.jsxs)("div", {
										style: {
											borderRadius: 8,
											border: "1px solid var(--dsw-alias-border-l3, #e5e7eb)",
											background: "var(--dsw-alias-bg-layer-3, #fafafa)",
											padding: "12px 14px",
											marginBottom: 16
										},
										children: [
											(0, react_jsx_runtime.jsxs)("div", {
												style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 },
												children: [
													(0, react_jsx_runtime.jsxs)("div", {
														children: [
															(0, react_jsx_runtime.jsx)("div", { style: { fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary, #111827)" }, children: t("pricingTableTitle") }),
															(0, react_jsx_runtime.jsx)("div", { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary, #9ca3af)", marginTop: 2 }, children: t("pricingNote") })
														]
													}),
													(0, react_jsx_runtime.jsxs)("div", {
														style: { display: "flex", alignItems: "center", gap: 8 },
														children: [
															pricingSavedToast ? (0, react_jsx_runtime.jsx)("span", {
																style: { fontSize: 11, color: "#16a34a", fontWeight: 500 },
																children: `✅ ${t("pricingSavedToast")}`
															}) : null,
															(0, react_jsx_runtime.jsx)("button", {
																type: "button",
																style: {
																	padding: "4px 8px",
																	borderRadius: 6,
																	border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
																	background: "var(--dsw-alias-bg-layer-3, #ffffff)",
																	fontSize: 11,
																	color: "var(--dsw-alias-label-secondary, #4b5563)",
																	cursor: "pointer"
																},
																onClick: () => setShowAllCatalogModels(!showAllCatalogModels),
																children: showAllCatalogModels ? t("hideAllModelsToggle") : t("showAllModelsToggle")
															}),
															(0, react_jsx_runtime.jsx)("button", {
																type: "button",
																style: {
																	padding: "4px 8px",
																	borderRadius: 6,
																	border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
																	background: "var(--dsw-alias-bg-layer-3, #ffffff)",
																	fontSize: 11,
																	color: "var(--dsw-alias-label-secondary, #4b5563)",
																	cursor: "pointer"
																},
																onClick: handleResetPricing,
																children: t("resetPricingBtn")
															}),
															(0, react_jsx_runtime.jsx)("button", {
																type: "button",
																style: {
																	padding: "4px 10px",
																	borderRadius: 6,
																	border: "none",
																	background: "var(--dsw-alias-brand-primary, #0284c7)",
																	color: "#ffffff",
																	fontSize: 11,
																	fontWeight: 500,
																	cursor: "pointer"
																},
																onClick: handleSavePricing,
																children: t("savePricingBtn")
															})
														]
													})
												]
											}),

											// Table
											(0, react_jsx_runtime.jsx)("div", {
												style: { overflowX: "auto" },
												children: (0, react_jsx_runtime.jsxs)("table", {
													style: { width: "100%", borderCollapse: "collapse", fontSize: 11, textAlign: "left" },
													children: [
														(0, react_jsx_runtime.jsx)("thead", {
															children: (0, react_jsx_runtime.jsxs)("tr", {
																style: { borderBottom: "1px solid var(--dsw-alias-border-l2, #e5e7eb)", color: "var(--dsw-alias-label-tertiary, #9ca3af)" },
																children: [
																	(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px" }, children: t("modelCol") }),
																	(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "right" }, children: t("inputTokensCol") }),
																	(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "center", width: 90 }, children: t("inputPriceCol") }),
																	(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "right" }, children: t("outputTokensCol") }),
																	(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "center", width: 90 }, children: t("outputPriceCol") }),
																	(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "right" }, children: t("cacheTokensCol") }),
																	(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "center", width: 90 }, children: t("cachePriceCol") }),
																	(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "right" }, children: t("periodCostCol") })
																]
															})
														}),
														(0, react_jsx_runtime.jsx)("tbody", {
															children: modelCostList.length > 0 ? modelCostList.map((item, idx) => (0, react_jsx_runtime.jsxs)("tr", {
																key: idx,
																style: { borderBottom: "1px solid var(--dsw-alias-border-l3, #f3f4f6)", background: item.usdCost > 0 ? "rgba(2, 132, 199, 0.02)" : "transparent" },
																children: [
																	// Model name
																	(0, react_jsx_runtime.jsxs)("td", {
																		style: { padding: "8px", fontWeight: 500, color: "var(--dsw-alias-label-primary, #111827)", whiteSpace: "nowrap" },
																		children: [
																			(0, react_jsx_runtime.jsx)("span", { children: item.modelId }),
																			item.stats.requests > 0 ? (0, react_jsx_runtime.jsx)("span", {
																				style: { fontSize: 10, color: "var(--dsw-alias-label-tertiary, #9ca3af)", marginLeft: 4 },
																				children: `(${item.stats.requests}次)`
																			}) : null
																		]
																	}),
																	// Input Tokens
																	(0, react_jsx_runtime.jsx)("td", {
																		style: { padding: "8px", textAlign: "right", color: item.stats.inputTokens > 0 ? "var(--dsw-alias-label-primary, #111827)" : "var(--dsw-alias-label-tertiary, #9ca3af)" },
																		children: formatTokens(item.stats.inputTokens)
																	}),
																	// Input Price Input
																	(0, react_jsx_runtime.jsx)("td", {
																		style: { padding: "4px 6px", textAlign: "center" },
																		children: (0, react_jsx_runtime.jsxs)("div", {
																			style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 2 },
																			children: [
																				(0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-tertiary, #9ca3af)" }, children: "$" }),
																				(0, react_jsx_runtime.jsx)("input", {
																					type: "number",
																					step: "0.001",
																					min: "0",
																					style: {
																						width: 60,
																						height: 24,
																						borderRadius: 4,
																						border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
																						background: "var(--dsw-alias-bg-layer-3, #ffffff)",
																						color: "var(--dsw-alias-label-primary, #111827)",
																						fontSize: 11,
																						textAlign: "right",
																						padding: "0 4px"
																					},
																					value: item.pricing.input,
																					onChange: (e) => handlePriceChange(item.modelId, "input", e.target.value)
																				})
																			]
																		})
																	}),
																	// Output Tokens (inc reasoning)
																	(0, react_jsx_runtime.jsxs)("td", {
																		style: { padding: "8px", textAlign: "right", color: item.outputWithReasoning > 0 ? "var(--dsw-alias-label-primary, #111827)" : "var(--dsw-alias-label-tertiary, #9ca3af)" },
																		title: `输出: ${item.stats.outputTokens}, 思维链: ${item.stats.reasoningTokens}`,
																		children: [
																			formatTokens(item.outputWithReasoning),
																			item.stats.reasoningTokens > 0 ? (0, react_jsx_runtime.jsx)("span", {
																				style: { fontSize: 10, color: "#8b5cf6", marginLeft: 4 },
																				children: `(💭${formatTokens(item.stats.reasoningTokens)})`
																			}) : null
																		]
																	}),
																	// Output Price Input
																	(0, react_jsx_runtime.jsx)("td", {
																		style: { padding: "4px 6px", textAlign: "center" },
																		children: (0, react_jsx_runtime.jsxs)("div", {
																			style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 2 },
																			children: [
																				(0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-tertiary, #9ca3af)" }, children: "$" }),
																				(0, react_jsx_runtime.jsx)("input", {
																					type: "number",
																					step: "0.01",
																					min: "0",
																					style: {
																						width: 60,
																						height: 24,
																						borderRadius: 4,
																						border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
																						background: "var(--dsw-alias-bg-layer-3, #ffffff)",
																						color: "var(--dsw-alias-label-primary, #111827)",
																						fontSize: 11,
																						textAlign: "right",
																						padding: "0 4px"
																					},
																					value: item.pricing.output,
																					onChange: (e) => handlePriceChange(item.modelId, "output", e.target.value)
																				})
																			]
																		})
																	}),
																	// Cache Read Tokens
																	(0, react_jsx_runtime.jsx)("td", {
																		style: { padding: "8px", textAlign: "right", color: item.stats.cacheReadTokens > 0 ? "#059669" : "var(--dsw-alias-label-tertiary, #9ca3af)", fontWeight: item.stats.cacheReadTokens > 0 ? 500 : 400 },
																		children: formatTokens(item.stats.cacheReadTokens)
																	}),
																	// Cache Price Input
																	(0, react_jsx_runtime.jsx)("td", {
																		style: { padding: "4px 6px", textAlign: "center" },
																		children: (0, react_jsx_runtime.jsxs)("div", {
																			style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 2 },
																			children: [
																				(0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-tertiary, #9ca3af)" }, children: "$" }),
																				(0, react_jsx_runtime.jsx)("input", {
																					type: "number",
																					step: "0.001",
																					min: "0",
																					style: {
																						width: 60,
																						height: 24,
																						borderRadius: 4,
																						border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
																						background: "var(--dsw-alias-bg-layer-3, #ffffff)",
																						color: "var(--dsw-alias-label-primary, #111827)",
																						fontSize: 11,
																						textAlign: "right",
																						padding: "0 4px"
																					},
																					value: item.pricing.cache,
																					onChange: (e) => handlePriceChange(item.modelId, "cache", e.target.value)
																				})
																			]
																		})
																	}),
																	// Subtotal USD
																	(0, react_jsx_runtime.jsx)("td", {
																		style: { padding: "8px", textAlign: "right", fontWeight: 600, color: item.usdCost > 0 ? "var(--dsw-alias-brand-primary, #0284c7)" : "var(--dsw-alias-label-tertiary, #9ca3af)" },
																		children: formatCurrency(item.usdCost)
																	})
																]
															})) : (0, react_jsx_runtime.jsx)("tr", {
																children: (0, react_jsx_runtime.jsx)("td", {
																	colSpan: 8,
																	style: { padding: "16px", textAlign: "center", color: "var(--dsw-alias-label-tertiary, #9ca3af)" },
																	children: t("noUsageInWindow")
																})
															})
														}),
														// Table Footer Totals
														(0, react_jsx_runtime.jsx)("tfoot", {
															children: (0, react_jsx_runtime.jsxs)("tr", {
																style: { borderTop: "2px solid var(--dsw-alias-border-l2, #e5e7eb)", fontWeight: 600 },
																children: [
																	(0, react_jsx_runtime.jsx)("td", { style: { padding: "8px", color: "var(--dsw-alias-label-primary, #111827)" }, children: t("totalPeriodCost") }),
																	(0, react_jsx_runtime.jsx)("td", { style: { padding: "8px", textAlign: "right", color: "var(--dsw-alias-label-primary, #111827)" }, children: formatTokens(totalPeriodInputTokens) }),
																	(0, react_jsx_runtime.jsx)("td", { style: { padding: "8px" } }),
																	(0, react_jsx_runtime.jsx)("td", { style: { padding: "8px", textAlign: "right", color: "var(--dsw-alias-label-primary, #111827)" }, children: formatTokens(totalPeriodOutputTokens + totalPeriodReasoningTokens) }),
																	(0, react_jsx_runtime.jsx)("td", { style: { padding: "8px" } }),
																	(0, react_jsx_runtime.jsx)("td", { style: { padding: "8px", textAlign: "right", color: "#059669" }, children: formatTokens(totalPeriodCacheReadTokens) }),
																	(0, react_jsx_runtime.jsx)("td", { style: { padding: "8px" } }),
																	(0, react_jsx_runtime.jsx)("td", { style: { padding: "8px", textAlign: "right", color: "#0284c7", fontSize: 13 }, children: formatCurrency(totalPeriodUsdCost) })
																]
															})
														})
													]
												})
											})
										]
									}),

									// Per-Model Quota Breakdown (if quotaData.models is populated)
									quotaData?.models?.length ? (0, react_jsx_runtime.jsxs)("div", {
										style: {
											borderRadius: 8,
											border: "1px solid var(--dsw-alias-border-l3, #e5e7eb)",
											background: "var(--dsw-alias-bg-layer-3, #fafafa)",
											padding: "12px 14px"
										},
										children: [
											(0, react_jsx_runtime.jsx)("div", {
												style: { fontSize: 12, fontWeight: 600, color: "var(--dsw-alias-label-secondary, #6b7280)", marginBottom: 8 },
												children: t("perModelEstTitle")
											}),
											(0, react_jsx_runtime.jsx)("div", {
												style: { overflowX: "auto" },
												children: (0, react_jsx_runtime.jsxs)("table", {
													style: { width: "100%", borderCollapse: "collapse", fontSize: 11, textAlign: "left" },
													children: [
														(0, react_jsx_runtime.jsx)("thead", {
															children: (0, react_jsx_runtime.jsxs)("tr", {
																style: { borderBottom: "1px solid var(--dsw-alias-border-l2, #e5e7eb)", color: "var(--dsw-alias-label-tertiary, #9ca3af)" },
																children: [
																	(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px" }, children: t("perModelHeader") }),
																	(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "right" }, children: t("perModelRemHeader") }),
																	(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "right" }, children: t("perModelCostHeader") }),
																	(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "right" }, children: t("perModelTotalHeader") }),
																	(0, react_jsx_runtime.jsx)("th", { style: { padding: "6px 8px", textAlign: "right" }, children: t("perModelRemValHeader") })
																]
															})
														}),
														(0, react_jsx_runtime.jsx)("tbody", {
															children: quotaData.models.map((m, mIdx) => {
																const colors = getPercentColor(m.remainingPercent ?? 100);
																const itemCost = modelCostList.find(x => x.modelId === m.id)?.usdCost || 0;
																const mRemFraction = m.remainingFraction;
																const mUsedFraction = typeof mRemFraction === "number" ? Math.max(0, 1 - mRemFraction) : null;
																let mEstTotal = null;
																let mEstRem = null;
																if (mUsedFraction !== null && mUsedFraction > 0.0001 && itemCost > 0) {
																	mEstTotal = itemCost / mUsedFraction;
																	mEstRem = mEstTotal * (mRemFraction ?? 0);
																}
																return (0, react_jsx_runtime.jsxs)("tr", {
																	key: mIdx,
																	style: { borderBottom: "1px solid var(--dsw-alias-border-l3, #f3f4f6)" },
																	children: [
																		(0, react_jsx_runtime.jsx)("td", { style: { padding: "6px 8px", fontWeight: 500, color: "var(--dsw-alias-label-primary, #111827)" }, children: m.displayName || m.id }),
																		(0, react_jsx_runtime.jsx)("td", { style: { padding: "6px 8px", textAlign: "right", fontWeight: 600, color: colors.text }, children: `${m.remainingPercent}%` }),
																		(0, react_jsx_runtime.jsx)("td", { style: { padding: "6px 8px", textAlign: "right", color: itemCost > 0 ? "var(--dsw-alias-label-primary, #111827)" : "var(--dsw-alias-label-tertiary, #9ca3af)" }, children: formatCurrency(itemCost) }),
																		(0, react_jsx_runtime.jsx)("td", { style: { padding: "6px 8px", textAlign: "right", color: mEstTotal !== null ? "#1d4ed8" : "var(--dsw-alias-label-tertiary, #9ca3af)" }, children: mEstTotal !== null ? formatCurrency(mEstTotal) : "—" }),
																		(0, react_jsx_runtime.jsx)("td", { style: { padding: "6px 8px", textAlign: "right", color: mEstRem !== null ? "#047857" : "var(--dsw-alias-label-tertiary, #9ca3af)" }, children: mEstRem !== null ? formatCurrency(mEstRem) : "—" })
																	]
																});
															})
														})
													]
												})
											})
										]
									}) : null
								]
							}) : null,

							// Tab 4: Configuration View
							activeTab === "config" ? (0, react_jsx_runtime.jsxs)("div", {
								style: { padding: "16px 20px 20px 20px" },
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										style: { display: "flex", flexDirection: "column", gap: 12 },
										children: [
											(0, react_jsx_runtime.jsxs)("div", {
												style: { display: "flex", flexDirection: "column", gap: 6 },
												children: [
													(0, react_jsx_runtime.jsx)("label", {
														style: { fontSize: 13, fontWeight: 500, color: "var(--dsw-alias-label-primary, #111827)" },
														children: t("tokenLabel")
													}),
													(0, react_jsx_runtime.jsx)("input", {
														type: "password",
														autoComplete: "off",
														style: {
															height: 36,
															borderRadius: 8,
															border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
															background: "var(--dsw-alias-bg-layer-3, #ffffff)",
															padding: "0 12px",
															fontSize: 13,
															color: "var(--dsw-alias-label-primary, #111827)"
														},
														placeholder: state.tokenConfigured ? t("tokenPlaceholderSet") : t("tokenPlaceholder"),
														value: state.draftToken ?? "",
														disabled,
														onChange: (e) => props.setDraftToken(e.target.value)
													}),
													(0, react_jsx_runtime.jsx)("p", {
														style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary, #9ca3af)", margin: 0 },
														children: t("tokenHint")
													})
												]
											}),
											(0, react_jsx_runtime.jsxs)("div", {
												style: { display: "flex", flexDirection: "column", gap: 6 },
												children: [
													(0, react_jsx_runtime.jsx)("label", {
														style: { fontSize: 13, fontWeight: 500, color: "var(--dsw-alias-label-primary, #111827)" },
														children: t("baseUrlLabel")
													}),
													(0, react_jsx_runtime.jsx)("input", {
														type: "text",
														style: {
															height: 36,
															borderRadius: 8,
															border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
															background: "var(--dsw-alias-bg-layer-3, #ffffff)",
															padding: "0 12px",
															fontSize: 13,
															color: "var(--dsw-alias-label-primary, #111827)"
														},
														placeholder: "https://daily-cloudcode-pa.googleapis.com/v1internal",
														value: state.draftBaseUrl ?? state.effectiveBaseUrl ?? "",
														disabled,
														onChange: (e) => props.setDraftBaseUrl(e.target.value)
													}),
													(0, react_jsx_runtime.jsx)("p", {
														style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary, #9ca3af)", margin: 0 },
														children: t("baseUrlHint")
													})
												]
											})
										]
									}),
									(0, react_jsx_runtime.jsxs)("div", {
										style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 },
										children: [
											dirty ? (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												style: {
													padding: "6px 14px",
													borderRadius: 6,
													border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
													background: "none",
													fontSize: 12,
													cursor: "pointer",
													color: "var(--dsw-alias-label-secondary, #4b5563)"
												},
												onClick: props.discard,
												children: t("discard")
											}) : null,
											(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												style: {
													padding: "6px 14px",
													borderRadius: 6,
													border: "none",
													background: "var(--dsw-alias-brand-primary, #0284c7)",
													color: "#ffffff",
													fontSize: 12,
													fontWeight: 500,
													cursor: dirty ? "pointer" : "default",
													opacity: dirty ? 1 : 0.5
												},
												disabled: !dirty || disabled || state.saving,
												onClick: props.save,
												children: t(state.saving ? "saving" : "save")
											})
										]
									})
								]
							}) : null
						]
					}) : null
				]
			});
		}

		class AntigravityCardController {
			constructor(scope, api) {
				this.scope = scope;
				this.api = api;
				this.draftToken = void 0;
				this.draftBaseUrl = void 0;
				this.saving = false;
				this.tokenConfigured = false;
				this.store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(this.projection());
				scope.subscribe(() => {
					this.store.set(this.projection());
				});
				this.checkCredential();
			}

			async checkCredential() {
				try {
					const res = await this.api.credentials.describe({ refs: [TOKEN_REF] });
					if (res.result.ok) {
						this.tokenConfigured = res.result.value.credentials[TOKEN_REF]?.configured ?? false;
						this.store.set(this.projection());
					}
				} catch (e) {}
			}

			projection() {
				const snapshot = this.scope.getSnapshot();
				const effectiveBaseUrl = snapshot.value?.baseURL ?? "https://daily-cloudcode-pa.googleapis.com/v1internal";
				return {
					writable: snapshot.writable,
					effectiveBaseUrl,
					draftBaseUrl: this.draftBaseUrl,
					draftToken: this.draftToken,
					tokenConfigured: this.tokenConfigured,
					saving: this.saving
				};
			}

			setDraftToken(val) {
				this.draftToken = val;
				this.store.set(this.projection());
			}

			setDraftBaseUrl(val) {
				this.draftBaseUrl = val;
				this.store.set(this.projection());
			}

			discard() {
				this.draftToken = void 0;
				this.draftBaseUrl = void 0;
				this.store.set(this.projection());
			}

			async save() {
				this.saving = true;
				this.store.set(this.projection());
				try {
					if (this.draftToken !== void 0 && this.draftToken.trim().length > 0) {
						await this.api.credentials.set({
							ref: TOKEN_REF,
							value: this.draftToken.trim()
						});
						this.tokenConfigured = true;
						this.draftToken = void 0;
					}
					if (this.draftBaseUrl !== void 0) {
						await this.api.settings.mutate({
							ns: NS,
							ops: [{ op: "set", path: ["baseURL"], value: this.draftBaseUrl.trim() }]
						});
						this.draftBaseUrl = void 0;
					}
				} catch (e) {
					console.error(e);
				} finally {
					this.saving = false;
					await this.checkCredential();
					this.store.set(this.projection());
				}
			}

			inject() {
				return {
					hooks: { antigravityCard: this.store },
					setDraftToken: (val) => this.setDraftToken(val),
					setDraftBaseUrl: (val) => this.setDraftBaseUrl(val),
					save: () => this.save(),
					discard: () => this.discard()
				};
			}
		}

		const inject = [
			"slots",
			"locale",
			"connection",
			"remote",
			"settingsScope"
		];

		function apply(ctx) {
			const { api } = ctx.get("connection");
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "llm-antigravity: locales");

			const controller = new AntigravityCardController(
				ctx.settingsScope.bind({ namespace: NS }),
				api
			);

			ctx.effect(() => ctx.remote.$on("credentials/updated", (ref) => {
				if (ref === TOKEN_REF) controller.checkCredential();
			}), "llm-antigravity: credential update watcher");

			ctx.slots.inject("settings.plugin.item", function* () {
				yield ctx.slots.register({
					name: "settings.plugin.item",
					key: NS,
					locale: NS,
					inject: () => controller.inject()
				}, AntigravityCard);
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	};

	const ids = [
		"dsh-llm-antigravity",
		"./plugins/dsh-llm-antigravity",
		"plugins/dsh-llm-antigravity",
		"./plugins/dsh-llm-antigravity/lib/index.js",
		"plugins/dsh-llm-antigravity/lib/index.js"
	];

	if (typeof window !== "undefined" && window.__ModuleLoader__) {
		for (const id of ids) {
			try {
				window.__ModuleLoader__.load({ id, factory });
			} catch (e) {}
		}
	}
})();