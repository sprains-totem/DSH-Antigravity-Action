(function() {
	const NS = "web-search-selector";

	const en = {
		title: "Web search provider",
		description: "Select the backend provider used by the web search tool.",
		providerLabel: "Search provider",
		providerHint: "Choose whether web searches use DeepSeek or Google Antigravity Grounding.",
		optDeepseek: "DeepSeek Official",
		optAntigravity: "Google Antigravity (Grounding)",
		overridden: "Overridden",
		reset: "Reset to default",
		save: "Save",
		saving: "Saving…",
		discard: "Discard",
		unsaved: "Unsaved",
		saveFailed: "Failed to save search provider.",
		readOnly: "Settings are read-only."
	};

	const zh = {
		title: "网页搜索源",
		description: "选择网页搜索工具调用的后端提供方。",
		providerLabel: "搜索提供方",
		providerHint: "选择搜索工具使用 DeepSeek 官方搜索还是 Google Antigravity 搜索。",
		optDeepseek: "DeepSeek 官方搜索",
		optAntigravity: "Google Antigravity 搜索",
		overridden: "已覆盖",
		reset: "恢复默认",
		save: "保存",
		saving: "保存中…",
		discard: "放弃修改",
		unsaved: "未保存",
		saveFailed: "保存设置失败，请重试。",
		readOnly: "本部署的设置为只读。"
	};

	const factory = (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react_jsx_runtime = require("react/jsx-runtime");
		const react = require("react");
		const _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");

		function WebSearchSelectorCard(props) {
			const [open, setOpen] = react.useState(true);
			const { t } = props;
			const state = props.useWebSearchSelectorCard((snapshot) => snapshot);
			const disabled = !state.writable;
			const current = state.draftProvider ?? state.effectiveProvider ?? "antigravity";
			const dirty = state.draftProvider !== void 0 && state.draftProvider !== state.effectiveProvider;

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
					open ? (0, react_jsx_runtime.jsxs)("div", {
						style: { padding: "0 20px 20px 20px", borderTop: "1px solid var(--dsw-alias-border-l3, #f3f4f6)" },
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								style: { padding: "16px 0", display: "flex", flexDirection: "column", gap: 8 },
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
										children: [
											(0, react_jsx_runtime.jsx)("label", {
												style: { fontSize: 13, fontWeight: 500, color: "var(--dsw-alias-label-primary, #111827)" },
												children: t("providerLabel")
											}),
											state.isOverridden ? (0, react_jsx_runtime.jsxs)("div", {
												style: { display: "flex", gap: 6, alignItems: "center" },
												children: [
													(0, react_jsx_runtime.jsx)("span", {
														style: { fontSize: 11, padding: "1px 6px", borderRadius: 999, background: "var(--dsw-alias-bg-module-platform, #f3f4f6)", color: "var(--dsw-alias-label-secondary, #6b7280)" },
														children: t("overridden")
													}),
													(0, react_jsx_runtime.jsx)("button", {
														type: "button",
														style: { fontSize: 12, color: "var(--dsw-alias-brand-primary, #0284c7)", background: "none", border: "none", cursor: "pointer" },
														onClick: props.reset,
														children: t("reset")
													})
												]
											}) : null
										]
									}),
									(0, react_jsx_runtime.jsxs)("select", {
										style: {
											height: 36,
											borderRadius: 8,
											border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
											background: "var(--dsw-alias-bg-layer-3, #ffffff)",
											padding: "0 12px",
											fontSize: 13,
											color: "var(--dsw-alias-label-primary, #111827)"
										},
										value: current,
										disabled,
										onChange: (e) => props.setProvider(e.target.value),
										children: [
											(0, react_jsx_runtime.jsx)("option", { value: "antigravity", children: t("optAntigravity") }),
											(0, react_jsx_runtime.jsx)("option", { value: "deepseek-official", children: t("optDeepseek") })
										]
									}),
									(0, react_jsx_runtime.jsx)("p", {
										style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary, #9ca3af)", margin: 0 },
										children: t("providerHint")
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 },
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
			});
		}

		class WebSearchSelectorController {
			constructor(scope, api) {
				this.scope = scope;
				this.api = api;
				this.draft = void 0;
				this.saving = false;
				this.store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(this.projection());
				scope.subscribe(() => {
					this.store.set(this.projection());
				});
			}

			projection() {
				const snapshot = this.scope.getSnapshot();
				const effective = snapshot.value?.provider ?? "antigravity";
				const isOverridden = snapshot.user?.provider !== void 0;
				return {
					writable: snapshot.writable,
					effectiveProvider: effective,
					draftProvider: this.draft,
					isOverridden,
					saving: this.saving
				};
			}

			setProvider(val) {
				this.draft = val;
				this.store.set(this.projection());
			}

			discard() {
				this.draft = void 0;
				this.store.set(this.projection());
			}

			async reset() {
				this.draft = void 0;
				try {
					await this.api.settings.mutate({
						ns: NS,
						ops: [{ op: "delete", path: ["provider"] }]
					});
				} catch (e) {
					console.error(e);
				}
				this.store.set(this.projection());
			}

			async save() {
				if (this.draft === void 0) return;
				this.saving = true;
				this.store.set(this.projection());
				try {
					await this.api.settings.mutate({
						ns: NS,
						ops: [{ op: "set", path: ["provider"], value: this.draft }]
					});
					this.draft = void 0;
				} catch (e) {
					console.error(e);
				} finally {
					this.saving = false;
					this.store.set(this.projection());
				}
			}

			inject() {
				return {
					hooks: { webSearchSelectorCard: this.store },
					setProvider: (val) => this.setProvider(val),
					save: () => this.save(),
					discard: () => this.discard(),
					reset: () => this.reset()
				};
			}
		}

		const inject = [
			"slots",
			"locale",
			"connection",
			"settingsScope"
		];

		function apply(ctx) {
			const { api } = ctx.get("connection");
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "web-search-selector: locales");

			const controller = new WebSearchSelectorController(
				ctx.settingsScope.bind({ namespace: NS }),
				api
			);

			ctx.slots.inject("settings.plugin.item", function* () {
				yield ctx.slots.register({
					name: "settings.plugin.item",
					key: NS,
					locale: NS,
					inject: () => controller.inject()
				}, WebSearchSelectorCard);
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	};

	const ids = [
		"dsh-web-search-selector",
		"./plugins/dsh-web-search-selector",
		"plugins/dsh-web-search-selector",
		"./plugins/dsh-web-search-selector/lib/index.js",
		"plugins/dsh-web-search-selector/lib/index.js"
	];

	if (typeof window !== "undefined" && window.__ModuleLoader__) {
		for (const id of ids) {
			try {
				window.__ModuleLoader__.load({ id, factory });
			} catch (e) {}
		}
	}
})();
