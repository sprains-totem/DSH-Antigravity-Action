(function() {
	const NS = "easytier";

	const en = {
		title: "EasyTier Mesh VPN",
		description: "Connect to DeepSeek Harness via decentralized EasyTier mesh network with userspace No-TUN support.",
		statusLabel: "Network Status",
		statusRunning: "🟢 Connected",
		statusStarting: "🟡 Connecting…",
		statusStopped: "🔴 Stopped",
		statusUnconfigured: "⚪ Unconfigured",
		statusError: "⚠️ Error",
		virtualIpLabel: "Virtual Mesh IP & URL",
		copyUrl: "Copy URL",
		copied: "Copied!",
		noUrl: "No virtual network URL active",
		enabledLabel: "Auto-start EasyTier",
		enabledHint: "Automatically launch EasyTier daemon when DeepSeek Harness starts.",
		networkNameLabel: "Network Name",
		networkNamePlaceholder: "e.g. dsh-mesh-network",
		networkNameHint: "Unique virtual network identifier shared across your devices.",
		networkSecretLabel: "Network Secret",
		networkSecretPlaceholder: "Shared authentication passphrase",
		networkSecretHint: "Passphrase required to authenticate nodes joining this mesh network.",
		ipv4Label: "Node IPv4 (Optional)",
		ipv4Placeholder: "e.g. 10.144.144.1 (leave empty for auto DHCP)",
		ipv4Hint: "Static virtual IP for this container node, or leave blank to use automatic DHCP.",
		peersLabel: "Initial Peers",
		peersPlaceholder: "tcp://39.108.52.138:11010, tcp://public.easytier.top:11010",
		peersHint: "Public or private peer addresses separated by commas.",
		noTunLabel: "No-TUN Userspace Mode",
		noTunHint: "Bypass /dev/net/tun kernel requirement; enables rootless container transparent proxying.",
		overridden: "Overridden",
		reset: "Reset to default",
		save: "Save",
		saved: "Saved!",
		saving: "Saving…",
		discard: "Discard",
		unsaved: "Unsaved",
		saveFailed: "Failed to save EasyTier settings.",
		readOnly: "Settings are read-only."
	};

	const zh = {
		title: "EasyTier 异地组网 (No-TUN 模式)",
		description: "通过 EasyTier 去中心化虚拟网直连 DeepSeek Harness，支持容器内免 Root、免 TUN 虚拟网卡穿透。",
		statusLabel: "组网状态",
		statusRunning: "🟢 已组网",
		statusStarting: "🟡 正在组网…",
		statusStopped: "🔴 已停止",
		statusUnconfigured: "⚪ 未配置",
		statusError: "⚠️ 异常",
		virtualIpLabel: "虚拟网访问链接",
		copyUrl: "复制链接",
		copied: "已复制！",
		noUrl: "暂无虚拟网链接（未配置或未启动）",
		enabledLabel: "随 DSH 自动启动",
		enabledHint: "启动 DeepSeek Harness 时自动拉起 EasyTier 节点并加入指定网络。",
		networkNameLabel: "网络名称 (Network Name)",
		networkNamePlaceholder: "例如: dsh-mesh-network",
		networkNameHint: "用于标识该虚拟专网的唯一名称（同一网络内的设备需保持一致）。",
		networkSecretLabel: "网络密码 (Network Secret)",
		networkSecretPlaceholder: "组网安全访问密码",
		networkSecretHint: "节点加入该虚拟网络所需的验证密码。",
		ipv4Label: "节点虚拟 IP (可选)",
		ipv4Placeholder: "例如: 10.144.144.1 (留空则走 DHCP 自动分配)",
		ipv4Hint: "手动指定本节点的虚拟 IPv4 地址，留空则由 EasyTier DHCP 自动协商分配。",
		peersLabel: "公共 / 引导节点 (Peers)",
		peersPlaceholder: "tcp://39.108.52.138:11010, tcp://public.easytier.top:11010",
		peersHint: "用于协助 P2P 打洞和中继的 Peer 列表，使用逗号分隔。",
		noTunLabel: "No-TUN 用户态模式 (容器推荐)",
		noTunHint: "无需内核 /dev/net/tun 设备与 Root 特权，通过用户态协议栈代理提供服务访问。",
		overridden: "已覆盖",
		reset: "恢复默认",
		save: "保存",
		saved: "已保存！",
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
		const _deepseek_ai_dsh_client_runtime_client = (() => {
			try {
				const mod = require("@deepseek-ai/dsh-client-store");
				if (mod && typeof mod.createSnapshotStore === "function") return mod;
			} catch (e) {}
			return {
				createSnapshotStore: (init) => {
					let s = init;
					const subs = new Set();
					return {
						get: () => s,
						set: (n) => { s = n; subs.forEach((cb) => cb()); },
						subscribe: (cb) => { subs.add(cb); return () => subs.delete(cb); }
					};
				}
			};
		})();

		function EasyTierCard(props) {
			const [open, setOpen] = react.useState(true);
			const [copied, setCopied] = react.useState(false);
			const { t } = props;
			const state = props.useEasyTierCard((snapshot) => snapshot);
			const disabled = state.writable === false;

			const currentEnabled = state.draftEnabled ?? state.effectiveEnabled ?? true;
			const currentNetworkName = state.draftNetworkName ?? state.effectiveNetworkName ?? "";
			const currentNetworkSecret = state.draftNetworkSecret ?? state.effectiveNetworkSecret ?? "";
			const currentIpv4 = state.draftIpv4 ?? state.effectiveIpv4 ?? "";
			const currentPeers = state.draftPeers ?? state.effectivePeers ?? "tcp://39.108.52.138:11010, tcp://public.easytier.top:11010";
			const currentNoTun = state.draftNoTun ?? state.effectiveNoTun ?? true;

			const dirty =
				(state.draftEnabled !== void 0 && state.draftEnabled !== state.effectiveEnabled) ||
				(state.draftNetworkName !== void 0 && state.draftNetworkName !== state.effectiveNetworkName) ||
				(state.draftNetworkSecret !== void 0 && state.draftNetworkSecret !== state.effectiveNetworkSecret) ||
				(state.draftIpv4 !== void 0 && state.draftIpv4 !== state.effectiveIpv4) ||
				(state.draftPeers !== void 0 && state.draftPeers !== state.effectivePeers) ||
				(state.draftNoTun !== void 0 && state.draftNoTun !== state.effectiveNoTun);

			const displayUrl = state.virtualIp
				? `http://${state.virtualIp}:3080`
				: (state.effectiveIpv4 ? `http://${state.effectiveIpv4}:3080` : t("noUrl"));

			const copyToClipboard = () => {
				if (displayUrl && displayUrl.startsWith("http") && navigator.clipboard) {
					navigator.clipboard.writeText(displayUrl).then(() => {
						setCopied(true);
						setTimeout(() => setCopied(false), 2000);
					});
				}
			};

			const getStatusBadge = () => {
				if (!currentNetworkName) {
					return { text: t("statusUnconfigured"), bg: "var(--dsw-alias-bg-module-platform, #f3f4f6)", color: "var(--dsw-alias-label-secondary, #6b7280)" };
				}
				if (state.virtualIp || state.status === "running") {
					return { text: t("statusRunning"), bg: "#dcfce7", color: "#15803d" };
				}
				if (state.status === "error") {
					return { text: t("statusError"), bg: "#fee2e2", color: "#b91c1c" };
				}
				if (state.status === "stopped") {
					return { text: t("statusStopped"), bg: "var(--dsw-alias-bg-module-platform, #f3f4f6)", color: "var(--dsw-alias-label-secondary, #6b7280)" };
				}
				return { text: t("statusStarting"), bg: "#fef3c7", color: "#b45309" };
			};

			const statusBadge = getStatusBadge();

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
									(0, react_jsx_runtime.jsxs)("div", {
										style: { display: "flex", alignItems: "center", gap: 8 },
										children: [
											(0, react_jsx_runtime.jsx)("span", {
												style: { fontSize: 14, fontWeight: 600, color: "var(--dsw-alias-label-primary, #111827)" },
												children: t("title")
											}),
											(0, react_jsx_runtime.jsx)("span", {
												style: {
													fontSize: 11,
													padding: "1px 8px",
													borderRadius: 999,
													background: statusBadge.bg,
													color: statusBadge.color,
													fontWeight: 500
												},
												children: statusBadge.text
											})
										]
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
									}) : state.justSaved ? (0, react_jsx_runtime.jsx)("span", {
										style: { fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#dcfce7", color: "#15803d", fontWeight: 500 },
										children: t("saved")
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
							// Virtual URL Box
							(0, react_jsx_runtime.jsxs)("div", {
								style: {
									margin: "16px 0",
									padding: "12px 16px",
									borderRadius: 8,
									background: "var(--dsw-alias-bg-layer-3, #f9fafb)",
									border: "1px solid var(--dsw-alias-border-l2, #e5e7eb)",
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: 12
								},
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										style: { minWidth: 0, flex: 1 },
										children: [
											(0, react_jsx_runtime.jsx)("div", {
												style: { fontSize: 11, fontWeight: 600, color: "var(--dsw-alias-label-secondary, #6b7280)", textTransform: "uppercase", letterSpacing: "0.05em" },
												children: t("virtualIpLabel")
											}),
											(0, react_jsx_runtime.jsx)("div", {
												style: {
													fontSize: 13,
													fontFamily: "monospace",
													color: "var(--dsw-alias-brand-primary, #0284c7)",
													fontWeight: 600,
													marginTop: 2,
													wordBreak: "break-all"
												},
												children: displayUrl
											})
										]
									}),
									displayUrl.startsWith("http") ? (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: {
											padding: "6px 12px",
											borderRadius: 6,
											border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
											background: copied ? "#dcfce7" : "var(--dsw-alias-bg-layer-2, #ffffff)",
											color: copied ? "#15803d" : "var(--dsw-alias-label-primary, #111827)",
											fontSize: 12,
											fontWeight: 500,
											cursor: "pointer",
											flexShrink: 0
										},
										onClick: copyToClipboard,
										children: copied ? t("copied") : t("copyUrl")
									}) : null
								]
							}),

							// Settings Form
							(0, react_jsx_runtime.jsxs)("div", {
								style: { display: "flex", flexDirection: "column", gap: 14 },
								children: [
									// Network Name
									(0, react_jsx_runtime.jsxs)("div", {
										style: { display: "flex", flexDirection: "column", gap: 4 },
										children: [
											(0, react_jsx_runtime.jsx)("label", {
												style: { fontSize: 13, fontWeight: 500, color: "var(--dsw-alias-label-primary, #111827)" },
												children: t("networkNameLabel")
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
												value: currentNetworkName,
												placeholder: t("networkNamePlaceholder"),
												disabled,
												onChange: (e) => props.setNetworkName(e.target.value)
											}),
											(0, react_jsx_runtime.jsx)("p", {
												style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary, #9ca3af)", margin: 0 },
												children: t("networkNameHint")
											})
										]
									}),

									// Network Secret
									(0, react_jsx_runtime.jsxs)("div", {
										style: { display: "flex", flexDirection: "column", gap: 4 },
										children: [
											(0, react_jsx_runtime.jsx)("label", {
												style: { fontSize: 13, fontWeight: 500, color: "var(--dsw-alias-label-primary, #111827)" },
												children: t("networkSecretLabel")
											}),
											(0, react_jsx_runtime.jsx)("input", {
												type: "password",
												style: {
													height: 36,
													borderRadius: 8,
													border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
													background: "var(--dsw-alias-bg-layer-3, #ffffff)",
													padding: "0 12px",
													fontSize: 13,
													color: "var(--dsw-alias-label-primary, #111827)"
												},
												value: currentNetworkSecret,
												placeholder: t("networkSecretPlaceholder"),
												disabled,
												onChange: (e) => props.setNetworkSecret(e.target.value)
											}),
											(0, react_jsx_runtime.jsx)("p", {
												style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary, #9ca3af)", margin: 0 },
												children: t("networkSecretHint")
											})
										]
									}),

									// IPv4
									(0, react_jsx_runtime.jsxs)("div", {
										style: { display: "flex", flexDirection: "column", gap: 4 },
										children: [
											(0, react_jsx_runtime.jsx)("label", {
												style: { fontSize: 13, fontWeight: 500, color: "var(--dsw-alias-label-primary, #111827)" },
												children: t("ipv4Label")
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
												value: currentIpv4,
												placeholder: t("ipv4Placeholder"),
												disabled,
												onChange: (e) => props.setIpv4(e.target.value)
											}),
											(0, react_jsx_runtime.jsx)("p", {
												style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary, #9ca3af)", margin: 0 },
												children: t("ipv4Hint")
											})
										]
									}),

									// Peers
									(0, react_jsx_runtime.jsxs)("div", {
										style: { display: "flex", flexDirection: "column", gap: 4 },
										children: [
											(0, react_jsx_runtime.jsx)("label", {
												style: { fontSize: 13, fontWeight: 500, color: "var(--dsw-alias-label-primary, #111827)" },
												children: t("peersLabel")
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
												value: currentPeers,
												placeholder: t("peersPlaceholder"),
												disabled,
												onChange: (e) => props.setPeers(e.target.value)
											}),
											(0, react_jsx_runtime.jsx)("p", {
												style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary, #9ca3af)", margin: 0 },
												children: t("peersHint")
											})
										]
									}),

									// Checkboxes (Auto Start & No-TUN)
									(0, react_jsx_runtime.jsxs)("div", {
										style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 4 },
										children: [
											(0, react_jsx_runtime.jsxs)("label", {
												style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--dsw-alias-label-primary, #111827)", cursor: "pointer" },
												children: [
													(0, react_jsx_runtime.jsx)("input", {
														type: "checkbox",
														checked: currentEnabled,
														disabled,
														onChange: (e) => props.setEnabled(e.target.checked)
													}),
													t("enabledLabel")
												]
											}),
											(0, react_jsx_runtime.jsxs)("label", {
												style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--dsw-alias-label-primary, #111827)", cursor: "pointer" },
												children: [
													(0, react_jsx_runtime.jsx)("input", {
														type: "checkbox",
														checked: currentNoTun,
														disabled,
														onChange: (e) => props.setNoTun(e.target.checked)
													}),
													t("noTunLabel")
												]
											})
										]
									})
								]
							}),

							// Save / Discard Actions
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
											background: state.justSaved ? "#15803d" : "var(--dsw-alias-brand-primary, #0284c7)",
											color: "#ffffff",
											fontSize: 12,
											fontWeight: 500,
											cursor: (dirty && !state.saving) ? "pointer" : "default",
											opacity: (dirty || state.saving) ? 1 : (state.justSaved ? 0.9 : 0.5),
											transition: "all 0.2s"
										},
										disabled: !dirty || disabled || state.saving,
										onClick: props.save,
										children: state.saving ? t("saving") : (state.justSaved ? t("saved") : t("save"))
									})
								]
							})
						]
					}) : null
				]
			});
		}

		class EasyTierController {
			constructor(scope) {
				this.scope = scope;
				this.draft = {};
				this.saving = false;
				this.justSaved = false;
				this.justSavedTimer = null;
				this.runtimeStatus = null;
				this.pollTimer = null;
				this.localSaved = this.loadLocalSaved();
				this.store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(this.projection());
				if (scope && typeof scope.subscribe === "function") {
					scope.subscribe(() => {
						this.store.set(this.projection());
					});
				}
				this.startPolling();
			}

			startPolling() {
				this.fetchStatus();
				if (typeof setInterval !== "undefined") {
					this.pollTimer = setInterval(() => this.fetchStatus(), 3000);
				}
			}

			async fetchStatus() {
				try {
					if (typeof fetch !== "undefined") {
						const res = await fetch('/api/easytier/status');
						if (res.ok) {
							const data = await res.json();
							if (data && typeof data === "object") {
								this.runtimeStatus = data;
								this.store.set(this.projection());
							}
						}
					}
				} catch (e) {}
			}

			loadLocalSaved() {
				try {
					if (typeof localStorage !== "undefined") {
						const raw = localStorage.getItem("dsh_easytier_settings");
						if (raw) return JSON.parse(raw);
					}
				} catch (e) {}
				return null;
			}

			projection() {
				const snapshot = (this.scope && typeof this.scope.getSnapshot === "function")
					? this.scope.getSnapshot()
					: {};
				const effective = snapshot.value ?? {};
				const local = this.localSaved ?? {};
				const runtime = this.runtimeStatus ?? {};

				const effectiveEnabled = this.draft.enabled ?? local.enabled ?? effective.enabled ?? true;
				const effectiveNetworkName = this.draft.networkName ?? local.networkName ?? effective.networkName ?? "";
				const effectiveNetworkSecret = this.draft.networkSecret ?? local.networkSecret ?? effective.networkSecret ?? "";
				const effectiveIpv4 = this.draft.ipv4 ?? local.ipv4 ?? effective.ipv4 ?? "";
				const effectivePeers = this.draft.peers ?? local.peers ?? effective.peers ?? "tcp://39.108.52.138:11010, tcp://public.easytier.top:11010";
				const effectiveNoTun = this.draft.noTun ?? local.noTun ?? effective.noTun ?? true;

				const virtualIp = runtime.virtualIp || effective.virtualIp || local.virtualIp || "";
				const status = runtime.status || (virtualIp ? "running" : (effectiveNetworkName ? "starting" : "unconfigured"));

				return {
					writable: snapshot.writable !== false,
					effectiveEnabled: local.enabled ?? effective.enabled ?? true,
					effectiveNetworkName: local.networkName ?? effective.networkName ?? "",
					effectiveNetworkSecret: local.networkSecret ?? effective.networkSecret ?? "",
					effectiveIpv4: local.ipv4 ?? effective.ipv4 ?? "",
					effectivePeers: local.peers ?? effective.peers ?? "tcp://39.108.52.138:11010, tcp://public.easytier.top:11010",
					effectiveNoTun: local.noTun ?? effective.noTun ?? true,
					draftEnabled: this.draft.enabled,
					draftNetworkName: this.draft.networkName,
					draftNetworkSecret: this.draft.networkSecret,
					draftIpv4: this.draft.ipv4,
					draftPeers: this.draft.peers,
					draftNoTun: this.draft.noTun,
					virtualIp,
					status,
					peersCount: runtime.peersCount ?? 0,
					peerId: runtime.peerId ?? null,
					saving: this.saving,
					justSaved: this.justSaved
				};
			}

			setEnabled(val) {
				this.draft.enabled = val;
				this.justSaved = false;
				this.store.set(this.projection());
			}

			setNetworkName(val) {
				this.draft.networkName = val;
				this.justSaved = false;
				this.store.set(this.projection());
			}

			setNetworkSecret(val) {
				this.draft.networkSecret = val;
				this.justSaved = false;
				this.store.set(this.projection());
			}

			setIpv4(val) {
				this.draft.ipv4 = val;
				this.justSaved = false;
				this.store.set(this.projection());
			}

			setPeers(val) {
				this.draft.peers = val;
				this.justSaved = false;
				this.store.set(this.projection());
			}

			setNoTun(val) {
				this.draft.noTun = val;
				this.justSaved = false;
				this.store.set(this.projection());
			}

			discard() {
				this.draft = {};
				this.justSaved = false;
				this.store.set(this.projection());
			}

			async reset() {
				this.draft = {};
				this.justSaved = false;
				try {
					if (typeof localStorage !== "undefined") {
						localStorage.removeItem("dsh_easytier_settings");
					}
					this.localSaved = null;
					if (this.scope && typeof this.scope.mutate === "function") {
						await this.scope.mutate([
							{ op: "unset", path: ["enabled"] },
							{ op: "unset", path: ["networkName"] },
							{ op: "unset", path: ["networkSecret"] },
							{ op: "unset", path: ["ipv4"] },
							{ op: "unset", path: ["peers"] },
							{ op: "unset", path: ["noTun"] }
						]);
					}
				} catch (e) {
					console.warn("[easytier] reset error:", e);
				}
				this.store.set(this.projection());
			}

			async save() {
				if (Object.keys(this.draft).length === 0) return;
				this.saving = true;
				this.justSaved = false;
				this.store.set(this.projection());

				const current = this.projection();
				const nextSaved = {
					enabled: this.draft.enabled ?? current.effectiveEnabled,
					networkName: this.draft.networkName ?? current.effectiveNetworkName,
					networkSecret: this.draft.networkSecret ?? current.effectiveNetworkSecret,
					ipv4: this.draft.ipv4 ?? current.effectiveIpv4,
					peers: this.draft.peers ?? current.effectivePeers,
					noTun: this.draft.noTun ?? current.effectiveNoTun
				};

				try {
					const ops = [];
					if (this.draft.enabled !== void 0) ops.push({ op: "set", path: ["enabled"], value: this.draft.enabled });
					if (this.draft.networkName !== void 0) ops.push({ op: "set", path: ["networkName"], value: this.draft.networkName });
					if (this.draft.networkSecret !== void 0) ops.push({ op: "set", path: ["networkSecret"], value: this.draft.networkSecret });
					if (this.draft.ipv4 !== void 0) ops.push({ op: "set", path: ["ipv4"], value: this.draft.ipv4 });
					if (this.draft.peers !== void 0) ops.push({ op: "set", path: ["peers"], value: this.draft.peers });
					if (this.draft.noTun !== void 0) ops.push({ op: "set", path: ["noTun"], value: this.draft.noTun });

					if (ops.length > 0 && this.scope && typeof this.scope.mutate === "function") {
						try {
							await this.scope.mutate(ops);
						} catch (scopeErr) {
							console.warn("[easytier] scope.mutate warning:", scopeErr);
						}
					}

					// 同步发送到 backend HTTP API 接口即时重载/拉起守护
					try {
						if (typeof fetch !== "undefined") {
							await fetch('/api/easytier/config', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(nextSaved)
							});
						}
					} catch (apiErr) {}

					// 本地持久化缓存
					try {
						if (typeof localStorage !== "undefined") {
							localStorage.setItem("dsh_easytier_settings", JSON.stringify(nextSaved));
						}
						this.localSaved = nextSaved;
					} catch (lsErr) {}

					this.draft = {};
					this.justSaved = true;
					if (this.justSavedTimer) clearTimeout(this.justSavedTimer);
					this.justSavedTimer = setTimeout(() => {
						this.justSaved = false;
						this.store.set(this.projection());
					}, 2500);

					await this.fetchStatus();
				} catch (e) {
					console.error("[easytier] save error:", e);
				} finally {
					this.saving = false;
					this.store.set(this.projection());
				}
			}

			inject() {
				return {
					hooks: { easyTierCard: this.store },
					setEnabled: (val) => this.setEnabled(val),
					setNetworkName: (val) => this.setNetworkName(val),
					setNetworkSecret: (val) => this.setNetworkSecret(val),
					setIpv4: (val) => this.setIpv4(val),
					setPeers: (val) => this.setPeers(val),
					setNoTun: (val) => this.setNoTun(val),
					save: () => this.save(),
					discard: () => this.discard(),
					reset: () => this.reset()
				};
			}
		}

		const inject = [
			"slots",
			"locale",
			"settingsScope"
		];

		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "easytier: locales");

			const scope = ctx.settingsScope ? ctx.settingsScope.bind({ namespace: NS }) : null;
			const controller = new EasyTierController(scope);

			ctx.slots.inject("settings.plugin.item", function* () {
				yield ctx.slots.register({
					name: "settings.plugin.item",
					key: NS,
					locale: NS,
					inject: () => controller.inject()
				}, EasyTierCard);
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	};

	const ids = [
		"dsh-easytier",
		"./plugins/dsh-easytier",
		"plugins/dsh-easytier",
		"./plugins/dsh-easytier/lib/index.js",
		"plugins/dsh-easytier/lib/index.js"
	];

	if (typeof window !== "undefined" && window.__ModuleLoader__) {
		for (const id of ids) {
			try {
				window.__ModuleLoader__.load({ id, factory });
			} catch (e) {}
		}
	}
})();
