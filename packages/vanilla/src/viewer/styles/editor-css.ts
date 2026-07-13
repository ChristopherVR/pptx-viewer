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
	width: 232px;
	overflow-y: auto;
	border-left: 1px solid var(--pptx-border);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	font-size: 12px;
}
.pptxv-inspector[hidden] { display: none; }
.pptxv-inspector-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	padding: 8px 12px;
	border: none;
	border-bottom: 1px solid var(--pptx-border);
	background: transparent;
	color: var(--pptx-foreground);
	font: inherit;
	font-weight: 600;
	cursor: pointer;
}
.pptxv-inspector-header:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-inspector-body { padding: 10px 12px; }
.pptxv-inspector-body[hidden] { display: none; }
.pptxv-inspector-empty { color: var(--pptx-muted-foreground); margin: 0; }
.pptxv-inspector-empty[hidden] { display: none; }
.pptxv-inspector-section { margin-bottom: 14px; }
.pptxv-inspector-section[hidden] { display: none; }
.pptxv-inspector-section-title {
	margin: 0 0 6px;
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--pptx-muted-foreground);
}
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
`;
