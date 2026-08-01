/**
 * The presenter console (`viewer/presenter/*`).
 *
 * Every measurement reads a `--pptx-pv-*` custom property rather than a
 * literal. Those properties are set on the console root by
 * `presenterConsoleCssVars()` from `pptx-viewer-shared`, which is the same
 * numbers table React, Vue and Angular consume as Tailwind classes. This
 * binding has no Tailwind, and a hand-copied "260px" here is exactly how the
 * rail ended up 260 wide in three bindings and 300 in a fourth.
 *
 * Colours DO come from the themed `--pptx-*` tokens: unlike the slide-show
 * toolbar, which always paints over a black stage, the console is the
 * presenter's own working surface and follows the viewer theme.
 */
export const PRESENTER_VIEW_CSS = `
/* The show toolbar stands down while the console is up: the console carries its
   own navigation, annotation tools and End control, and the bar sits at a
   higher stacking order, so leaving it up drew a second set of them on top. */
.pptxv.pptxv-presenter-open .pptxv-present-toolbar-wrap { display: none; }
.pptxv-presenter {
	position: absolute;
	inset: 0;
	z-index: var(--pptx-pv-z);
	display: flex;
	flex-direction: column;
	background: var(--pptx-card);
	color: var(--pptx-foreground);
	font-family: inherit;
}
.pptxv-presenter-strip {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--pptx-pv-strip-gap);
	padding: var(--pptx-pv-strip-pad-y) var(--pptx-pv-strip-pad-x);
	border-bottom: 1px solid var(--pptx-border);
	background: var(--pptx-card);
}
.pptxv-presenter-strip-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	min-width: var(--pptx-pv-control);
	height: var(--pptx-pv-control);
	padding: 0 8px;
	border: 0;
	border-radius: var(--pptx-pv-control-radius);
	background: var(--pptx-secondary);
	color: var(--pptx-foreground);
	font-size: 12px;
	cursor: pointer;
	transition: background-color .15s ease;
}
.pptxv-presenter-strip-btn:hover { background: var(--pptx-accent); }
.pptxv-presenter-strip-btn.is-active {
	background: var(--pptx-primary);
	color: var(--pptx-primary-foreground);
}
.pptxv-presenter-strip-icon { display: inline-flex; }
.pptxv-presenter-strip-icon svg {
	width: var(--pptx-pv-control-icon);
	height: var(--pptx-pv-control-icon);
}
.pptxv-presenter-strip-icon:empty { display: none; }
.pptxv-presenter-strip-divider {
	width: var(--pptx-pv-divider-w);
	height: var(--pptx-pv-divider-h);
	margin: 0 var(--pptx-pv-divider-mx);
	background: var(--pptx-border);
}
.pptxv-presenter-strip-spacer { flex: 1; }

.pptxv-presenter-body { display: flex; flex: 1; min-height: 0; }
.pptxv-presenter-main {
	position: relative;
	display: flex;
	flex: var(--pptx-pv-main-flex);
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-width: 0;
	padding: var(--pptx-pv-main-pad);
	overflow: hidden;
	background: #000;
	cursor: pointer;
}
.pptxv-presenter-main-frame { transform-origin: 50% 50%; }
.pptxv-presenter-badge {
	margin-top: 12px;
	color: rgb(255 255 255 / 50%);
	font-family: ui-monospace, monospace;
	font-size: 12px;
	user-select: none;
}

.pptxv-presenter-rail {
	display: flex;
	flex: var(--pptx-pv-rail-flex);
	flex-direction: column;
	min-width: var(--pptx-pv-rail-min);
	max-width: var(--pptx-pv-rail-max);
	border-left: 1px solid var(--pptx-border);
	background: var(--pptx-background);
}
.pptxv-presenter-rail-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 16px;
	border-bottom: 1px solid var(--pptx-border);
}
.pptxv-presenter-elapsed { text-align: right; }
.pptxv-presenter-heading {
	color: var(--pptx-muted-foreground);
	font-size: 10px;
	letter-spacing: .08em;
	text-transform: uppercase;
}
.pptxv-presenter-readout {
	font-family: ui-monospace, monospace;
	font-size: 18px;
	font-variant-numeric: tabular-nums;
}
.pptxv-presenter-elapsed .pptxv-presenter-readout { color: var(--pptx-primary); }
.pptxv-presenter-rail-nav {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 16px;
	border-bottom: 1px solid var(--pptx-border);
}
.pptxv-presenter-nav-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 6px 12px;
	border: 0;
	border-radius: 4px;
	background: var(--pptx-secondary);
	color: inherit;
	font-size: 12px;
	cursor: pointer;
}
.pptxv-presenter-nav-btn:disabled { opacity: .4; cursor: default; }
.pptxv-presenter-nav-btn svg { width: 14px; height: 14px; }
.pptxv-presenter-counter {
	font-family: ui-monospace, monospace;
	font-size: 14px;
	font-variant-numeric: tabular-nums;
}
.pptxv-presenter-next { padding: 12px 16px; border-bottom: 1px solid var(--pptx-border); }
.pptxv-presenter-next-body { margin-top: 8px; overflow: hidden; }
.pptxv-presenter-notes {
	display: flex;
	flex: 1;
	flex-direction: column;
	min-height: 0;
	padding: 12px 16px;
}
.pptxv-presenter-notes-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 8px;
}
.pptxv-presenter-notes-controls { display: flex; align-items: center; gap: 4px; }
.pptxv-presenter-notes-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	border: 0;
	border-radius: 4px;
	background: transparent;
	color: inherit;
	cursor: pointer;
}
.pptxv-presenter-notes-btn:disabled { opacity: .4; cursor: default; }
.pptxv-presenter-notes-btn svg { width: 14px; height: 14px; }
.pptxv-presenter-notes-size {
	min-width: 34px;
	font-family: ui-monospace, monospace;
	font-size: 10px;
	text-align: center;
}
.pptxv-presenter-notes-body {
	flex: 1;
	min-height: 0;
	padding: 8px 12px;
	border: 1px solid var(--pptx-border);
	border-radius: 4px;
	background: var(--pptx-secondary);
	line-height: 1.6;
	overflow-y: auto;
	white-space: pre-wrap;
}
.pptxv-presenter-empty { color: var(--pptx-muted-foreground); font-style: italic; }

.pptxv-presenter-progress {
	flex-shrink: 0;
	height: var(--pptx-pv-progress-h);
	background: var(--pptx-muted);
}
.pptxv-presenter-progress-fill {
	height: 100%;
	background: var(--pptx-primary);
	transition: width 1s linear;
}

.pptxv-presenter-navigator {
	position: absolute;
	inset: 0;
	z-index: var(--pptx-pv-nav-z);
	padding: 24px;
	overflow: auto;
	background: var(--pptx-card);
}
.pptxv-presenter-navigator-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16px;
}
.pptxv-presenter-navigator-close {
	padding: 6px 12px;
	border: 0;
	border-radius: 4px;
	background: var(--pptx-secondary);
	color: inherit;
	cursor: pointer;
}
.pptxv-presenter-navigator-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(var(--pptx-pv-nav-track-min), 1fr));
	gap: var(--pptx-pv-nav-gap);
}
.pptxv-presenter-navigator-tile {
	position: relative;
	padding: 6px;
	border: 1px solid var(--pptx-border);
	border-radius: 6px;
	background: var(--pptx-secondary);
	color: inherit;
	cursor: pointer;
	overflow: hidden;
}
.pptxv-presenter-navigator-tile.is-current { border-color: var(--pptx-primary); border-width: 2px; }
.pptxv-presenter-navigator-preview { overflow: hidden; pointer-events: none; }
.pptxv-presenter-navigator-caption {
	display: block;
	margin-top: 6px;
	font-family: ui-monospace, monospace;
	font-size: 11px;
}
`;
