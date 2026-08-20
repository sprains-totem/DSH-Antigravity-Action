(function() {
	const NS = "llm-antigravity";
	const TOKEN_REF = "ANTIGRAVITY_REFRESH_TOKEN";

	const en = {
		title: "Antigravity (Google Cloud Code)",
		description: "Google Cloud Code Gemini adapter with OAuth 2.0 refresh_token support.",
		tokenLabel: "Refresh Token",
		tokenHint: "Google Cloud Code OAuth 2.0 refresh token. Stored securely in credentials service.",
		tokenConfigured: "Refresh Token configured.",
		tokenMissing: "No Refresh Token configured; Antigravity models are unavailable.",
		tokenPlaceholder: "OAuth 2.0 Refresh Token",
		tokenPlaceholderSet: "Refresh Token configured (leave blank to keep unchanged)",
		baseUrlLabel: "Base URL",
		baseUrlHint: "Default: https://daily-cloudcode-pa.googleapis.com/v1internal",
		overridden: "Overridden",
		reset: "Reset to default",
		save: "Save",
		saving: "Saving…",
		discard: "Discard",
		unsaved: "Unsaved"
	};

	const zh = {
		title: "Antigravity (Google Cloud Code)",
		description: "Google Cloud Code Gemini 适配器，支持 OAuth 2.0 refresh_token 认证与图片/工具调用。",
		tokenLabel: "Refresh Token",
		tokenHint: "Google Cloud Code OAuth 2.0 刷新令牌，安全保存在本地凭据库中。",
		tokenConfigured: "Refresh Token 已配置。",
		tokenMissing: "未配置 Refresh Token；配置前 Antigravity 模型不可用。",
		tokenPlaceholder: "请输入 OAuth 2.0 Refresh Token",
		tokenPlaceholderSet: "Refresh Token 已配置（留空保持不变）",
		baseUrlLabel: "接口地址 (Base URL)",
		baseUrlHint: "默认: https://daily-cloudcode-pa.googleapis.com/v1internal",
		overridden: "已覆盖",
		reset: "恢复默认",
		save: "保存",
		saving: "保存中…",
		discard: "放弃修改",
		unsaved: "未保存"
	};

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
			const { t } = props;
			const state = props.useAntigravityCard((snapshot) => snapshot);
			const disabled = !state.writable;
			const dirty = state.draftToken !== void 0 || state.draftBaseUrl !== void 0;

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
									state.tokenConfigured ? (0, react_jsx_runtime.jsx)("span", {
										style: { fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#dcfce7", color: "#16a34a" },
										children: t("tokenConfigured")
									}) : (0, react_jsx_runtime.jsx)("span", {
										style: { fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#fee2e2", color: "#dc2626" },
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
					open ? (0, react_jsx_runtime.jsxs)("div", {
						style: { padding: "0 20px 20px 20px", borderTop: "1px solid var(--dsw-alias-border-l3, #f3f4f6)" },
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								style: { padding: "16px 0", display: "flex", flexDirection: "column", gap: 12 },
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
