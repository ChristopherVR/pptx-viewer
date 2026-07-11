/**
 * Ribbon stylesheet fragment: the tab bar, tab content groups, the reusable
 * dropdown / swatch-picker popovers, the Insert shape grid, and the docked
 * Find & Replace panel. Concatenated after `editor-css.ts` by
 * {@link buildViewerCss}. All colours come from the shared `--pptx-*` theme
 * custom properties so the vermilion light/dark presets keep working.
 */
export const RIBBON_CSS = `
/* ── Tab bar ─────────────────────────────────────────────────────────── */
.pptxv-ribbon-tabs {
	display: flex;
	align-items: center;
	gap: 2px;
	padding: 0 6px;
	border-bottom: 1px solid var(--pptx-border);
	overflow-x: auto;
}
.pptxv-ribbon-tabs[hidden] { display: none; }
.pptxv-ribbon-tab {
	padding: 6px 12px;
	border: none;
	border-bottom: 2px solid transparent;
	background: transparent;
	color: var(--pptx-muted-foreground);
	font: inherit;
	font-size: 12px;
	font-weight: 500;
	white-space: nowrap;
	cursor: pointer;
}
.pptxv-ribbon-tab:hover { color: var(--pptx-foreground); background: var(--pptx-accent); }
.pptxv-ribbon-tab.is-active { color: var(--pptx-foreground); border-bottom-color: var(--pptx-primary); }
.pptxv-ribbon-tab-file { color: var(--pptx-primary); }
.pptxv-ribbon-tab-file.is-active {
	color: #fff;
	background: color-mix(in srgb, var(--pptx-primary) 80%, transparent);
	border-radius: var(--pptx-radius);
}

/* ── Tab content + groups ────────────────────────────────────────────── */
.pptxv-ribbon-tab-content {
	display: flex;
	flex-wrap: wrap;
	align-items: flex-start;
	gap: 2px;
	padding: 6px 8px;
}
.pptxv-ribbon-tab-content[hidden] { display: none; }
.pptxv-rgroup {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2px;
	padding: 2px 8px;
	border-right: 1px solid var(--pptx-border);
}
.pptxv-rgroup:last-child { border-right: none; }
.pptxv-rgroup-row { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; }
.pptxv-rgroup-label {
	font-size: 9px;
	color: var(--pptx-muted-foreground);
	text-transform: uppercase;
	letter-spacing: 0.03em;
}
.pptxv-rgroup .pptxv-btn.is-active { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }

/* ── Shape insert grid ───────────────────────────────────────────────── */
.pptxv-shape-grid {
	display: grid;
	grid-template-columns: repeat(10, 28px);
	gap: 2px;
	max-width: 320px;
}

/* ── Dropdown popover (font/size/spacing/case/line-spacing) ─────────────*/
.pptxv-dropdown { position: relative; display: inline-flex; }
.pptxv-dropdown-trigger {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	height: 28px;
	padding: 0 6px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-background);
	color: inherit;
	font: inherit;
	font-size: 11px;
	cursor: pointer;
}
.pptxv-dropdown-trigger:hover:not(:disabled) { background: var(--pptx-accent); }
.pptxv-dropdown-trigger:disabled { opacity: 0.4; cursor: default; }
.pptxv-dropdown-trigger.is-active { background: var(--pptx-accent); }
.pptxv-dropdown-trigger svg { width: 12px; height: 12px; flex: none; }
.pptxv-dropdown-text { max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pptxv-font-family-dd .pptxv-dropdown-text { max-width: 120px; }
.pptxv-font-size-dd .pptxv-dropdown-trigger { min-width: 44px; justify-content: space-between; }
.pptxv-dropdown-menu {
	position: absolute;
	top: calc(100% + 4px);
	left: 0;
	z-index: 30;
	min-width: 140px;
	max-height: 240px;
	overflow-y: auto;
	padding: 4px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	box-shadow: 0 6px 20px rgb(0 0 0 / 0.25);
}
.pptxv-dropdown-menu[hidden] { display: none; }
.pptxv-dropdown-item {
	display: block;
	width: 100%;
	padding: 6px 8px;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: inherit;
	font: inherit;
	text-align: left;
	cursor: pointer;
}
.pptxv-dropdown-item:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-dropdown-item.is-selected { font-weight: 600; color: var(--pptx-primary); }

/* ── Swatch colour picker ────────────────────────────────────────────── */
.pptxv-swatch-picker { position: relative; display: inline-flex; }
.pptxv-swatch-trigger { flex-direction: column; height: 28px; padding: 2px 6px; gap: 0; }
.pptxv-swatch-swab { display: block; width: 16px; height: 3px; border-radius: 1px; margin-top: 1px; }
.pptxv-swatch-menu {
	position: absolute;
	top: calc(100% + 4px);
	left: 0;
	z-index: 30;
	padding: 8px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	box-shadow: 0 6px 20px rgb(0 0 0 / 0.25);
}
.pptxv-swatch-menu[hidden] { display: none; }
.pptxv-swatch-grid { display: grid; grid-template-columns: repeat(5, 20px); gap: 4px; margin-bottom: 6px; }
.pptxv-swatch {
	width: 20px;
	height: 20px;
	padding: 0;
	border: 1px solid var(--pptx-border);
	border-radius: 50%;
	cursor: pointer;
}
.pptxv-swatch:hover { transform: scale(1.15); }
.pptxv-swatch.is-selected { outline: 2px solid var(--pptx-ring); outline-offset: 1px; }
.pptxv-swatch-custom {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 6px;
	font-size: 11px;
	color: var(--pptx-muted-foreground);
	cursor: pointer;
}
.pptxv-swatch-custom-input {
	width: 20px;
	height: 20px;
	padding: 0;
	border: 1px solid var(--pptx-border);
	border-radius: 4px;
	background: none;
	cursor: pointer;
}

/* ── Find & Replace docked panel ─────────────────────────────────────── */
.pptxv-findreplace {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 6px 8px;
	border-bottom: 1px solid var(--pptx-border);
	background: var(--pptx-muted);
}
.pptxv-findreplace[hidden] { display: none; }
.pptxv-findreplace-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.pptxv-findreplace-input {
	height: 28px;
	min-width: 140px;
	padding: 0 8px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-background);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 12px;
}
.pptxv-findreplace-input:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: -1px; }
.pptxv-findreplace-checkbox {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font-size: 11px;
	color: var(--pptx-muted-foreground);
	cursor: pointer;
}
.pptxv-findreplace-status { font-size: 11px; color: var(--pptx-muted-foreground); }
`;
