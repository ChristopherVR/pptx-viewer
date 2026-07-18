/**
 * Styles for the inspector's docked per-element Animation panel and the
 * Comments tab's threaded replies / edit-in-place forms (React's
 * `AnimationPanel` + `InspectorCommentRow` counterparts).
 */
export const INSPECTOR_PANELS_CSS = `
/* ── Docked Animation panel ──────────────────────────────────────────── */
.pptxv-inspector-animation {
	display: grid;
	gap: 6px;
	flex: none;
	padding: 8px 10px;
	border-top: 1px solid var(--pptx-border);
	max-height: 40%;
	overflow-y: auto;
	font-size: 11px;
}
.pptxv-inspector-animation[hidden] { display: none; }
.pptxv-anim-header { display: flex; align-items: center; justify-content: space-between; }
.pptxv-anim-preview-btn {
	padding: 2px 6px;
	border: none;
	border-radius: var(--pptx-radius);
	background: transparent;
	color: var(--pptx-primary);
	font-size: 10px;
	cursor: pointer;
}
.pptxv-anim-preview-btn:hover { background: var(--pptx-accent); }
.pptxv-anim-field { display: grid; gap: 2px; font-size: 11px; }
.pptxv-anim-field > span { color: var(--pptx-muted-foreground); }
.pptxv-anim-field :is(select, input) {
	min-width: 0;
	width: 100%;
	padding: 3px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-muted);
	color: var(--pptx-foreground);
}
.pptxv-anim-options { display: grid; gap: 6px; }
.pptxv-anim-options[hidden] { display: none; }
.pptxv-anim-direction { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.pptxv-anim-direction > span { flex-basis: 100%; }
.pptxv-anim-direction-btn {
	padding: 3px 6px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-muted);
	color: var(--pptx-muted-foreground);
	font-size: 10px;
	cursor: pointer;
}
.pptxv-anim-direction-btn:hover:not(:disabled) { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-anim-direction-btn.is-active {
	border-color: var(--pptx-primary);
	background: color-mix(in srgb, var(--pptx-primary) 20%, transparent);
	color: var(--pptx-primary);
}
.pptxv-anim-timeline { display: grid; gap: 4px; }
.pptxv-anim-timeline[hidden] { display: none; }
.pptxv-anim-bar {
	position: relative;
	height: 22px;
	overflow: hidden;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: color-mix(in srgb, var(--pptx-muted) 50%, transparent);
}
.pptxv-anim-bar-seg { position: absolute; top: 2px; bottom: 2px; border-radius: 2px; }
.pptxv-anim-bar-seg.is-entrance { background: rgb(34 197 94 / 0.6); }
.pptxv-anim-bar-seg.is-emphasis { background: rgb(234 179 8 / 0.6); }
.pptxv-anim-bar-seg.is-exit { background: rgb(239 68 68 / 0.6); }
.pptxv-anim-bar-seg.is-none { background: color-mix(in srgb, var(--pptx-muted-foreground) 40%, transparent); }
.pptxv-anim-bar-seg.is-selected { outline: 1px solid var(--pptx-ring); }

/* ── Comments tab: threads, replies, edit-in-place ───────────────────── */
.pptxv-inspector-comment-badge {
	margin-left: 6px;
	padding: 1px 6px;
	border-radius: 999px;
	background: rgb(34 197 94 / 0.25);
	color: rgb(34 197 94);
	font-size: 9px;
	font-weight: 500;
}
.pptxv-inspector-comment.is-reply {
	border-bottom: none;
	padding: 4px 0 4px 8px;
	border-left: 2px solid color-mix(in srgb, var(--pptx-primary) 40%, transparent);
}
.pptxv-inspector-comment-replies { margin-top: 4px; display: grid; gap: 2px; }
.pptxv-inspector-comment-replies-toggle {
	margin-top: 4px;
	padding: 0;
	border: none;
	background: transparent;
	color: var(--pptx-muted-foreground);
	font-size: 10px;
	text-align: left;
	cursor: pointer;
}
.pptxv-inspector-comment-replies-toggle:hover { color: var(--pptx-foreground); }
.pptxv-inspector-comment-edit,
.pptxv-inspector-comment-reply-form { display: grid; gap: 4px; margin-top: 4px; }
.pptxv-inspector-comment-reply-form {
	padding-left: 8px;
	border-left: 2px solid color-mix(in srgb, var(--pptx-primary) 40%, transparent);
}
`;
