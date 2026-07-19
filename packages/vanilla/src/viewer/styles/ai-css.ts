/**
 * Styles for the AI assistant: the title-bar toggle, the right-side chat panel,
 * transcript bubbles, tool-call cards, staged-proposal review cards, and the
 * composer. All colours resolve from the shared `--pptx-*` theme custom
 * properties so the panel tracks the viewer theme (light / dark / branded) with
 * no per-instance styling. Scoped under the `.pptxv` root like the rest of the
 * chrome.
 */
export const AI_CSS = `
.pptxv-ai-toggle.is-active { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-ai-toggle-floating {
	position: absolute;
	top: 8px;
	right: 8px;
	z-index: 12;
	background: var(--pptx-card);
	border: 1px solid var(--pptx-border);
	box-shadow: 0 1px 3px rgb(0 0 0 / 0.18);
}

/* ── Panel shell (sibling of the inspector inside .pptxv-body) ─────────── */
.pptxv-ai-panel {
	display: flex;
	flex-direction: column;
	flex: none;
	width: 320px;
	min-height: 0;
	border-left: 1px solid var(--pptx-border);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
}
.pptxv-ai-panel[hidden] { display: none; }
.pptxv-ai-panel.is-loading { opacity: 0.7; }

.pptxv-ai-header {
	display: flex;
	align-items: center;
	gap: 6px;
	flex: none;
	padding: 8px 12px;
	border-bottom: 1px solid var(--pptx-border);
	font-weight: 600;
}
.pptxv-ai-header svg { width: 16px; height: 16px; color: var(--pptx-primary); }

/* ── Transcript ───────────────────────────────────────────────────────── */
.pptxv-ai-messages {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	padding: 10px 12px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.pptxv-ai-empty {
	margin: auto;
	padding: 12px;
	color: var(--pptx-muted-foreground);
	font-size: 0.8125rem;
	text-align: center;
}
.pptxv-ai-msg { display: flex; gap: 8px; max-width: 100%; }
.pptxv-ai-msg-avatar {
	flex: none;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	margin-top: 2px;
	border-radius: 50%;
	background: color-mix(in srgb, var(--pptx-primary) 15%, transparent);
	color: var(--pptx-primary);
}
.pptxv-ai-msg-avatar svg { width: 14px; height: 14px; }
.pptxv-ai-msg-user .pptxv-ai-msg-avatar {
	background: var(--pptx-secondary);
	color: var(--pptx-muted-foreground);
}
.pptxv-ai-msg-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1; }
.pptxv-ai-msg-text {
	font-size: 0.8125rem;
	line-height: 1.5;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
	color: var(--pptx-foreground);
}
.pptxv-ai-msg-user .pptxv-ai-msg-text {
	align-self: flex-start;
	padding: 7px 10px;
	border-radius: 10px;
	border-bottom-left-radius: 3px;
	background: var(--pptx-primary);
	color: var(--pptx-primary-foreground);
}

/* ── Friendly tool-call activity cards ────────────────────────────────── */
.pptxv-ai-tool { font-size: 0.75rem; }
.pptxv-ai-tool-head { display: flex; align-items: center; gap: 6px; }
.pptxv-ai-tool-icon {
	flex: none;
	width: 14px;
	height: 14px;
	color: var(--pptx-muted-foreground);
}
.pptxv-ai-tool-name { min-width: 0; overflow-wrap: anywhere; color: var(--pptx-foreground); }
.pptxv-ai-tool-state {
	margin-left: auto;
	display: inline-flex;
	align-items: center;
	gap: 3px;
	flex: none;
	padding: 1px 6px;
	border-radius: 4px;
	font-size: 0.625rem;
	background: var(--pptx-muted);
	color: var(--pptx-muted-foreground);
}
.pptxv-ai-tool-state svg { width: 11px; height: 11px; }
.pptxv-ai-tool-state.is-done {
	background: color-mix(in srgb, var(--pptx-primary) 12%, transparent);
	color: var(--pptx-primary);
}
.pptxv-ai-tool-state.is-error {
	background: color-mix(in srgb, var(--pptx-destructive) 15%, transparent);
	color: var(--pptx-destructive);
}
.pptxv-ai-tool-state.is-running::before {
	content: '';
	width: 7px;
	height: 7px;
	border-radius: 50%;
	background: currentColor;
	animation: pptxv-ai-pulse 1s ease-in-out infinite;
}
@keyframes pptxv-ai-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
.pptxv-ai-tool-error { margin: 2px 0 0 20px; font-size: 0.6875rem; color: var(--pptx-destructive); }
.pptxv-ai-tool-details { margin: 2px 0 0 20px; }
.pptxv-ai-tool-details summary {
	cursor: pointer;
	list-style: none;
	font-size: 0.625rem;
	color: var(--pptx-muted-foreground);
}
.pptxv-ai-tool-details summary::-webkit-details-marker { display: none; }
.pptxv-ai-tool-details summary:hover { color: var(--pptx-foreground); }
.pptxv-ai-tool-raw {
	margin-top: 2px;
	font-family: ui-monospace, monospace;
	font-size: 0.625rem;
	color: var(--pptx-muted-foreground);
	overflow-wrap: anywhere;
}

/* ── Staged-proposal review ───────────────────────────────────────────── */
.pptxv-ai-proposals {
	flex: none;
	max-height: 40%;
	overflow-y: auto;
	padding: 8px 12px;
	border-top: 1px solid var(--pptx-border);
	background: color-mix(in srgb, var(--pptx-secondary) 30%, transparent);
}
.pptxv-ai-proposals[hidden] { display: none; }
.pptxv-ai-proposals-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 6px;
}
.pptxv-ai-proposals-title { font-size: 0.75rem; font-weight: 700; }
.pptxv-ai-proposal {
	margin-bottom: 8px;
	padding: 8px;
	border: 1px solid var(--pptx-border);
	border-radius: 8px;
	background: var(--pptx-card);
}
.pptxv-ai-proposal-eyebrow {
	margin-bottom: 3px;
	font-size: 0.625rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--pptx-primary);
}
.pptxv-ai-proposal-label { font-size: 0.8125rem; font-weight: 600; }
.pptxv-ai-proposal-btn { display: inline-flex; align-items: center; gap: 4px; }
.pptxv-ai-proposal-btn svg { width: 13px; height: 13px; }
.pptxv-ai-proposal-summary {
	margin: 5px 0 8px;
	padding-left: 16px;
	color: var(--pptx-muted-foreground);
	font-size: 0.75rem;
	line-height: 1.4;
}
.pptxv-ai-proposal-actions { display: flex; gap: 6px; }
.pptxv-ai-proposal-btn {
	padding: 4px 12px;
	border: 1px solid var(--pptx-border);
	border-radius: 6px;
	background: var(--pptx-card);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 0.75rem;
	cursor: pointer;
}
.pptxv-ai-proposal-btn:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-ai-proposal-btn.is-accept, .pptxv-ai-proposal-btn.is-accept-all {
	border-color: var(--pptx-primary);
	background: var(--pptx-primary);
	color: var(--pptx-primary-foreground);
}
.pptxv-ai-proposal-btn:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: 1px; }

/* ── Error line + composer ────────────────────────────────────────────── */
.pptxv-ai-error {
	flex: none;
	padding: 6px 12px;
	color: var(--pptx-destructive);
	font-size: 0.75rem;
}
.pptxv-ai-error[hidden] { display: none; }
.pptxv-ai-composer {
	display: flex;
	align-items: flex-end;
	gap: 6px;
	flex: none;
	padding: 8px 12px;
	border-top: 1px solid var(--pptx-border);
}
.pptxv-ai-input {
	flex: 1;
	min-width: 0;
	max-height: 120px;
	padding: 7px 9px;
	border: 1px solid var(--pptx-border);
	border-radius: 8px;
	background: var(--pptx-muted);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 0.8125rem;
	line-height: 1.4;
	resize: vertical;
}
.pptxv-ai-input:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: -1px; }
.pptxv-ai-send {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: none;
	width: 34px;
	height: 34px;
	border: none;
	border-radius: 8px;
	background: var(--pptx-primary);
	color: var(--pptx-primary-foreground);
	cursor: pointer;
}
.pptxv-ai-send svg { width: 16px; height: 16px; }
.pptxv-ai-send:disabled { opacity: 0.5; cursor: default; }
.pptxv-ai-panel.is-busy .pptxv-ai-send { background: var(--pptx-destructive); }

@media (max-width: 1023px) {
	.pptxv-ai-panel {
		position: absolute;
		inset: 0 0 0 auto;
		width: min(360px, 100%);
		z-index: 14;
		box-shadow: -4px 0 16px rgb(0 0 0 / 0.24);
	}
}
`;
