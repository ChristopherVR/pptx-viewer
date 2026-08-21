/**
 * Styles for the inspector's format panels that have no React-equivalent
 * chrome elsewhere in this stylesheet: the Quick Styles gallery, the 3D-text
 * fields, the chart data grid, the table data grid, the media trim timeline,
 * the slide-transition direction picker, the Tags list and the theme editor
 * card.
 *
 * Kept in its own module so `editor-css.ts` (already the largest chrome sheet)
 * stays inside the project's file-size budget.
 */
export const INSPECTOR_FORMAT_CSS = `
/* ── Quick Styles gallery ────────────────────────────────────────────── */
.pptxv-quick-styles {
	display: grid;
	grid-template-columns: repeat(6, minmax(0, 1fr));
	gap: 4px;
}
.pptxv-quick-style {
	height: 26px;
	min-width: 0;
	padding: 0;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	cursor: pointer;
}
.pptxv-quick-style:hover:not(:disabled) { outline: 2px solid var(--pptx-primary); outline-offset: -1px; }
.pptxv-quick-style:disabled { opacity: 0.5; cursor: default; }

/* ── 3D text ─────────────────────────────────────────────────────────── */
.pptxv-text3d-options { display: grid; gap: 6px; }
.pptxv-text3d-options[hidden] { display: none; }
.pptxv-text3d-bevel {
	display: grid;
	gap: 4px;
	padding-left: 6px;
	border-left: 2px solid var(--pptx-border);
}
.pptxv-text3d-bevel-label { color: var(--pptx-muted-foreground); font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
.pptxv-text3d-color { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

/* ── Chart data grid ─────────────────────────────────────────────────── */
.pptxv-chart-grid { display: grid; gap: 4px; margin: 6px 0; }
.pptxv-chart-grid[hidden] { display: none; }
.pptxv-chart-grid-toolbar { display: flex; justify-content: flex-end; gap: 4px; }
.pptxv-chart-grid-btn {
	padding: 2px 6px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-muted);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 10px;
	cursor: pointer;
}
.pptxv-chart-grid-btn:hover:not(:disabled) { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-chart-grid-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.pptxv-chart-grid-table th, .pptxv-chart-grid-table td { padding: 1px; }
.pptxv-chart-grid-table th { font-weight: 400; }
.pptxv-chart-grid-table :is(th, td) { display: table-cell; white-space: nowrap; }
.pptxv-chart-grid-cell {
	box-sizing: border-box;
	width: 100%;
	min-width: 52px;
	padding: 2px 4px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-background);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 11px;
}
.pptxv-chart-grid-cell:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: -1px; }
/* Ring-highlight for the cell matching the on-canvas chart part selection. */
.pptxv-chart-grid-cell-highlight { outline: 2px solid var(--pptx-ring); outline-offset: -1px; }
.pptxv-chart-grid-remove {
	margin-left: 2px;
	padding: 0 3px;
	border: none;
	background: transparent;
	color: var(--pptx-muted-foreground);
	font: inherit;
	cursor: pointer;
}
.pptxv-chart-grid-remove:hover { color: var(--pptx-destructive); }

/* ── Table data grid ─────────────────────────────────────────────────── */
.pptxv-table-grid-header { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.pptxv-table-grid-toolbar { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
.pptxv-table-grid-toolbar[hidden] { display: none; }
.pptxv-table-grid-btn {
	padding: 2px 6px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-muted);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 10px;
	cursor: pointer;
}
.pptxv-table-grid-btn:hover:not(:disabled) { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-table-grid-btn:disabled { opacity: 0.5; cursor: default; }
.pptxv-table-grid-scroll { overflow-x: auto; }
.pptxv-table-grid-body { display: flex; flex-direction: column; width: max-content; min-width: 100%; font-size: 11px; }
.pptxv-table-grid-row { display: flex; }
.pptxv-table-grid-head {
	display: flex;
	flex: 1 1 56px;
	align-items: center;
	justify-content: center;
	gap: 2px;
	min-width: 0;
	margin: -1px 0 0 -1px;
	padding: 1px 3px;
	border: 1px solid var(--pptx-border);
	background: var(--pptx-muted);
	color: var(--pptx-muted-foreground);
	white-space: nowrap;
}
.pptxv-table-grid-gutter { flex: 0 0 38px; }
.pptxv-table-grid-cell {
	display: flex;
	flex: 1 1 56px;
	min-width: 0;
	margin: -1px 0 0 -1px;
	padding: 1px;
	border: 1px solid var(--pptx-border);
}
.pptxv-table-grid-input {
	box-sizing: border-box;
	width: 100%;
	min-width: 0;
	padding: 2px 4px;
	border: none;
	background: transparent;
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 11px;
}
.pptxv-table-grid-input:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: -2px; }
.pptxv-table-grid-input:disabled { opacity: 0.6; }
.pptxv-table-grid-remove {
	padding: 0 2px;
	border: none;
	background: transparent;
	color: var(--pptx-muted-foreground);
	font: inherit;
	line-height: 1;
	cursor: pointer;
}
.pptxv-table-grid-remove[hidden] { display: none; }
.pptxv-table-grid-remove:hover { color: var(--pptx-destructive); }

/* ── Media trim timeline ─────────────────────────────────────────────── */
.pptxv-media-timeline { display: grid; gap: 2px; margin: 6px 0; }
.pptxv-media-timeline-times { display: flex; justify-content: space-between; }
.pptxv-media-timeline-time { color: var(--pptx-muted-foreground); font-size: 10px; font-variant-numeric: tabular-nums; }
.pptxv-media-timeline-bar {
	position: relative;
	height: 20px;
	border-radius: var(--pptx-radius);
	background: var(--pptx-muted);
	cursor: pointer;
	user-select: none;
	touch-action: none;
}
.pptxv-media-timeline-region {
	position: absolute;
	top: 0;
	bottom: 0;
	border-radius: var(--pptx-radius);
	background: color-mix(in srgb, var(--pptx-primary) 30%, transparent);
	pointer-events: none;
}
.pptxv-media-timeline-playhead { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff; pointer-events: none; }
.pptxv-media-timeline-marks { position: absolute; inset: 0; pointer-events: none; }
.pptxv-media-timeline-mark {
	position: absolute;
	top: 0;
	bottom: 0;
	width: 4px;
	margin-left: -2px;
	padding: 0;
	border: none;
	background: rgb(250 204 21 / 0.8);
	cursor: pointer;
	pointer-events: auto;
}
.pptxv-media-timeline-handle {
	position: absolute;
	top: 0;
	bottom: 0;
	width: 8px;
	margin-left: -4px;
	border-radius: 2px;
	background: var(--pptx-primary);
	cursor: ew-resize;
	touch-action: none;
}
.pptxv-media-timeline-handle[hidden] { display: none; }

/* ── Slide transition direction picker ───────────────────────────────── */
.pptxv-transition-directions { display: grid; gap: 4px; margin-bottom: 8px; }
.pptxv-transition-directions[hidden] { display: none; }
.pptxv-transition-dir-row { display: flex; flex-wrap: wrap; gap: 4px; }
.pptxv-transition-dir-grid { display: grid; grid-template-columns: repeat(3, 24px); gap: 3px; }
.pptxv-transition-dir-gap { display: block; }
.pptxv-transition-dir {
	min-width: 24px;
	height: 22px;
	padding: 0 4px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-muted);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 11px;
	cursor: pointer;
}
.pptxv-transition-dir:hover:not(:disabled) { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-transition-dir.is-active { border-color: var(--pptx-primary); background: color-mix(in srgb, var(--pptx-primary) 20%, transparent); color: var(--pptx-primary); }
.pptxv-transition-sound { margin: 4px 0 0; color: var(--pptx-muted-foreground); font-size: 10px; }
.pptxv-transition-sound[hidden] { display: none; }
.pptxv-transition-preview { display: grid; gap: 3px; margin-top: 8px; }
.pptxv-transition-preview[hidden] { display: none; }
.pptxv-transition-preview-label { font-size: 10px; color: var(--pptx-muted-foreground); }
.pptxv-transition-preview-stage {
	position: relative;
	display: block;
	width: 100%;
	height: 64px;
	padding: 0;
	overflow: hidden;
	border: 1px solid var(--pptx-border);
	border-radius: 6px;
	background: var(--pptx-muted);
	cursor: pointer;
}
.pptxv-transition-preview-layer {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--pptx-muted-foreground);
	font-size: 9px;
}
.pptxv-transition-preview-layer.is-incoming { background: color-mix(in srgb, var(--pptx-primary) 20%, transparent); }
.pptxv-transition-preview-layer.is-outgoing { background: var(--pptx-card); }

/* ── Tags card ───────────────────────────────────────────────────────── */
.pptxv-tags-toggle {
	display: flex;
	width: 100%;
	align-items: center;
	justify-content: space-between;
	padding: 0;
	border: none;
	background: transparent;
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 11px;
	cursor: pointer;
}
.pptxv-tags-count { color: var(--pptx-muted-foreground); font-size: 10px; }
.pptxv-tags-list { display: grid; gap: 4px; margin-top: 6px; }
.pptxv-tags-list[hidden] { display: none; }
.pptxv-tags-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 4px; }
.pptxv-tags-input {
	min-width: 0;
	padding: 2px 4px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-background);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 11px;
}
.pptxv-tags-remove {
	padding: 0 5px;
	border: none;
	border-radius: var(--pptx-radius);
	background: transparent;
	color: var(--pptx-muted-foreground);
	font: inherit;
	cursor: pointer;
}
.pptxv-tags-remove:hover { color: var(--pptx-destructive); }
.pptxv-tags-empty { margin: 6px 0 0; color: var(--pptx-muted-foreground); font-size: 10px; }
.pptxv-tags-empty[hidden] { display: none; }

/* ── Theme editor card ───────────────────────────────────────────────── */
.pptxv-theme-name .pptxv-field-input { width: 100%; }
.pptxv-theme-presets { display: grid; gap: 4px; margin: 8px 0; }
.pptxv-theme-preset-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
.pptxv-theme-preset {
	display: grid;
	min-width: 0;
	gap: 2px;
	padding: 4px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: transparent;
	color: var(--pptx-muted-foreground);
	font: inherit;
	font-size: 10px;
	cursor: pointer;
}
.pptxv-theme-preset:hover:not(:disabled) { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-theme-preset.is-active { border-color: var(--pptx-primary); color: var(--pptx-primary); }
.pptxv-theme-preset-swatches { display: flex; gap: 2px; }
.pptxv-theme-preset-dot { display: block; width: 100%; height: 10px; border-radius: 2px; }
.pptxv-theme-preset-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pptxv-theme-slots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 8px; margin-bottom: 8px; }
.pptxv-theme-slot { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; font-size: 10px; }
.pptxv-theme-slot-label { overflow: hidden; color: var(--pptx-muted-foreground); text-overflow: ellipsis; white-space: nowrap; }
.pptxv-theme-slot-input { width: 26px; height: 20px; padding: 0; border: 1px solid var(--pptx-border); border-radius: 3px; background: transparent; }
.pptxv-theme-preview {
	display: grid;
	gap: 2px;
	margin: 8px 0;
	padding: 8px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
}
.pptxv-theme-preview-heading { font-size: 13px; font-weight: 600; }
.pptxv-theme-preview-body { font-size: 11px; }

/* ── Alt text (image section) ────────────────────────────────────────── */
.pptxv-image-alt { display: grid; gap: 3px; margin: 6px 0; }
.pptxv-image-alt-input {
	box-sizing: border-box;
	width: 100%;
	padding: 4px 6px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-background);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 11px;
	resize: vertical;
}
.pptxv-image-alt-input:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: -1px; }
`;
