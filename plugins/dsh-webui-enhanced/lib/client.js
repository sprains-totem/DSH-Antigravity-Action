window.__ModuleLoader__.load({
	id: "dsh-webui-enhanced",
	factory: (require) => {
		var module = { exports: {} };
		module.exports.inject = [
			"slots",
			"sessions",
			"uiSession",
			"uiConversation",
			"layout",
			"locale",
			"settingsScope"
		];

		const React = require("react");
		const ReactDOM = require("react-dom");
		const jsx = require("react/jsx-runtime");

		// 1. Inject Styles
		const CSS_ID = "dsh-webui-enhanced-styles";
		if (typeof document !== "undefined" && !document.getElementById(CSS_ID)) {
			const style = document.createElement("style");
			style.id = CSS_ID;
			style.textContent = `
/* Upload Subcards Header in Menu */
.dsh-upload-subcards-wrapper {
	width: 100%;
	display: flex;
	flex-direction: column;
	background: inherit;
	border-top-left-radius: inherit;
	border-top-right-radius: inherit;
}
.dsh-upload-subcards-header {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px;
	padding: 10px 10px 6px 10px;
	box-sizing: border-box;
	width: 100%;
}
.dsh-upload-card {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 10px;
	background: var(--dsw-alias-layer-l2, rgba(255, 255, 255, 0.05));
	border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
	border-radius: 8px;
	cursor: pointer;
	text-align: left;
	font-family: inherit;
	color: var(--dsw-alias-label-primary, #e6e6e6);
	transition: all 0.15s ease-in-out;
}
.dsh-upload-card:hover {
	background: var(--dsw-alias-layer-l3, rgba(255, 255, 255, 0.1));
	border-color: var(--dsw-alias-border-focus, #3b82f6);
	transform: translateY(-1px);
}
.dsh-upload-card-icon {
	flex: none;
	width: 28px;
	height: 28px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 6px;
	background: var(--dsw-alias-layer-l1, rgba(255, 255, 255, 0.08));
	color: var(--dsw-alias-state-business-primary, #60a5fa);
}
.dsh-upload-card-file .dsh-upload-card-icon {
	color: var(--dsw-alias-state-success-primary, #34d399);
}
.dsh-upload-card-info {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 1px;
}
.dsh-upload-card-title {
	font-size: 13px;
	font-weight: 500;
	line-height: 18px;
	color: var(--dsw-alias-label-primary, #f3f4f6);
}
.dsh-upload-card-desc {
	font-size: 11px;
	line-height: 14px;
	color: var(--dsw-alias-label-tertiary, #9ca3af);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.dsh-upload-subcards-divider {
	height: 1px;
	margin: 4px 10px 6px 10px;
	background: var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.08));
}

/* Intermediate Process Folding */
.dsh-intermediate-summary-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 8px 0;
	padding: 8px 12px;
	background: var(--dsw-alias-layer-l2, rgba(255, 255, 255, 0.04));
	border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.08));
	border-radius: 8px;
	cursor: pointer;
	user-select: none;
	transition: all 0.15s ease;
	font-size: 12px;
	color: var(--dsw-alias-label-secondary, #a1a1aa);
}
.dsh-intermediate-summary-bar:hover {
	background: var(--dsw-alias-layer-l3, rgba(255, 255, 255, 0.08));
	border-color: var(--dsw-alias-border-focus, rgba(255, 255, 255, 0.16));
}
.dsh-intermediate-left {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
	flex: 1;
}
.dsh-intermediate-icon {
	display: flex;
	align-items: center;
	color: var(--dsw-alias-state-success-primary, #10b981);
}
.dsh-intermediate-text {
	font-weight: 500;
	color: var(--dsw-alias-label-primary, #e4e4e7);
}
.dsh-intermediate-tokens {
	color: var(--dsw-alias-label-tertiary, #71717a);
	font-size: 11px;
	margin-left: 4px;
}
.dsh-intermediate-right {
	display: flex;
	align-items: center;
	gap: 4px;
	flex: none;
	font-size: 11px;
	color: var(--dsw-alias-label-tertiary, #71717a);
}
.dsh-intermediate-chevron {
	display: flex;
	align-items: center;
	transition: transform 0.2s ease;
}
.dsh-intermediate-chevron.expanded {
	transform: rotate(180deg);
}

/* Collapsed intermediate nodes */
[data-dsh-intermediate-hidden="true"] {
	display: none !important;
}
`;
			document.head.appendChild(style);
		}

		module.exports.apply = function apply(ctx) {
			console.log("[dsh-webui-enhanced] plugin initialized");

			// 2. Settings state for showing intermediate tokens
			let showTokensSetting = true;
			try {
				const saved = localStorage.getItem("dsh_show_intermediate_tokens");
				if (saved !== null) showTokensSetting = saved === "true";
			} catch {}

			// 3. Upload Overlay Integration (Optimization 2)
			function UploadOverlay(props) {
				const imageInputRef = React.useRef(null);
				const fileInputRef = React.useRef(null);
				const [menuContainer, setMenuContainer] = React.useState(null);

				React.useEffect(() => {
					const checkMenu = () => {
						const anchor = document.querySelector('[class*="overlayAnchor"]');
						if (!anchor) {
							if (menuContainer) setMenuContainer(null);
							return;
						}
						const menu = anchor.querySelector('[data-trigger-menu], [role="listbox"], [class*="MenuView_menu"]');
						if (menu) {
							let topAnchor = menu.querySelector('.dsh-upload-portal-anchor');
							if (!topAnchor) {
								topAnchor = document.createElement('div');
								topAnchor.className = 'dsh-upload-portal-anchor';
								menu.prepend(topAnchor);
							}
							if (topAnchor !== menuContainer) setMenuContainer(topAnchor);
						} else if (menuContainer) {
							setMenuContainer(null);
						}
					};

					checkMenu();
					const observer = new MutationObserver(checkMenu);
					observer.observe(document.body, { childList: true, subtree: true });
					return () => observer.disconnect();
				}, [menuContainer]);

				const onImageSelected = (e) => {
					const files = Array.from(e.target.files || []);
					if (files.length > 0) {
						const dt = new DataTransfer();
						for (const f of files) dt.items.add(f);
						document.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
					}
					e.target.value = "";
					dismissMenu();
				};

				const onFileSelected = async (e) => {
					const files = Array.from(e.target.files || []);
					const mediaFiles = [];
					const textFiles = [];
					for (const f of files) {
						const ext = (f.name.split('.').pop() || '').toLowerCase();
						const isMedia = f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/') ||
						                ['png','jpg','jpeg','webp','gif','heic','heif','mp4','webm','mov','avi','mkv','mp3','wav','m4a','aac','pdf'].includes(ext);
						if (isMedia) mediaFiles.push(f);
						else textFiles.push(f);
					}
					if (mediaFiles.length > 0) {
						const dt = new DataTransfer();
						for (const f of mediaFiles) dt.items.add(f);
						document.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
					}
					if (textFiles.length > 0) {
						for (const tf of textFiles) {
							try {
								const text = await tf.text();
								const ext = tf.name.split('.').pop() || 'text';
								const snippet = "\n\n```" + ext + ":" + tf.name + "\n" + text + "\n```\n";
								const editor = document.querySelector('[data-composer-card] [contenteditable="true"]');
								if (editor) {
									editor.focus();
									document.execCommand("insertText", false, snippet);
								}
							} catch (err) {
								console.error("[dsh-webui-enhanced] failed to read text file:", err);
							}
						}
					}
					e.target.value = "";
					dismissMenu();
				};

				const dismissMenu = () => {
					const plusBtn = document.querySelector('button[aria-haspopup="listbox"][aria-expanded="true"]');
					if (plusBtn) plusBtn.click();
				};

				const headerNode = jsx.jsxs("div", {
					className: "dsh-upload-subcards-wrapper",
					children: [
						jsx.jsxs("div", {
							className: "dsh-upload-subcards-header",
							children: [
								jsx.jsxs("button", {
									type: "button",
									className: "dsh-upload-card dsh-upload-card-image",
									onClick: (e) => {
										e.stopPropagation();
										imageInputRef.current?.click();
									},
									title: "上传图片或照片（支持桌面端与移动端相册/拍照）",
									children: [
										jsx.jsx("div", {
											className: "dsh-upload-card-icon",
											children: jsx.jsxs("svg", {
												viewBox: "0 0 24 24",
												width: "18",
												height: "18",
												fill: "none",
												stroke: "currentColor",
												strokeWidth: "2",
												children: [
													jsx.jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "4" }),
													jsx.jsx("circle", { cx: "8.5", cy: "8.5", r: "1.5", fill: "currentColor" }),
													jsx.jsx("path", { d: "M21 15l-5-5L5 21" })
												]
											})
										}),
										jsx.jsxs("div", {
											className: "dsh-upload-card-info",
											children: [
												jsx.jsx("div", { className: "dsh-upload-card-title", children: "上传图片" }),
												jsx.jsx("div", { className: "dsh-upload-card-desc", children: "JPG、PNG、相册/拍照" })
											]
										})
									]
								}),
								jsx.jsxs("button", {
									type: "button",
									className: "dsh-upload-card dsh-upload-card-file",
									onClick: (e) => {
										e.stopPropagation();
										fileInputRef.current?.click();
									},
									title: "上传文档、代码、音视频或PDF等任意文件",
									children: [
										jsx.jsx("div", {
											className: "dsh-upload-card-icon",
											children: jsx.jsxs("svg", {
												viewBox: "0 0 24 24",
												width: "18",
												height: "18",
												fill: "none",
												stroke: "currentColor",
												strokeWidth: "2",
												children: [
													jsx.jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
													jsx.jsx("polyline", { points: "14 2 14 8 20 8" }),
													jsx.jsx("line", { x1: "16", y1: "13", x2: "8", y2: "13" }),
													jsx.jsx("line", { x1: "16", y1: "17", x2: "8", y2: "17" }),
													jsx.jsx("polyline", { points: "10 9 9 9 8 9" })
												]
											})
										}),
										jsx.jsxs("div", {
											className: "dsh-upload-card-info",
											children: [
												jsx.jsx("div", { className: "dsh-upload-card-title", children: "上传文件" }),
												jsx.jsx("div", { className: "dsh-upload-card-desc", children: "PDF、代码、音视频、文档" })
											]
										})
									]
								})
							]
						}),
						jsx.jsx("div", { className: "dsh-upload-subcards-divider" })
					]
				});

				return jsx.jsxs("div", {
					className: "dsh-upload-overlay-root",
					style: { display: "contents" },
					children: [
						jsx.jsx("input", {
							type: "file",
							ref: imageInputRef,
							accept: "image/*",
							multiple: true,
							style: { display: "none" },
							onChange: onImageSelected
						}),
						jsx.jsx("input", {
							type: "file",
							ref: fileInputRef,
							accept: "*/*",
							multiple: true,
							style: { display: "none" },
							onChange: onFileSelected
						}),
						menuContainer ? ReactDOM.createPortal(headerNode, menuContainer) : null
					]
				});
			}

			ctx.slots.inject("conversation.input.overlay", () => {
				return ctx.slots.register({
					name: "conversation.input.overlay",
					id: "dsh-upload-subcards",
					order: -10,
					inject: (sessionId) => ({ sessionId })
				}, UploadOverlay);
			});

			// 4. Thinking & Tool Calls Folding Controller (Optimization 1)
			let foldState = new Map(); // turnKey -> boolean (true = expanded, false = folded)

			function formatDuration(ms) {
				const s = Math.round(ms / 1000);
				if (s < 60) return `${s}s`;
				const m = Math.floor(s / 60);
				const remS = s % 60;
				return `${m}m${remS}s`;
			}

			function formatTokens(val) {
				if (val < 1000) return String(val);
				if (val < 1000000) return `${(val / 1000).toFixed(1)}K`;
				return `${(val / 1000000).toFixed(1)}M`;
			}

			function updateFlowFolding() {
				const flow = document.querySelector('[data-chat-flow]');
				if (!flow) return;

				// Fetch chat snapshot for accurate stats
				const currentSessionId = ctx.sessions?.list?.getSnapshot?.()?.current;
				let chatSnap = null;
				if (currentSessionId) {
					const binding = ctx.sessions.binding(currentSessionId);
					if (binding) {
						chatSnap = ctx.uiConversation?.binding?.(binding)?.target?.("chat")?.getSnapshot?.();
					}
				}

				// Group nodes by turn
				const flowItems = Array.from(flow.children).filter(el => el.hasAttribute('data-chat-flow-key'));
				if (flowItems.length === 0) return;

				const turns = [];
				let currentTurn = { userEl: null, items: [], turnId: 0 };

				flowItems.forEach((el) => {
					const kind = el.getAttribute('data-chat-flow-kind');
					const turnAttr = el.getAttribute('data-chat-turn');
					if (kind === 'user' || kind === 'steering') {
						if (currentTurn.userEl || currentTurn.items.length > 0) {
							turns.push(currentTurn);
						}
						currentTurn = { userEl: el, items: [], turnId: turnAttr || turns.length };
					} else {
						currentTurn.items.push(el);
					}
				});
				if (currentTurn.userEl || currentTurn.items.length > 0) {
					turns.push(currentTurn);
				}

				// Process each turn
				turns.forEach((turn, idx) => {
					const isLast = idx === turns.length - 1;
					// Check if running
					const runningIndicator = document.querySelector('[role="status"], [class*="turnStatus"]');
					const isRunning = isLast && !!runningIndicator;

					// If running: keep everything expanded in real time
					if (isRunning) {
						turn.items.forEach(item => item.removeAttribute('data-dsh-intermediate-hidden'));
						const existingBar = flow.querySelector(`[data-dsh-summary-turn="${turn.turnId}"]`);
						if (existingBar) existingBar.remove();
						return;
					}

					// Find last assistant response node
					let lastAssistantIdx = -1;
					for (let i = turn.items.length - 1; i >= 0; i--) {
						const it = turn.items[i];
						if (it.getAttribute('data-chat-flow-kind') === 'assistant-step') {
							const hasText = it.querySelector('[class*="MarkdownText"], [class*="markdown"], p');
							if (hasText) {
								lastAssistantIdx = i;
								break;
							}
						}
					}

					if (lastAssistantIdx > 0) {
						const intermediateItems = turn.items.slice(0, lastAssistantIdx);
						const turnKey = `turn-${turn.turnId}`;
						const isExpanded = foldState.get(turnKey) === true;

						// Apply visibility
						intermediateItems.forEach(item => {
							if (isExpanded) {
								item.removeAttribute('data-dsh-intermediate-hidden');
							} else {
								item.setAttribute('data-dsh-intermediate-hidden', 'true');
							}
						});

						// Calculate stats from chat snapshot or DOM
						let thinkCount = 0;
						let toolCount = 0;
						let inTokens = 0;
						let outTokens = 0;
						let cacheTokens = 0;
						let cacheWriteTokens = 0;
						let startTime = null;
						let endTime = null;

						intermediateItems.forEach(item => {
							const key = item.getAttribute('data-chat-flow-key');
							const node = chatSnap?.nodes?.get?.(key);
							const kind = node?.kind || item.getAttribute('data-chat-flow-kind');

							if (kind === 'tool-call') toolCount++;
							if (kind === 'assistant-step') {
								const blocks = node?.data?.blocks ?? [];
								const hasReasoning = blocks.some(b => b && b.kind === "reasoning") ||
								                     item.querySelector('[class*="ReasoningRow"], [class*="reasoning"], [data-reasoning]');
								if (hasReasoning) thinkCount++;

								const usage = node?.data?.usage ?? node?.data?.finalNode?.usage;
								if (usage && typeof usage === "object") {
									inTokens += (usage.uncachedInputTokens ?? usage.inputTokens ?? usage.promptTokens ?? 0);
									outTokens += (usage.outputTokens ?? usage.completionTokens ?? 0);
									cacheTokens += (usage.cacheReadTokens ?? usage.cachedTokens ?? 0);
									cacheWriteTokens += (usage.cacheWriteTokens ?? 0);
								}
							}

							const tm = node?.time ?? node?.data?.time ?? node?.data?.finalNode?.time;
							if (typeof tm === "number") {
								if (startTime === null || tm < startTime) startTime = tm;
								if (endTime === null || tm > endTime) endTime = tm;
							}
						});

						const durationMs = (startTime !== null && endTime !== null && endTime >= startTime) ? (endTime - startTime) : 0;
						const totalIn = inTokens + cacheTokens + cacheWriteTokens;
						const cacheHitRate = totalIn > 0 ? Math.round((cacheTokens / totalIn) * 100) : null;

						const summaryParts = [];
						if (thinkCount > 0) summaryParts.push(`思考 ${thinkCount} 次`);
						if (toolCount > 0) summaryParts.push(`调用工具 ${toolCount} 次`);
						if (summaryParts.length === 0) summaryParts.push(`中间过程 ${intermediateItems.length} 步`);
						if (durationMs > 0) summaryParts.push(`共用时 ${formatDuration(durationMs)}`);

						let tokensText = "";
						if (showTokensSetting && (totalIn > 0 || outTokens > 0)) {
							const parts = [];
							if (totalIn > 0) parts.push(`输入 ${formatTokens(totalIn)}`);
							if (outTokens > 0) parts.push(`输出 ${formatTokens(outTokens)}`);
							if (cacheTokens > 0) parts.push(`缓存 ${formatTokens(cacheTokens)}`);
							if (cacheHitRate !== null) parts.push(`命中率 ${cacheHitRate}%`);
							tokensText = `(${parts.join(" · ")})`;
						}

						// Ensure summary bar exists
						let summaryBar = flow.querySelector(`[data-dsh-summary-turn="${turn.turnId}"]`);
						if (!summaryBar) {
							summaryBar = document.createElement('div');
							summaryBar.className = 'dsh-intermediate-summary-bar';
							summaryBar.setAttribute('data-dsh-summary-turn', String(turn.turnId));
							summaryBar.setAttribute('role', 'button');
							summaryBar.setAttribute('tabindex', '0');
							summaryBar.title = '点击展开/收起中间过程';
							summaryBar.onclick = () => {
								const current = foldState.get(turnKey) === true;
								foldState.set(turnKey, !current);
								updateFlowFolding();
							};
							intermediateItems[0].before(summaryBar);
						}

						summaryBar.innerHTML = `
							<div class="dsh-intermediate-left">
								<span class="dsh-intermediate-icon">
									<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
										<path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z"></path>
										<path d="M5.5 8l2 2 3-3" stroke-linecap="round" stroke-linejoin="round"></path>
									</svg>
								</span>
								<span class="dsh-intermediate-text">${summaryParts.join('，')}</span>
								${tokensText ? `<span class="dsh-intermediate-tokens">${tokensText}</span>` : ''}
							</div>
							<div class="dsh-intermediate-right">
								<span class="dsh-intermediate-action-label">${isExpanded ? '收起' : '展开'}</span>
								<span class="dsh-intermediate-chevron ${isExpanded ? 'expanded' : ''}">
									<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"></path>
									</svg>
								</span>
							</div>
						`;
					}
				});
			}

			// Watch chat flow mutations
			setInterval(updateFlowFolding, 500);
		};

		return module.exports;
	}
});
