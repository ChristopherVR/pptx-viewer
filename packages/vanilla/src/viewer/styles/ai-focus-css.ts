/**
 * Round-3 AI styles: the focused-target bar (chips + pick / merge / pin
 * controls), the pick-mode banner, the on-canvas focus/tool highlight rings and
 * their pulse animation, the "AI is active" colour-tween hook, the click-to-ask
 * context menu, and the settings-dialog AI export section. Split out of
 * `ai-css.ts` to keep each stylesheet under the file-size budget. Colours
 * resolve from the shared `--pptx-*` theme tokens; scoped under `.pptxv`.
 */
export const AI_FOCUS_CSS = `
/* ── Focused-target bar ───────────────────────────────────────────────── */
.pptxv-ai-focus {
	flex: none;
	border-bottom: 1px solid var(--pptx-border);
	background: color-mix(in srgb, var(--pptx-secondary) 30%, transparent);
}
.pptxv-ai-focus-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 6px 10px; }
.pptxv-ai-focus-label {
	font-size: 0.625rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--pptx-muted-foreground);
}
.pptxv-ai-focus-chip {
	max-width: 10rem;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	padding: 1px 8px;
	border-radius: 999px;
	font-size: 0.6875rem;
	background: var(--pptx-muted);
	color: var(--pptx-muted-foreground);
}
.pptxv-ai-focus-chip.is-strong {
	background: color-mix(in srgb, var(--pptx-primary) 15%, transparent);
	color: var(--pptx-primary);
}
.pptxv-ai-focus-pinned {
	padding: 1px 6px;
	border-radius: 999px;
	font-size: 0.625rem;
	font-weight: 600;
	background: color-mix(in srgb, var(--pptx-primary) 15%, transparent);
	color: var(--pptx-primary);
}
.pptxv-ai-focus-actions { margin-left: auto; display: inline-flex; align-items: center; gap: 2px; }
.pptxv-ai-focus-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 4px;
	border: none;
	border-radius: 6px;
	background: transparent;
	color: var(--pptx-muted-foreground);
	cursor: pointer;
}
.pptxv-ai-focus-btn svg { width: 14px; height: 14px; }
.pptxv-ai-focus-btn:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-ai-focus-btn.is-active { background: var(--pptx-primary); color: var(--pptx-primary-foreground); }
.pptxv-ai-focus-merge {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 3px 8px;
	border: none;
	border-radius: 6px;
	background: var(--pptx-primary);
	color: var(--pptx-primary-foreground);
	font: inherit;
	font-size: 0.6875rem;
	font-weight: 600;
	cursor: pointer;
}
.pptxv-ai-focus-merge svg { width: 12px; height: 12px; }

/* ── Pick-mode banner ─────────────────────────────────────────────────── */
.pptxv-ai-focus-pick {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 5px 10px;
	border-top: 1px solid color-mix(in srgb, var(--pptx-primary) 25%, transparent);
	background: color-mix(in srgb, var(--pptx-primary) 6%, transparent);
}
.pptxv-ai-focus-pick-icon { width: 14px; height: 14px; color: var(--pptx-primary); animation: pptxv-ai-pulse 1s ease-in-out infinite; }
.pptxv-ai-focus-pick-hint { font-size: 0.6875rem; font-weight: 600; color: var(--pptx-primary); }
.pptxv-ai-focus-pick-done {
	margin-left: auto;
	padding: 3px 10px;
	border: none;
	border-radius: 6px;
	background: var(--pptx-primary);
	color: var(--pptx-primary-foreground);
	font: inherit;
	font-size: 0.6875rem;
	font-weight: 600;
	cursor: pointer;
}

/* ── On-canvas focus / tool highlight rings ───────────────────────────── */
.pptxv-ai-hl-layer { position: absolute; inset: 0; pointer-events: none; z-index: 40; }
.pptxv-ai-hl {
	position: absolute;
	border-radius: 3px;
	box-sizing: border-box;
	border: 2px solid color-mix(in srgb, #3b82f6 55%, transparent);
	box-shadow: 0 0 10px 2px color-mix(in srgb, #3b82f6 18%, transparent);
	animation: pptxv-ai-ring-in 0.9s ease-out;
}
.pptxv-ai-hl-active {
	border-color: color-mix(in srgb, #3b82f6 90%, transparent);
	box-shadow: none;
	animation: pptxv-ai-ring-in 0.18s ease-out, pptxv-ai-ring-pulse 1s ease-out infinite;
}
@keyframes pptxv-ai-ring-in {
	0% { opacity: 0; transform: scale(1.04); }
	100% { opacity: 1; transform: scale(1); }
}
@keyframes pptxv-ai-ring-pulse {
	0% { box-shadow: 0 0 0 0 rgb(59 130 246 / 0.55); }
	70% { box-shadow: 0 0 0 6px rgb(59 130 246 / 0), 0 0 14px 4px rgb(59 130 246 / 0.28); }
	100% { box-shadow: 0 0 0 0 rgb(59 130 246 / 0), 0 0 10px 2px rgb(59 130 246 / 0.22); }
}

/* While the AI is active, tween colour changes on slide elements so an edit
   fades from its old value to the new one instead of snapping. */
.pptxv-stage[data-pptx-ai-active='true'] [data-element-id],
.pptxv-stage[data-pptx-ai-active='true'] [data-element-id] * {
	transition: color 0.5s ease, fill 0.5s ease, stroke 0.5s ease, background-color 0.5s ease,
		border-color 0.5s ease;
}

/* ── Click-to-ask context menu ────────────────────────────────────────── */
.pptxv-ai-menu {
	position: fixed;
	z-index: 60;
	min-width: 180px;
	padding: 4px;
	border: 1px solid var(--pptx-border);
	border-radius: 8px;
	background: var(--pptx-popover, var(--pptx-card));
	color: var(--pptx-popover-foreground, var(--pptx-card-foreground));
	box-shadow: 0 8px 24px rgb(0 0 0 / 0.24);
}
.pptxv-ai-menu-item {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	padding: 7px 10px;
	border: none;
	border-radius: 6px;
	background: transparent;
	color: inherit;
	font: inherit;
	font-size: 0.8125rem;
	text-align: left;
	cursor: pointer;
}
.pptxv-ai-menu-item svg { width: 14px; height: 14px; color: var(--pptx-primary); }
.pptxv-ai-menu-item:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }

/* ── Settings-dialog AI export section ────────────────────────────────── */
.pptxv-ai-settings { display: flex; flex-direction: column; gap: 12px; }
.pptxv-ai-settings-intro {
	display: flex;
	gap: 8px;
	padding: 10px;
	border: 1px solid var(--pptx-border);
	border-radius: 8px;
	background: color-mix(in srgb, var(--pptx-muted) 40%, transparent);
}
.pptxv-ai-settings-intro svg { width: 16px; height: 16px; flex: none; color: var(--pptx-primary); }
.pptxv-ai-settings-count { font-size: 0.75rem; color: var(--pptx-muted-foreground); }
.pptxv-ai-settings-detailed { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; }
.pptxv-ai-settings-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.pptxv-ai-settings-btn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 12px;
	border: 1px solid var(--pptx-border);
	border-radius: 6px;
	background: var(--pptx-card);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 0.75rem;
	cursor: pointer;
}
.pptxv-ai-settings-btn svg { width: 13px; height: 13px; }
.pptxv-ai-settings-btn:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-ai-settings-btn:disabled { opacity: 0.5; cursor: default; }
.pptxv-ai-settings-status { font-size: 0.75rem; color: var(--pptx-muted-foreground); }
`;
