/**
 * Editing-chrome stylesheet fragment: the format toolbar row, its reusable
 * controls (glyph toggles, colour swatches, numeric fields), the Insert
 * popover, and the property inspector panel. Concatenated after the base
 * chrome CSS by {@link buildViewerCss}. All colours come from the shared
 * `--pptx-*` theme custom properties.
 */
export const EDITOR_CSS = `
/* ── Format toolbar (editing) ────────────────────────────────────────── */
.pptxv-format-toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 4px 6px;
	padding: 5px 8px;
	border-bottom: 1px solid var(--pptx-border);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	flex: none;
}
.pptxv-format-toolbar[hidden] { display: none; }
.pptxv-format-group {
	display: inline-flex;
	align-items: center;
	gap: 2px;
	padding-right: 6px;
	margin-right: 2px;
	border-right: 1px solid var(--pptx-border);
}
.pptxv-format-group:last-child { border-right: none; }
.pptxv-glyph { font-size: 14px; line-height: 1; }
.pptxv-glyph-bold { font-weight: 700; }
.pptxv-glyph-italic { font-style: italic; font-family: Georgia, 'Times New Roman', serif; }
.pptxv-glyph-underline { text-decoration: underline; }

/* Colour swatch control */
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

/* Insert dropdown */
.pptxv-insert { position: relative; display: inline-flex; }
.pptxv-insert-menu {
	position: absolute;
	top: calc(100% + 4px);
	left: 0;
	z-index: 20;
	min-width: 160px;
	padding: 4px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	box-shadow: 0 6px 20px rgb(0 0 0 / 0.2);
}
.pptxv-insert-menu[hidden] { display: none; }
.pptxv-insert-item {
	display: block;
	width: 100%;
	padding: 6px 10px;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: inherit;
	font: inherit;
	text-align: left;
	cursor: pointer;
}
.pptxv-insert-item:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }

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

/* Presentation mode hides all editing chrome. */
.pptxv.pptxv-presenting .pptxv-format-toolbar,
.pptxv.pptxv-presenting .pptxv-inspector { display: none; }
`;
