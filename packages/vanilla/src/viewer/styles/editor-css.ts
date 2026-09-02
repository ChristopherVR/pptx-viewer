/**
 * Editing-chrome stylesheet fragment: the reusable inspector controls
 * (colour swatches, numeric fields) and the property inspector panel. The
 * ribbon's own styling (tab bar, groups, dropdowns, swatch picker, find &
 * replace) lives in `ribbon-css.ts`. Concatenated after the base chrome CSS
 * by {@link buildViewerCss}. All colours come from the shared `--pptx-*`
 * theme custom properties.
 */
export const EDITOR_CSS = `
.pptxv-marquee { position: absolute; z-index: 4; border: 1px solid var(--pptx-primary); background: color-mix(in srgb, var(--pptx-primary) 14%, transparent); pointer-events: none; }
/* --pptxv-grid-size is set inline on .pptxv-stage from the deck's authored
   viewProperties.gridSpacing (via computeGridSpacingPx); 10px matches this
   binding's existing default when the deck has none. */
.pptxv.pptxv-showGrid .pptxv-stage { background-image: linear-gradient(#cbd5e155 1px, transparent 1px), linear-gradient(90deg, #cbd5e155 1px, transparent 1px); background-size: var(--pptxv-grid-size, 10px) var(--pptxv-grid-size, 10px); }
/* ── View > Rulers ───────────────────────────────────────────────────────
 * The strips are absolutely positioned OUTSIDE the stage wrap (negative
 * offsets), so the slide keeps its exact canvasSize * scale box and the
 * selection overlay (inset: 0 on the same wrap) stays aligned with it. That
 * costs two rules while rulers are on: the wrap must stop clipping (it is
 * overflow: hidden so slide content never bleeds) and must reserve a gutter
 * for the strips to occupy. Scoped to the non-presenting root because rulers
 * are an editing aid and the slide show restores the clip. */
.pptxv.pptxv-showRulers:not(.pptxv-presenting) .pptxv-stage-wrap {
	overflow: visible;
	margin: 20px 0 0 20px;
}
.pptxv-ruler-corner {
	position: absolute;
	top: -20px;
	left: -20px;
	z-index: 7;
	width: 20px;
	height: 20px;
	background: var(--pptx-muted, #f1f5f9);
	border-right: 1px solid var(--pptx-border, #cbd5e1);
	border-bottom: 1px solid var(--pptx-border, #cbd5e1);
}
.pptxv-ruler-corner[hidden] { display: none; }
.pptxv-ruler {
	position: absolute;
	z-index: 7;
	display: block;
	user-select: none;
	touch-action: none;
}
.pptxv-ruler-h { top: -20px; left: 0; }
.pptxv-ruler-v { top: 0; left: -20px; }
.pptxv-ruler-h.is-draggable { cursor: row-resize; }
.pptxv-ruler-v.is-draggable { cursor: col-resize; }
.pptxv-ruler-bg { fill: var(--pptx-muted, #f1f5f9); }
.pptxv-ruler-edge { stroke: var(--pptx-border, #cbd5e1); stroke-width: 1; }
.pptxv-ruler-tick { stroke: var(--pptx-muted-foreground, #94a3b8); }
.pptxv-ruler-highlight { fill: var(--pptx-primary, #2563eb); opacity: 0.2; }
.pptxv-ruler-label { fill: var(--pptx-muted-foreground, #94a3b8); font-family: system-ui, sans-serif; }
.pptxv-alignment-guide { position: absolute; z-index: 6; pointer-events: none; background: #00a6ff; }
.pptxv-alignment-guide.is-h { left: 0; right: 0; height: 1px; }
.pptxv-alignment-guide.is-v { top: 0; bottom: 0; width: 1px; }
/* Draggable + double-click-to-remove (View > Guides, editable + not presenting). */
.pptxv-alignment-guide.is-interactive { pointer-events: auto; }
.pptxv-alignment-guide.is-interactive.is-h { cursor: row-resize; }
.pptxv-alignment-guide.is-interactive.is-v { cursor: col-resize; }
/* Colour swatch control (native <input type=color>, used by the inspector). */
.pptxv-color {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border-radius: var(--pptx-radius);
	cursor: pointer;
}
.pptxv-color:hover { background: var(--pptx-accent); }
.pptxv-color.is-disabled { opacity: 0.4; cursor: default; }
.pptxv-color-input {
	width: 20px;
	height: 20px;
	padding: 0;
	border: 1px solid var(--pptx-border);
	border-radius: 4px;
	background: none;
	cursor: pointer;
}
.pptxv-color-input:disabled { cursor: default; }

/* Numeric field */
.pptxv-field {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font-size: 12px;
	color: var(--pptx-muted-foreground);
}
.pptxv-field-label { white-space: nowrap; }
.pptxv-field-input {
	width: 64px;
	height: 26px;
	padding: 2px 6px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-background);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 12px;
}
.pptxv-field-compact .pptxv-field-input { width: 48px; }
.pptxv-field-input:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: -1px; }
.pptxv-field-input:disabled { opacity: 0.5; }

/* ── Property inspector ──────────────────────────────────────────────── */
.pptxv-inspector {
	flex: none;
	width: 288px;
	overflow-y: auto;
	border-left: 1px solid var(--pptx-border);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	font-size: 12px;
}
.pptxv-inspector[hidden] { display: none; }
/* React-style tab strip: [Elements | Properties | Comments]. */
.pptxv-inspector-tabs {
	display: flex;
	align-items: center;
	gap: 2px;
	padding: 6px 8px;
	border-bottom: 1px solid var(--pptx-border);
}
.pptxv-inspector-tab {
	padding: 4px 8px;
	border: none;
	border-radius: 4px;
	background: var(--pptx-muted);
	color: var(--pptx-muted-foreground);
	font: inherit;
	font-size: 11px;
	cursor: pointer;
}
.pptxv-inspector-tab:hover { color: var(--pptx-foreground); background: var(--pptx-accent); }
.pptxv-inspector-tab.is-active { background: var(--pptx-primary); color: var(--pptx-primary-foreground, #fff); }
/* Elements tab: layer-order rows. */
.pptxv-inspector-layer-list { display: flex; flex-direction: column; gap: 2px; }
.pptxv-inspector-layer-row {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	padding: 4px 8px;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: inherit;
	font: inherit;
	text-align: left;
	cursor: pointer;
}
.pptxv-inspector-layer-row:hover { background: var(--pptx-muted); }
.pptxv-inspector-layer-row.is-selected { background: color-mix(in srgb, var(--pptx-primary) 25%, transparent); color: var(--pptx-primary); }
.pptxv-inspector-layer-num { min-width: 16px; color: var(--pptx-muted-foreground); text-align: right; }
.pptxv-inspector-layer-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* No-selection Properties deck panel + Comments tab. */
.pptxv-inspector-row-value { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; }
.pptxv-inspector-deck[hidden] { display: none; }
.pptxv-inspector-deck-btn {
	width: 100%;
	margin-top: 4px;
	padding: 5px 8px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-muted);
	color: inherit;
	font: inherit;
	font-size: 11px;
	cursor: pointer;
}
.pptxv-inspector-deck-btn:hover { background: var(--pptx-accent); }
.pptxv-inspector-deck-btn:disabled { opacity: 0.5; cursor: default; }
.pptxv-inspector-deck-btn-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
/* SLIDE SIZE card: the Landscape / Portrait segmented toggle. */
.pptxv-slide-size-orientation { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin: 6px 0; }
.pptxv-slide-size-orientation button {
	padding: 5px 8px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-muted);
	color: inherit;
	font: inherit;
	font-size: 11px;
	cursor: pointer;
}
.pptxv-slide-size-orientation button:hover:not(:disabled) { background: var(--pptx-accent); }
.pptxv-slide-size-orientation button.is-active {
	border-color: var(--pptx-primary);
	background: var(--pptx-primary);
	color: var(--pptx-primary-foreground, #fff);
}
.pptxv-slide-size-orientation button:disabled { opacity: 0.5; cursor: default; }
.pptxv-inspector-theme-select { width: 100%; margin-bottom: 6px; }
.pptxv-inspector-override-rows { display: flex; flex-direction: column; gap: 5px; margin-top: 6px; }
.pptxv-inspector-override-row { display: grid; grid-template-columns: minmax(0, 1fr) 14px minmax(0, 1fr); align-items: center; gap: 6px; }
.pptxv-inspector-override-row .pptxv-inspector-row-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pptxv-inspector-override-swatch {
	width: 14px;
	height: 14px;
	border: 1px solid var(--pptx-border);
	border-radius: 3px;
	flex-shrink: 0;
}
.pptxv-inspector-comment { padding: 6px 0; border-bottom: 1px solid color-mix(in srgb, var(--pptx-border) 60%, transparent); }
.pptxv-inspector-comment.is-resolved { opacity: 0.6; }
.pptxv-inspector-comment-meta { font-size: 11px; font-weight: 600; }
.pptxv-inspector-comment-text { margin: 2px 0 4px; }
.pptx-comment-mention { border-radius: 3px; padding: 0 2px; font-weight: 600; color: var(--pptx-primary, #6366f1); background: color-mix(in srgb, var(--pptx-primary, #6366f1) 15%, transparent); }
.pptxv-inspector-comment-actions { display: flex; gap: 6px; }
.pptxv-inspector-comment-action {
	padding: 2px 6px;
	border: none;
	border-radius: 4px;
	background: var(--pptx-muted);
	color: var(--pptx-muted-foreground);
	font: inherit;
	font-size: 10px;
	cursor: pointer;
}
.pptxv-inspector-comment-action:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-inspector-comment-add[hidden] { display: none; }
.pptxv-inspector-comment-input {
	width: 100%;
	margin-top: 6px;
	padding: 6px 8px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-background);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 12px;
	resize: vertical;
}
.pptxv-inspector-body { padding: 10px 12px; }
.pptxv-inspector-body[hidden] { display: none; }
.pptxv-inspector-empty { color: var(--pptx-muted-foreground); margin: 0; }
.pptxv-inspector-empty[hidden] { display: none; }
.pptxv-inspector-muted-text { font-size: 11px; color: var(--pptx-muted-foreground); }
.pptxv-ole-info { display: flex; flex-direction: column; gap: 6px; font-size: 11px; }
.pptxv-ole-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pptxv-ole-row[hidden] { display: none; }
.pptxv-ole-row span:first-child { color: var(--pptx-muted-foreground); }
.pptxv-ole-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pptxv-ole-badge {
	display: inline-flex;
	align-items: center;
	border-radius: 999px;
	padding: 1px 8px;
	font-size: 10px;
	font-weight: 500;
	background: rgba(34, 197, 94, 0.2);
	color: #4ade80;
}
.pptxv-ole-badge.is-linked { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
/*
 * A section is a CARD, the way React's inspector draws one (rounded, bordered,
 * card background, 8px of padding). Left as a bare bottom margin, the panel
 * read as one unbroken column of loose labels with nothing tying a heading to
 * the fields under it.
 */
.pptxv-inspector-section {
	margin-bottom: 10px;
	padding: 8px;
	border: 1px solid var(--pptx-border);
	border-radius: 6px;
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
}
.pptxv-inspector-section[hidden] { display: none; }
.pptxv-inspector-section-title {
	margin: 0 0 6px;
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--pptx-muted-foreground);
}
.pptxv-inspector-lock-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.pptxv-inspector-lock-row .pptxv-inspector-section-title { margin: 0; }
.pptxv-inspector-lock-btn.is-active { color: #f59e0b; }
.pptxv-inspector-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 6px 8px;
}
.pptxv-inspector-grid .pptxv-field { justify-content: space-between; }
.pptxv-inspector-grid .pptxv-field-input { width: 100%; }
.pptxv-inspector-row {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-bottom: 8px;
}
.pptxv-inspector-row-label { color: var(--pptx-muted-foreground); }

/* Table quick-style preset swatch gallery. */
.pptxv-table-presets-label { display: block; margin: 8px 0 4px; font-size: 10px; color: var(--pptx-muted-foreground); }
.pptxv-table-presets-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px; }
.pptxv-table-preset-swatch {
	display: flex;
	flex-direction: column;
	height: 40px;
	padding: 0;
	overflow: hidden;
	border: 1px solid var(--pptx-border);
	border-radius: 5px;
	background: none;
	cursor: pointer;
}
.pptxv-table-preset-swatch:hover { border-color: var(--pptx-primary); }
.pptxv-table-preset-swatch span { flex: 1; }
.pptxv-table-preset-swatch span:last-child { border-top: 1px solid; }

/* Compact SmartArt layout switcher and editable text pane. */
.pptxv-smartart-label { display: block; margin-bottom: 6px; color: var(--pptx-muted-foreground); }
.pptxv-smartart-layout-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; margin-bottom: 10px; }
.pptxv-smartart-layout-button {
	min-width: 0;
	padding: 6px 3px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: transparent;
	color: var(--pptx-muted-foreground);
	font: inherit;
	font-size: 10px;
	cursor: pointer;
	overflow: hidden;
	text-overflow: ellipsis;
}
.pptxv-smartart-layout-button:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-smartart-layout-button.is-active { border-color: var(--pptx-primary); background: color-mix(in srgb, var(--pptx-primary) 16%, transparent); color: var(--pptx-primary); }
.pptxv-smartart-nodes { display: flex; max-height: 208px; flex-direction: column; gap: 5px; overflow-y: auto; }
.pptxv-smartart-node { display: grid; grid-template-columns: 20px minmax(0, 1fr); align-items: center; gap: 5px; }
.pptxv-smartart-node-index { color: var(--pptx-muted-foreground); text-align: center; }
.pptxv-smartart-node-input { min-width: 0; height: 26px; box-sizing: border-box; padding: 2px 6px; border: 1px solid var(--pptx-border); border-radius: var(--pptx-radius); background: var(--pptx-background); color: var(--pptx-foreground); font: inherit; }
.pptxv-smartart-node-input:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: -1px; }

/* Select / checkbox / range fields (text/image/table inspector sections). */
.pptxv-field-select,
.pptxv-field-checkbox,
.pptxv-field-range {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 8px;
}
.pptxv-field-checkbox { justify-content: flex-start; }
.pptxv-field-checkbox .pptxv-field-label { order: 2; }
.pptxv-field-select-input {
	height: 26px;
	padding: 2px 6px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-background);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 12px;
}
.pptxv-field-select-input:disabled { opacity: 0.5; }
.pptxv-field-range { flex-direction: column; align-items: stretch; }
.pptxv-field-range-row { display: flex; align-items: center; gap: 8px; }
.pptxv-field-range-row input[type='range'] { flex: 1; }
.pptxv-field-range-readout {
	min-width: 34px;
	text-align: right;
	color: var(--pptx-muted-foreground);
	font-variant-numeric: tabular-nums;
}

/* Gradient fill sub-panel (Fill & Stroke section). */
.pptxv-inspector-gradient { margin: 4px 0 8px; padding-left: 4px; border-left: 2px solid var(--pptx-border); }
.pptxv-inspector-gradient[hidden] { display: none; }
.pptxv-inspector-gradient-stops { display: flex; flex-direction: column; gap: 4px; margin: 6px 0; }

/* Presentation mode hides all editing chrome (the ribbon is covered by
 * \`.pptxv.pptxv-presenting .pptxv-ribbon\` in css.ts). */
.pptxv.pptxv-presenting .pptxv-inspector { display: none; }

/* ── Accessibility checker ───────────────────────────────────────────── */
.pptxv-accessibility-panel {
	position: absolute;
	top: 56px;
	right: 12px;
	z-index: 20;
	width: min(360px, calc(100% - 24px));
	max-height: min(560px, calc(100% - 72px));
	overflow: auto;
	border: 1px solid var(--pptx-border);
	border-radius: calc(var(--pptx-radius) + 2px);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	box-shadow: 0 16px 36px rgb(0 0 0 / 20%);
}
.pptxv-accessibility-panel[hidden] { display: none; }
.pptxv-accessibility-header { display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid var(--pptx-border); }
.pptxv-accessibility-title { margin: 0; font-size: 13px; }
.pptxv-accessibility-close { border: 0; border-radius: var(--pptx-radius); background: transparent; color: var(--pptx-foreground); cursor: pointer; font: inherit; font-size: 12px; padding: 4px 7px; }
.pptxv-accessibility-close:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-accessibility-summary { margin: 0; padding: 8px 12px; color: var(--pptx-muted-foreground); font-size: 11px; }
.pptxv-accessibility-list { padding: 0 8px 8px; }
.pptxv-accessibility-group { margin-top: 8px; }
.pptxv-accessibility-group-title { margin: 0 4px 5px; color: var(--pptx-muted-foreground); font-size: 10px; letter-spacing: .05em; text-transform: uppercase; }
.pptxv-accessibility-issue { display: grid; width: 100%; grid-template-columns: 1fr auto; gap: 3px 10px; margin: 3px 0; padding: 8px; border: 0; border-left: 3px solid var(--pptx-border); border-radius: var(--pptx-radius); background: var(--pptx-muted); color: inherit; cursor: pointer; font: inherit; text-align: left; }
.pptxv-accessibility-group.is-error .pptxv-accessibility-issue { border-left-color: #d64545; }
.pptxv-accessibility-group.is-warning .pptxv-accessibility-issue { border-left-color: #d9911b; }
.pptxv-accessibility-group.is-tip .pptxv-accessibility-issue { border-left-color: #4b8bc5; }
.pptxv-accessibility-issue:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-accessibility-issue-type { font-size: 11px; }
.pptxv-accessibility-issue-message { grid-column: 1 / -1; color: var(--pptx-muted-foreground); font-size: 11px; line-height: 1.35; }
.pptxv-accessibility-issue:hover .pptxv-accessibility-issue-message { color: inherit; }
.pptxv-accessibility-issue-slide { color: var(--pptx-muted-foreground); font-size: 10px; }
.pptxv-accessibility-empty { margin: 12px 4px; color: var(--pptx-muted-foreground); font-size: 12px; text-align: center; }
.pptxv.pptxv-presenting .pptxv-accessibility-panel { display: none; }

/* ── Keyboard-shortcut cheat sheet ("?") ─────────────────────────────── */
.pptxv-shortcuts-panel {
	position: absolute;
	top: 56px;
	right: 12px;
	z-index: 40;
	width: min(384px, calc(100% - 24px));
	overflow: hidden;
	border: 1px solid var(--pptx-border);
	border-radius: calc(var(--pptx-radius) + 2px);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	box-shadow: 0 18px 50px rgb(0 0 0 / 30%);
}
.pptxv-shortcuts-panel[hidden] { display: none; }
.pptxv-shortcuts-header { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; border-bottom: 1px solid var(--pptx-border); }
.pptxv-shortcuts-title { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.pptxv-shortcuts-close { border: 0; border-radius: var(--pptx-radius); background: transparent; color: var(--pptx-foreground); cursor: pointer; font: inherit; font-size: 11px; padding: 5px 8px; }
.pptxv-shortcuts-close:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-shortcuts-list { max-height: 280px; overflow: auto; padding: 8px; }
.pptxv-shortcuts-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 7px 9px; border-radius: var(--pptx-radius); font-size: 12px; }
.pptxv-shortcuts-row:nth-child(odd) { background: var(--pptx-muted); }
.pptxv-shortcuts-keys { color: var(--pptx-muted-foreground); font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
.pptxv.pptxv-presenting .pptxv-shortcuts-panel { display: none; }

/* ── Canvas right-click menu ──────────────────────────────────────────── */
/* Positioned at the pointer in viewport coordinates, so it is fixed rather
 * than absolute; it is mounted into the .pptxv root (not the body) so a host
 * ViewerTheme's inline --pptx-* overrides reach it. Every colour still carries
 * a literal fallback for the body-mounted case. */
.pptxv-context-menu {
	position: fixed;
	z-index: 1150;
	min-width: 184px;
	max-height: min(70vh, 560px);
	overflow-y: auto;
	padding: 4px;
	border: 1px solid var(--pptx-border, #e2e8f0);
	border-radius: 8px;
	background: var(--pptx-popover, var(--pptx-card, #ffffff));
	color: var(--pptx-popover-foreground, var(--pptx-card-foreground, #0f172a));
	box-shadow: 0 8px 24px rgb(0 0 0 / 24%);
}
.pptxv-context-menu-item {
	display: flex;
	align-items: center;
	width: 100%;
	padding: 6px 10px;
	border: none;
	border-radius: 6px;
	background: transparent;
	color: inherit;
	font: inherit;
	font-size: 0.8125rem;
	text-align: left;
	cursor: pointer;
}
.pptxv-context-menu-item:hover:not(:disabled) { background: var(--pptx-accent, #eef2f7); color: var(--pptx-accent-foreground, inherit); }
.pptxv-context-menu-item:disabled { opacity: .45; cursor: default; }
.pptxv-context-menu-item.is-danger { color: #d64545; }
.pptxv-context-menu-item.is-danger:hover:not(:disabled) { background: #d6454518; color: #d64545; }
.pptxv-context-menu-separator { height: 1px; margin: 4px 6px; background: var(--pptx-border, #e2e8f0); }

/* Floating value readout shown while a chart data point is dragged on canvas. */
.pptxv-chart-drag-badge {
	position: absolute;
	top: 4px;
	right: 4px;
	padding: 1px 6px;
	border-radius: 4px;
	background: #1e293b;
	color: #f8fafc;
	font-size: 10px;
	line-height: 1.5;
	pointer-events: none;
}

/* Inline title editor opened by double-clicking a chart's title. */
.pptxv-chart-title-input {
	position: absolute;
	left: 50%;
	top: 2px;
	transform: translateX(-50%);
	z-index: 10;
	width: 60%;
	box-sizing: border-box;
	text-align: center;
	font-size: 11px;
	padding: 2px 4px;
	border: 1px solid #cbd5e1;
	border-radius: 4px;
	background: #ffffff;
	color: #0f172a;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
`;
