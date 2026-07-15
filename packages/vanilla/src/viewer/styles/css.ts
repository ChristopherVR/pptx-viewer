import { defaultCssVars } from 'pptx-viewer-shared';

import { COLLAB_CSS } from './collab-css';
import { EDITOR_CSS } from './editor-css';
import { MASTER_VIEW_CSS } from './master-view-css';
import { MOBILE_SHEET_CSS } from './mobile-sheet-css';
import { PRESENTATION_TOUCH_CSS } from './presentation-touch-css';
import { RIBBON_CSS } from './ribbon-css';
import { SMARTART_DIALOG_CSS } from './smartart-dialog-css';

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
.pptxv :is(button, a, input, select, textarea, [tabindex]):focus-visible { outline: 2px solid var(--pptx-ring) !important; outline-offset: 2px; }
.pptxv :is(button, [role='button']) { min-width: 24px; min-height: 24px; touch-action: manipulation; }
@media (prefers-reduced-motion: reduce) {
	.pptxv *, .pptxv *::before, .pptxv *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
@media (forced-colors: active) {
	.pptxv :is(button, a, input, select, textarea, [tabindex]):focus-visible { outline-color: Highlight; }
}

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

/* ── PowerPoint-style title bar ─────────────────────────────────────── */
.pptxv-titlebar {
	position: relative;
	display: flex;
	align-items: center;
	gap: 6px;
	min-height: 34px;
	padding: 4px 10px;
	border-bottom: 1px solid var(--pptx-border);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	font-size: 11px;
	user-select: none;
}
.pptxv-titlebar-logo {
	display: inline-grid;
	width: 20px;
	height: 20px;
	place-items: center;
	border-radius: 3px;
	background: #d24726;
	color: #fff;
	font-size: 13px;
	font-weight: 700;
}
.pptxv-titlebar-autosave, .pptxv-titlebar-file { display: inline-flex; align-items: center; gap: 5px; min-width: 0; }
.pptxv-titlebar-autosave-label, .pptxv-titlebar-status { color: var(--pptx-muted-foreground); white-space: nowrap; }
.pptxv-titlebar-switch {
	position: relative;
	width: 27px;
	height: 14px;
	padding: 0;
	border: 0;
	border-radius: 999px;
	background: var(--pptx-muted-foreground);
	cursor: pointer;
}
.pptxv-titlebar-switch.is-on { background: var(--pptx-primary); }
.pptxv-titlebar-switch-knob { position: absolute; top: 2px; left: 2px; width: 10px; height: 10px; border-radius: 50%; background: #fff; transition: transform 120ms ease; }
.pptxv-titlebar-switch.is-on .pptxv-titlebar-switch-knob { transform: translateX(13px); }
.pptxv-titlebar-switch:focus-visible, .pptxv-titlebar-btn:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: 1px; }
.pptxv-titlebar-btn { width: 24px; height: 24px; }
.pptxv-titlebar-btn:hover:not(:disabled) { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-titlebar-sep { width: 1px; height: 16px; background: var(--pptx-border); }
.pptxv-titlebar-filename { overflow: hidden; max-width: 180px; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.pptxv-titlebar-dot { color: var(--pptx-muted-foreground); }
.pptxv-titlebar-status.is-error { color: #dc2626; }
.pptxv-titlebar-status.is-saving { color: #ca8a04; }
.pptxv-titlebar-search { position: absolute; left: 50%; width: min(320px, 30vw); transform: translateX(-50%); }
.pptxv-titlebar-spacer { flex: 1; min-width: 20px; }
.pptxv-cmdsearch { position: relative; width: 100%; }
.pptxv-cmdsearch-box { display: flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border: 1px solid var(--pptx-border); border-radius: 4px; background: var(--pptx-muted); color: var(--pptx-muted-foreground); }
.pptxv-cmdsearch-box svg { width: 13px; height: 13px; flex: none; }
.pptxv-cmdsearch-input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--pptx-foreground); font: inherit; }
.pptxv-cmdsearch-menu { position: absolute; z-index: 20; top: calc(100% + 4px); right: 0; left: 0; overflow: hidden; border: 1px solid var(--pptx-border); border-radius: 4px; background: var(--pptx-card); box-shadow: 0 8px 20px rgb(0 0 0 / 0.16); }
.pptxv-cmdsearch-item, .pptxv-cmdsearch-empty { display: block; width: 100%; padding: 7px 9px; border: 0; background: transparent; color: var(--pptx-foreground); font: inherit; text-align: left; }
.pptxv-cmdsearch-item { cursor: pointer; }
.pptxv-cmdsearch-item:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-cmdsearch-empty { color: var(--pptx-muted-foreground); }
@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) { .pptxv-titlebar { display: none; } }

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
.pptxv-notes-toolbar { display: flex; align-items: center; gap: 2px; margin: 0 0 6px; }
.pptxv-notes-tool, .pptxv-notes-mode {
  min-width: 26px; height: 24px; padding: 0 6px; border: 1px solid var(--pptx-border);
  border-radius: 3px; background: var(--pptx-muted); color: var(--pptx-foreground); cursor: pointer;
  font-size: 0.75rem; line-height: 1;
}
.pptxv-notes-mode { margin-left: auto; font-size: 0.6875rem; }
.pptxv-notes-tool:hover, .pptxv-notes-mode:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-notes-tool:focus-visible, .pptxv-notes-mode:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: 1px; }
.pptxv-notes-rich-editor {
  box-sizing: border-box; width: 100%; min-height: 76px; max-height: 192px; overflow-y: auto;
  border: 1px solid var(--pptx-border); border-radius: 4px; background: var(--pptx-muted);
  color: var(--pptx-foreground); padding: 7px 9px; font-size: 0.75rem; line-height: 1.4; white-space: pre-wrap;
}
.pptxv-notes-rich-editor:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: -1px; }
.pptxv-notes-rich-editor[contenteditable='false'] { cursor: default; opacity: 0.85; }
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

@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) {
	.pptxv-ribbon,
	.pptxv-thumbs,
	.pptxv-inspector,
	.pptxv-statusbar { display: none; }
	.pptxv-viewport { padding: 10px; }
}

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
.pptxv.pptxv-presenting .pptxv-thumbs,
.pptxv.pptxv-presenting .pptxv-titlebar { display: none; }
.pptxv.pptxv-presenting .pptxv-viewport { background: #000; padding: 0; }
.pptxv.pptxv-presenting .pptxv-stage-wrap { box-shadow: none; }
`;

/** The full stylesheet text (theme-var defaults + chrome rules + editor + collab chrome). */
export function buildViewerCss(): string {
	return `${defaultVarsBlock()}\n${CHROME_CSS}\n${EDITOR_CSS}\n${RIBBON_CSS}\n${SMARTART_DIALOG_CSS}\n${COLLAB_CSS}\n${PRESENTATION_TOUCH_CSS}\n${MOBILE_SHEET_CSS}\n${MASTER_VIEW_CSS}`;
}
