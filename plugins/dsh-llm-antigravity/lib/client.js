(function() {
	const NS = "llm-antigravity";
	const TOKEN_REF = "ANTIGRAVITY_REFRESH_TOKEN";

	const en = {
		title: "Antigravity (Google Cloud Code)",
		description: "Google Cloud Code Gemini adapter with OAuth 2.0 refresh_token, live quota & usage statistics.",
		tabQuota: "Real-time Quota",
		tabUsage: "Usage Statistics",
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
		savingsCol: "Savings"
	};

	const zh = {
		title: "Antigravity (Google Cloud Code)",
		description: "Google Cloud Code Gemini 适配器，支持 OAuth 2.0 认证、实时额度监控与 Token 用量统计。",
		tabQuota: "实时额度",
		tabUsage: "用量统计",
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
		savingsCol: "缓存节省"
	};

	function formatTokens(num) {
		if (num === void 0 || num === null || isNaN(num)) return "0";
		if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
		if (num >= 1000) return (num / 1000).toFixed(1) + "k";
		return num.toLocaleString();
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
			const [activeTab, setActiveTab] = react.useState("quota"); // 'quota' | 'usage' | 'config'
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
				if (open && activeTab === "quota" && !quotaData && state.tokenConfigured) {
					fetchQuota(false);
				}
				if (open && activeTab === "usage" && !usageData) {
					fetchUsage();
				}
			}, [open, activeTab, state.tokenConfigured, quotaData, usageData, fetchQuota, fetchUsage]);

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
									background: "var(--dsw-alias-bg-layer-1, #f9fafb)"
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
											cursor: "pointer"
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
											cursor: "pointer"
										},
										onClick: () => setActiveTab("usage"),
										children: `📊 ${t("tabUsage")}`
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
											cursor: "pointer"
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
										style: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 },
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
																	`↓${formatTokens(rec.outputTokens)}`
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

							// Tab 3: Configuration View
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
