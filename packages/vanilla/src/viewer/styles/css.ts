import {
	defaultCssVars,
	HIDDEN_SLIDE_DIM_OPACITY,
	HIDDEN_SLIDE_SLASH_GRADIENT,
	STATUS_BAR_METRICS,
	TITLE_BAR_METRICS,
} from 'pptx-viewer-shared';

import { ACCOUNT_CSS } from './account-css';
import { AI_CSS } from './ai-css';
import { AI_FOCUS_CSS } from './ai-focus-css';
import { AI_HISTORY_CSS } from './ai-history-css';
import { ANIMATION_AUTHORING_CSS } from './animation-authoring-css';
import { COLLAB_CSS } from './collab-css';
import { DOCUMENT_PROPERTIES_CSS } from './document-properties-css';
import { EDITOR_CSS } from './editor-css';
import { EQUATION_DIALOG_CSS } from './equation-dialog-css';
import { EXPORT_PROGRESS_CSS } from './export-progress-css';
import { FILE_INFO_CSS } from './file-info-css';
import { INSPECTOR_FORMAT_CSS } from './inspector-format-css';
import { INSPECTOR_PANELS_CSS } from './inspector-panels-css';
import { MASTER_VIEW_CSS } from './master-view-css';
import { MOBILE_SHEET_CSS } from './mobile-sheet-css';
import { OPTIONS_DIALOG_CSS } from './options-dialog-css';
import { OUTLINE_VIEW_CSS } from './outline-view-css';
import { PARITY_DIALOG_CSS } from './parity-dialog-css';
import { PRESENTATION_TOOLBAR_CSS } from './presentation-toolbar-css';
import { PRESENTATION_TOUCH_CSS } from './presentation-touch-css';
import { PRESENTER_VIEW_CSS } from './presenter-view-css';
import { READING_VIEW_CSS } from './reading-view-css';
import { RIBBON_CSS } from './ribbon-css';
import { RIBBON_QUICK_CSS } from './ribbon-quick-css';
import { SLIDE_TEMPLATE_DIALOG_CSS } from './slide-template-dialog-css';
import { SMARTART_DIALOG_CSS } from './smartart-dialog-css';

/**
 * The viewer stylesheet, scoped under the `.pptxv` root class.
 *
 * All chrome colors come from the shared `--pptx-*` theme custom properties
 * (see `pptx-viewer-shared/theme`): the defaults are emitted at zero
 * specificity onto the page root from the shared `defaultCssVars()` (see
 * {@link defaultVarsBlock} for why), and a host `ViewerTheme` overrides them
 * per instance via inline style (see `themeToCssVars`).
 */

/**
 * The title/status bar measurements React, Vue and Angular get from Tailwind
 * utilities. This binding has no Tailwind, so it interpolates the same shared
 * numbers straight into its stylesheet; that is what stops the hand-ported bar
 * drifting off the other four (it had reached 34px tall with a `#d24726` logo).
 */
const TB = TITLE_BAR_METRICS;

/**
 * The built-in theme tokens as a LAST-RESORT layer, matching the other four
 * bindings: `:where(:root)` has zero specificity, so any `--pptx-*` value the
 * host page declares (a `:root` rule or inline vars on `<html>`) wins over
 * these defaults. They used to be declared on `.pptxv` itself, which shadowed
 * the host's own declarations and made the "Default" catalog entry resolve to
 * the built-in dark palette instead of clearing to the host chrome.
 */
function defaultVarsBlock(): string {
	const vars = Object.entries(defaultCssVars())
		.map(([key, value]) => `\t${key}: ${value};`)
		.join('\n');
	return `:where(:root) {\n${vars}\n}`;
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
.pptxv :is(button, [role='button']):not([role='switch']):not([data-pptx-compact]) { min-width: 24px; min-height: 24px; touch-action: manipulation; }
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
/* Breathing room around a text label. Deliberately at .pptxv-btn's own
 * specificity and just after it, so it beats the padding: 0 above (a label
 * touching the button edge reads as one run of words in a ribbon row) while any
 * context that already dresses its own buttons, e.g. .pptxv-eqdlg-footer
 * button, still wins and keeps its dialog metrics. */
.pptxv-btn-text { padding: 0 6px; }
/* Hit-area contract for a button whose content is a TEXT label rather than a
 * 16px icon (makeButton's "text" option). The 28x28 box above cannot hold a
 * word and .pptxv-btn does not clip, so without this the label is painted, and
 * HIT-TESTED, outside the button's own rect and on top of its neighbours: a
 * click at one button's centre then activates the button beside it, because the
 * later sibling paints last. Sizing the box to its label, and refusing to
 * flex-shrink below it (which would re-create the overflow the moment a tab row
 * runs out of width), keeps every button's ink inside its own bounding rect, so
 * a coordinate click always reaches the control it looks like it is over. This
 * is authoritative on purpose; the specialisations that give a text button its
 * own metrics (.pptxv-btn-pill, .pptxv-animation-preset,
 * .pptxv-motion-path-preset, .pptxv-theme-gallery,
 * .pptxv-presentation-touch-controls) are declared later in the sheet at equal
 * specificity and keep winning. */
.pptxv-btn.pptxv-btn-text {
	width: auto;
	min-width: 28px;
	flex: none;
	white-space: nowrap;
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

/* Crash-recovery prompt (\`autosave/autosave-recovery-dialog\`). It reuses the
   \`pptxv-parity-*\` dialog shell, so only its own three classes are declared
   here; the shell rules live in \`parity-dialog-css\`. */
.pptxv-autosave-recovery .pptxv-parity-dialog { width: min(420px, calc(100vw - 32px)); }
.pptxv-autosave-recovery-message { margin: 0; line-height: 1.45; }
.pptxv-autosave-recovery-age { margin: 0; color: var(--pptx-muted-foreground); font-size: 11px; }

/* ── PowerPoint-style title bar ─────────────────────────────────────── */
.pptxv-titlebar {
	position: relative;
	display: flex;
	align-items: center;
	gap: ${TB.gap}px;
	height: ${TB.height}px;
	padding: 0 ${TB.paddingX}px;
	border-bottom: 1px solid var(--pptx-border);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	font-size: ${TB.fontSize}px;
	user-select: none;
}
.pptxv-titlebar-logo {
	display: inline-grid;
	width: ${TB.logoSize}px;
	height: ${TB.logoSize}px;
	place-items: center;
	border-radius: ${TB.logoRadius}px;
	background: ${TB.logoBackground};
	color: #fff;
	font-size: ${TB.logoFontSize}px;
	font-weight: 700;
}
.pptxv-titlebar-autosave, .pptxv-titlebar-file { display: inline-flex; align-items: center; gap: 5px; min-width: 0; }
.pptxv-titlebar-autosave-label, .pptxv-titlebar-status { color: var(--pptx-muted-foreground); white-space: nowrap; }
.pptxv-titlebar-switch {
	position: relative;
	width: ${TB.switchTrackWidth}px;
	height: ${TB.switchTrackHeight}px;
	padding: 0;
	border: 0;
	border-radius: 999px;
	background: var(--pptx-muted-foreground);
	cursor: pointer;
}
.pptxv-titlebar-switch.is-on { background: var(--pptx-primary); }
/* The host passed \`autosave: false\`: the switch is a policy the user cannot
   override, so it reads as unavailable instead of silently doing nothing. */
.pptxv-titlebar-switch.is-disabled { opacity: .45; cursor: not-allowed; }
.pptxv-titlebar-switch-knob { position: absolute; top: ${TB.switchKnobOffsetOff}px; left: ${TB.switchKnobOffsetOff}px; width: ${TB.switchKnobSize}px; height: ${TB.switchKnobSize}px; border-radius: 50%; background: #fff; transition: transform 120ms ease; }
/* The knob is parked at its "off" offset, so the travel is the difference
   between the two offsets, not the "on" offset itself. */
.pptxv-titlebar-switch.is-on .pptxv-titlebar-switch-knob { transform: translateX(${TB.switchKnobOffsetOn - TB.switchKnobOffsetOff}px); }
.pptxv-titlebar-switch:focus-visible, .pptxv-titlebar-btn:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: 1px; }
.pptxv-titlebar-btn { width: 24px; height: 24px; }
.pptxv-titlebar-btn:hover:not(:disabled) { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-titlebar-sep { width: 1px; height: ${TB.separatorHeight}px; background: var(--pptx-border); }
.pptxv-titlebar-filename { overflow: hidden; max-width: 180px; text-overflow: ellipsis; white-space: nowrap; font-size: ${TB.fileNameFontSize}px; font-weight: ${TB.fileNameFontWeight}; }
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
	min-height: 0;
	border-right: 1px solid var(--pptx-border);
	background: var(--pptx-card);
	display: flex;
	flex-direction: column;
}
/* Scrollable slide list; the Add Slide footer stays pinned below it. */
.pptxv-thumbs-list {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	overflow-x: hidden;
	padding: 8px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}
/* Virtualized rail: block layout for the absolute-positioned window. :where()
   keeps the .pptxv-thumbs-virtualized part at zero specificity so the mobile
   and presenting display:none rules on the rail still win. */
:where(.pptxv-thumbs-virtualized) .pptxv-thumbs-list { display: block; }
.pptxv-thumbs[hidden] { display: none; }
.pptxv-thumbs-footer {
	flex: none;
	padding: 6px 8px;
	border-top: 1px solid var(--pptx-border);
}
.pptxv-thumbs-footer[hidden] { display: none; }
.pptxv-thumbs-add {
	display: flex;
	width: 100%;
	align-items: center;
	justify-content: center;
	gap: 4px;
	padding: 4px 8px;
	border: 0;
	border-radius: 4px;
	background: transparent;
	color: var(--pptx-muted-foreground);
	font-size: 11px;
	cursor: pointer;
}
.pptxv-thumbs-add:hover { background: var(--pptx-accent); color: var(--pptx-foreground); }
.pptxv-thumbs-add svg { width: 12px; height: 12px; }
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
/* Hidden slide (PowerPoint's Hide Slide): dim the preview and strike the slide
   number with the shared diagonal slash. The slash carries the meaning on its
   own, because dimming is a colour signal and a dark thumbnail looks dim too. */
.pptxv-thumb[data-pptx-slide-hidden] .pptxv-thumb-frame > :first-child { opacity: ${HIDDEN_SLIDE_DIM_OPACITY}; }
.pptxv-thumb[data-pptx-slide-hidden] .pptxv-thumb-num { background-image: ${HIDDEN_SLIDE_SLASH_GRADIENT}; }
.pptxv-thumb-hidden {
	position: absolute;
	right: 2px;
	bottom: 2px;
	z-index: 10;
	display: inline-flex;
	color: var(--pptx-muted-foreground);
}
.pptxv-thumb-hidden svg { width: 12px; height: 12px; }
.pptxv-sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	margin: -1px;
	padding: 0;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
	border: 0;
}
.pptxv-thumb-section { display: flex; flex-direction: column; gap: 6px; }
.pptxv-thumb-section-header { display: flex; align-items: center; gap: 2px; min-width: 0; }
.pptxv-thumb-section-toggle {
	min-width: 0;
	flex: 1;
	border: 0;
	background: transparent;
	color: var(--pptx-foreground);
	font-size: 11px;
	font-weight: 600;
	text-align: left;
	cursor: pointer;
}
/* React's SectionBlock paints the same 10px p15:sectionPr/@clr dot. */
.pptxv-thumb-section-color { display: inline-block; flex: none; width: 10px; height: 10px; border-radius: 50%; }
.pptxv-thumb-section-actions { display: flex; gap: 1px; }
.pptxv-thumb-section-actions button {
	width: 18px;
	height: 18px;
	padding: 0;
	border: 0;
	border-radius: 3px;
	background: transparent;
	color: var(--pptx-muted-foreground);
	cursor: pointer;
}
.pptxv-thumb-section-actions button:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-thumb-section-actions button:disabled { opacity: .35; cursor: default; }
.pptxv-thumb-section-slides { display: flex; flex-direction: column; gap: 8px; }

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
/* The slide surface must NOT inherit the chrome's typography. The .pptxv root
   sets font-size 14px for the ribbon/panels, and that cascaded into slide
   content that authors no size of its own (table cells are the visible case),
   so the same deck rendered its table text 14px here and 16px in the other
   four bindings, which take the document default. Restating the baseline on
   the stage keeps slide content independent of chrome styling. */
.pptxv-stage { background: #fff; font-size: 16px; }
/* In editor mode the slide surface must own all pointer/touch gestures so a
   finger drag/resize/rotate isn't stolen by the browser for panning or
   pinch-zoom. View-only mode keeps default touch behaviour so the deck scrolls. */
.pptxv-editable .pptxv-stage-wrap { touch-action: none; }
.pptxv-stage-wrap[data-draw-tool="pen"],
.pptxv-stage-wrap[data-draw-tool="freeform"],
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
	/* The handle must own its touch gesture (no scroll/zoom stealing). */
	touch-action: none;
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
	/* The knob must own its touch gesture (no scroll/zoom stealing). */
	touch-action: none;
	box-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
}
/* PowerPoint's shape-adjustment handle: the amber diamond that reshapes a
   preset (a:avLst) instead of resizing its box. Rotated 45deg rather than
   drawn as a path so it scales with the coarse-pointer bump below. */
.pptxv-adjust-handle {
	position: absolute;
	width: 10px;
	height: 10px;
	margin: -5px 0 0 -5px;
	padding: 0;
	border: 1px solid #b45309;
	border-radius: 1px;
	background: #fbbf24;
	transform: rotate(45deg);
	cursor: ew-resize;
	pointer-events: auto;
	/* The handle must own its touch gesture (no scroll/zoom stealing). */
	touch-action: none;
	box-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
}
/* On coarse (touch) pointers a 10px handle is far too small to grab reliably;
   grow the resize/rotate/adjust hit targets to a finger-friendly size. */
@media (pointer: coarse) {
	.pptxv-sel-handle { width: 22px; height: 22px; margin: -11px 0 0 -11px; }
	.pptxv-rotate-knob { width: 24px; height: 24px; margin: -12px 0 0 -12px; }
	.pptxv-adjust-handle { width: 20px; height: 20px; margin: -10px 0 0 -10px; }
}
/* Connector endpoint authoring: the two handles on a selected connector, and
   the candidate connection sites revealed while one is being dragged. A bound
   end is filled, a loose one hollow, so "is this connector actually attached?"
   is answerable at a glance. */
.pptxv-connector-endpoints {
	position: absolute;
	inset: 0;
	pointer-events: none;
	z-index: 6;
}
.pptxv-connector-endpoint {
	position: absolute;
	width: 10px;
	height: 10px;
	margin: -5px 0 0 -5px;
	padding: 0;
	border: 2px solid #fff;
	border-radius: 9999px;
	background: #fff;
	box-shadow: 0 0 0 1px #16a34a;
	cursor: crosshair;
	pointer-events: auto;
	touch-action: none;
}
.pptxv-connector-endpoint.is-attached {
	background: #16a34a;
}
.pptxv-connection-site {
	position: absolute;
	width: 8px;
	height: 8px;
	margin: -4px 0 0 -4px;
	border: 2px solid #3b82f6;
	border-radius: 9999px;
	background: rgb(96 165 250 / 0.6);
}
.pptxv-connection-site.is-snapped {
	background: #3b82f6;
}
@media (pointer: coarse) {
	.pptxv-connector-endpoint { width: 20px; height: 20px; margin: -10px 0 0 -10px; }
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
/* On phones the collapsed strip is pure clutter: the mobile action sheet's
   Notes button is the entry point, so hide the panel entirely until opened
   (React parity). */
@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) {
	.pptxv-notes[data-collapsed='true'] { display: none; }
}

/* ── Bottom status bar ──────────────────────────────────────────────── */
.pptxv-statusbar {
	display: flex;
	align-items: center;
	gap: 4px;
	/* Pinned from the shared metric rather than left to emerge from the padding
	   + button box, which is how this row ended up 2px shorter than the others. */
	min-height: ${STATUS_BAR_METRICS.height}px;
	padding: 2px 8px;
	border-top: 1px solid var(--pptx-border);
	background: color-mix(in srgb, var(--pptx-secondary) 50%, transparent);
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

/* ── Media fallback chrome (authoring canvas only, see mediaFallbackVisual) ── */
.pptxv-media-badge {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4px;
	font-size: 11px;
	color: rgb(255 255 255 / 0.8);
	filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.5));
	pointer-events: none;
}
.pptxv-media-badge svg {
	width: 48px;
	height: 48px;
}
.pptxv-media-badge-missing {
	color: rgb(255 255 255 / 0.6);
}
.pptxv-media-badge-missing svg {
	width: 32px;
	height: 32px;
}
.pptxv-media-placeholder {
	flex-direction: column;
	gap: 4px;
	color: var(--pptx-muted-foreground);
}
.pptxv-media-placeholder svg {
	width: 32px;
	height: 32px;
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
/* A slide show is not a document: dragging across it must not select text the
   way it does on the editing canvas. */
.pptxv.pptxv-presenting .pptxv-stage-wrap,
.pptxv.pptxv-presenting .pptxv-stage-wrap * { user-select: none; }
`;

/** The full stylesheet text (theme-var defaults + chrome rules + editor + collab chrome). */
export function buildViewerCss(): string {
	return `${defaultVarsBlock()}
${CHROME_CSS}
${EDITOR_CSS}
${RIBBON_CSS}
${RIBBON_QUICK_CSS}
${DOCUMENT_PROPERTIES_CSS}
${FILE_INFO_CSS}
${SMARTART_DIALOG_CSS}
${SLIDE_TEMPLATE_DIALOG_CSS}
${EQUATION_DIALOG_CSS}
${COLLAB_CSS}
${PRESENTATION_TOUCH_CSS}
${PRESENTATION_TOOLBAR_CSS}
${PRESENTER_VIEW_CSS}
${MOBILE_SHEET_CSS}
${MASTER_VIEW_CSS}
${PARITY_DIALOG_CSS}
${OPTIONS_DIALOG_CSS}
${ANIMATION_AUTHORING_CSS}
${INSPECTOR_PANELS_CSS}
${INSPECTOR_FORMAT_CSS}
${ACCOUNT_CSS}
${AI_CSS}
${AI_HISTORY_CSS}
${AI_FOCUS_CSS}
${READING_VIEW_CSS}
${OUTLINE_VIEW_CSS}
${EXPORT_PROGRESS_CSS}`;
}
