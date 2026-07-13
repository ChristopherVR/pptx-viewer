import { defaultCssVars } from 'pptx-viewer-shared';

import { COLLAB_CSS } from './collab-css';
import { EDITOR_CSS } from './editor-css';
import { RIBBON_CSS } from './ribbon-css';

/**
 * The viewer stylesheet, scoped under the `.pptxv` root class.
 *
 * All chrome colors come from the shared `--pptx-*` theme custom properties
 * (see `pptx-viewer-shared/theme`): the defaults are emitted onto `.pptxv`
 * from the shared `defaultCssVars()`, and a host `ViewerTheme` overrides them
 * per instance via inline style (see `themeToCssVars`).
 */

function defaultVarsBlock(): string {
	const vars = Object.entries(defaultCssVars())
		.map(([key, value]) => `\t${key}: ${value};`)
		.join('\n');
	return `.pptxv {\n${vars}\n}`;
}

const CHROME_CSS = `
.pptxv {
	position: relative;
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	min-height: 0;
	overflow: hidden;
	background: var(--pptx-background);
	color: var(--pptx-foreground);
	font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
	font-size: 14px;
}
.pptxv *, .pptxv *::before, .pptxv *::after { box-sizing: border-box; }
.pptxv:focus { outline: none; }
.pptxv:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: -2px; }

/* Ribbon shell layout (primary row + nav row + tab bar + groups) lives in
 * ribbon-css.ts; .pptxv-btn below is the shared icon-button primitive used by
 * both the ribbon and the inspector. */
.pptxv-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	padding: 0;
	border: none;
	border-radius: var(--pptx-radius);
	background: transparent;
	color: inherit;
	cursor: pointer;
}
.pptxv-btn:hover:not(:disabled) { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-btn:disabled { opacity: 0.4; cursor: default; }
.pptxv-btn.is-active { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-btn:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: 1px; }
.pptxv-btn svg { width: 16px; height: 16px; display: block; }
.pptxv-counter, .pptxv-zoom-label {
	padding: 0 8px;
	color: var(--pptx-muted-foreground);
	white-space: nowrap;
	font-variant-numeric: tabular-nums;
}
.pptxv-autosave-status {
	padding: 0 6px;
	font-size: 12px;
	white-space: nowrap;
	color: var(--pptx-muted-foreground);
}
.pptxv-autosave-status.is-saving { color: var(--pptx-accent-foreground); opacity: 0.8; }
.pptxv-autosave-status.is-error { color: #dc2626; }

/* ── Body: thumbnail rail + viewport ─────────────────────────────────── */
.pptxv-body { display: flex; flex: 1; min-height: 0; }
.pptxv-thumbs {
	flex: none;
	width: 168px;
	overflow-y: auto;
	overflow-x: hidden;
	padding: 8px;
	border-right: 1px solid var(--pptx-border);
	background: var(--pptx-card);
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.pptxv-thumb {
	display: flex;
	align-items: flex-start;
	gap: 6px;
	padding: 0;
	border: none;
	background: transparent;
	color: inherit;
	cursor: pointer;
	text-align: left;
}
.pptxv-thumb-num {
	flex: none;
	width: 16px;
	font-size: 11px;
	color: var(--pptx-muted-foreground);
	line-height: 1.4;
}
.pptxv-thumb-frame {
	position: relative;
	overflow: hidden;
	border: 2px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: #fff;
}
.pptxv-thumb.is-active .pptxv-thumb-frame { border-color: var(--pptx-primary); }
.pptxv-thumb:focus-visible .pptxv-thumb-frame { outline: 2px solid var(--pptx-ring); }

/* ── Viewport / stage ────────────────────────────────────────────────── */
.pptxv-viewport {
	flex: 1;
	min-width: 0;
	overflow: auto;
	display: grid;
	place-items: center;
	padding: 16px;
	background: var(--pptx-muted);
}
.pptxv-stage-wrap {
	position: relative;
	overflow: hidden;
	flex: none;
	box-shadow: 0 2px 12px rgb(0 0 0 / 0.25);
}
.pptxv-stage { background: #fff; }
.pptxv-stage-wrap[data-draw-tool="pen"],
.pptxv-stage-wrap[data-draw-tool="highlighter"] { cursor: crosshair; }
.pptxv-stage-wrap[data-draw-tool="eraser"] { cursor: cell; }
.pptxv-para { margin: 0; }

/* ── Selection overlay (editing) ─────────────────────────────────────── */
.pptxv-editor-overlay {
	position: absolute;
	inset: 0;
	pointer-events: none;
	z-index: 5;
}
.pptxv-sel-box {
	position: absolute;
	box-sizing: border-box;
	border: 1px solid var(--pptx-ring);
	pointer-events: none;
	transform-origin: center;
}
.pptxv-sel-handle {
	position: absolute;
	width: 10px;
	height: 10px;
	margin: -5px 0 0 -5px;
	padding: 0;
	border: 1px solid var(--pptx-ring);
	border-radius: 2px;
	background: #fff;
	pointer-events: auto;
	box-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
}
.pptxv-rotate-stem {
	position: absolute;
	left: 50%;
	width: 1px;
	margin-left: -0.5px;
	background: var(--pptx-ring);
	pointer-events: none;
}
.pptxv-rotate-knob {
	position: absolute;
	left: 50%;
	width: 12px;
	height: 12px;
	margin: -6px 0 0 -6px;
	padding: 0;
	border: 1px solid var(--pptx-ring);
	border-radius: 50%;
	background: #fff;
	cursor: grab;
	pointer-events: auto;
	box-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
}
.pptxv-snap-layer {
	position: absolute;
	inset: 0;
	pointer-events: none;
}
.pptxv-snap-line { position: absolute; background: var(--pptx-destructive); }
.pptxv-snap-v { top: 0; bottom: 0; width: 1px; }
.pptxv-snap-h { left: 0; right: 0; height: 1px; }

/* ── Speaker notes panel ─────────────────────────────────────────────── */
.pptxv-notes {
	display: flex;
	flex-direction: column;
	flex: none;
	border-top: 1px solid var(--pptx-border);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
}
.pptxv-notes-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	padding: 6px 10px;
	border: none;
	background: transparent;
	color: var(--pptx-muted-foreground);
	font-size: 0.8125rem;
	font-weight: 600;
	text-align: left;
	cursor: pointer;
}
.pptxv-notes-header:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-notes-header:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: -2px; }
.pptxv-notes-chevron { font-size: 0.75rem; }
.pptxv-notes-body { padding: 0 10px 10px; }
.pptxv-notes-body[hidden] { display: none; }
.pptxv-notes-textarea {
	box-sizing: border-box;
	width: 100%;
	min-height: 80px;
	max-height: 200px;
	padding: 8px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-muted);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 0.8125rem;
	line-height: 1.5;
	resize: vertical;
}
.pptxv-notes-textarea:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: -1px; }
.pptxv-notes-textarea:disabled,
.pptxv-notes-textarea:read-only { cursor: default; opacity: 0.85; }
.pptxv.pptxv-presenting .pptxv-notes { display: none; }

/* ── Bottom status bar ──────────────────────────────────────────────── */
.pptxv-statusbar {
	display: flex;
	align-items: center;
	gap: 4px;
	min-height: 28px;
	padding: 2px 8px;
	border-top: 1px solid var(--pptx-border);
	background: color-mix(in srgb, var(--pptx-muted) 55%, var(--pptx-card));
	color: var(--pptx-muted-foreground);
	font-size: 10px;
}
.pptxv-statusbar-spacer { flex: 1; }
.pptxv-statusbar-sep { width: 1px; height: 12px; margin: 0 4px; background: var(--pptx-border); opacity: 0.6; }
.pptxv-statusbar-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
	min-width: 24px;
	height: 22px;
	padding: 2px 4px;
	border: none;
	border-radius: 3px;
	background: transparent;
	color: inherit;
	font: inherit;
	cursor: pointer;
}
.pptxv-statusbar-btn:hover:not(:disabled) { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-statusbar-btn:disabled { opacity: 0.4; cursor: default; }
.pptxv-statusbar-btn.is-active { color: var(--pptx-primary); }
.pptxv-statusbar-btn:focus-visible,
.pptxv-statusbar-zoom:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: 1px; }
.pptxv-statusbar-btn svg, .pptxv-statusbar-icon svg { width: 12px; height: 12px; display: block; }
.pptxv-statusbar-counter, .pptxv-statusbar-text { white-space: nowrap; }
.pptxv-statusbar-save.is-saving { color: #ca8a04; }
.pptxv-statusbar-save.is-error { color: #dc2626; }
.pptxv-statusbar-zoom {
	min-width: 48px;
	height: 22px;
	padding: 2px 6px;
	border: none;
	border-radius: 3px;
	background: transparent;
	color: inherit;
	font: inherit;
	font-variant-numeric: tabular-nums;
	cursor: pointer;
}
.pptxv-statusbar-zoom:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv.pptxv-presenting .pptxv-statusbar { display: none; }

/* ── Placeholder (element types without a renderer yet) ──────────────── */
.pptxv-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1px dashed var(--pptx-muted-foreground);
	border-radius: 4px;
	background: rgb(127 127 127 / 0.08);
}
.pptxv-placeholder-label {
	padding: 2px 8px;
	font-size: 12px;
	color: var(--pptx-muted-foreground);
	background: rgb(127 127 127 / 0.12);
	border-radius: 4px;
}

/* ── Overlays ────────────────────────────────────────────────────────── */
.pptxv-overlay {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: color-mix(in srgb, var(--pptx-background) 70%, transparent);
	z-index: 10;
}
.pptxv-overlay[hidden] { display: none; }
.pptxv-error-message { color: var(--pptx-destructive); padding: 0 24px; text-align: center; }
.pptxv-empty { color: var(--pptx-muted-foreground); }

/* ── Presentation (fullscreen) mode ──────────────────────────────────── */
.pptxv.pptxv-presenting .pptxv-ribbon,
.pptxv.pptxv-presenting .pptxv-thumbs { display: none; }
.pptxv.pptxv-presenting .pptxv-viewport { background: #000; padding: 0; }
.pptxv.pptxv-presenting .pptxv-stage-wrap { box-shadow: none; }
`;

/** The full stylesheet text (theme-var defaults + chrome rules + editor + collab chrome). */
export function buildViewerCss(): string {
	return `${defaultVarsBlock()}\n${CHROME_CSS}\n${EDITOR_CSS}\n${RIBBON_CSS}\n${COLLAB_CSS}`;
}
