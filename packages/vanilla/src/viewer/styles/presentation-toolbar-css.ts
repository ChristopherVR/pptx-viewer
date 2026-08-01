/**
 * The desktop slide-show toolbar (`ui/presentation-toolbar.ts`).
 *
 * Every measurement here reads a `--pptx-pt-*` custom property rather than a
 * literal. The properties are set on the wrapper by `presentToolbarCssVars()`
 * from `pptx-viewer-shared`, which is the same numbers table React, Vue and
 * Angular consume as Tailwind classes: this binding has no Tailwind, and a
 * hand-copied "36px" here is exactly how the bar's caret ended up two different
 * widths across bindings before the metrics were shared.
 *
 * Deliberately NOT themed off `--pptx-*`: a slide show paints over a black
 * stage in every binding, so the bar is dark regardless of the viewer theme.
 */
export const PRESENTATION_TOOLBAR_CSS = `
.pptxv-present-toolbar-wrap { display: none; }
.pptxv.pptxv-presenting .pptxv-present-toolbar-wrap {
	position: absolute;
	bottom: var(--pptx-pt-bottom);
	left: 50%;
	z-index: var(--pptx-pt-z);
	display: block;
	transform: translateX(-50%);
	transition: opacity var(--pptx-pt-fade) ease;
}
.pptxv-present-toolbar {
	display: flex;
	align-items: center;
	gap: var(--pptx-pt-gap);
	padding: var(--pptx-pt-pad-y) var(--pptx-pt-pad-x);
	border: 1px solid var(--pptx-pt-border);
	border-radius: var(--pptx-pt-radius);
	background: var(--pptx-pt-bg);
	color: #fff;
	box-shadow: 0 25px 50px -12px rgb(0 0 0 / 45%);
	backdrop-filter: blur(12px);
}
/* Two class levels so these beat the base .pptxv-btn box (28x28, theme accent
   hover) without !important; the bar's buttons are 36x36 and always dark. */
.pptxv-present-toolbar .pptxv-present-btn {
	position: relative;
	width: var(--pptx-pt-button);
	height: var(--pptx-pt-button);
	border-radius: var(--pptx-pt-control-radius);
	background: transparent;
	color: rgb(255 255 255 / 70%);
	transition: color 150ms ease, background-color 150ms ease;
}
.pptxv-present-toolbar .pptxv-present-btn svg { width: var(--pptx-pt-icon); height: var(--pptx-pt-icon); }
.pptxv-present-toolbar .pptxv-present-btn:hover:not(:disabled) { background: rgb(255 255 255 / 10%); color: #fff; }
.pptxv-present-toolbar .pptxv-present-btn.is-active { background: rgb(255 255 255 / 25%); color: #fff; }
.pptxv-present-toolbar .pptxv-present-btn:disabled { opacity: 1; background: transparent; color: rgb(255 255 255 / 20%); cursor: not-allowed; }
.pptxv-present-toolbar .pptxv-present-danger:hover:not(:disabled) { color: #f87171; }
.pptxv-present-toolbar .pptxv-present-caret {
	width: var(--pptx-pt-caret);
	margin-left: calc(-1 * var(--pptx-pt-caret-overlap));
	border-radius: 0 var(--pptx-pt-control-radius) var(--pptx-pt-control-radius) 0;
	color: rgb(255 255 255 / 50%);
}
.pptxv-present-toolbar .pptxv-present-caret svg { width: var(--pptx-pt-caret-icon); height: var(--pptx-pt-caret-icon); }
.pptxv-present-group { position: relative; display: flex; align-items: center; }
.pptxv-present-swatch-bar {
	position: absolute;
	bottom: 2px;
	left: 50%;
	width: var(--pptx-pt-swatch-bar-w);
	height: var(--pptx-pt-swatch-bar-h);
	border-radius: 999px;
	transform: translateX(-50%);
	pointer-events: none;
}
.pptxv-present-divider {
	flex: none;
	width: var(--pptx-pt-divider-w);
	height: var(--pptx-pt-divider-h);
	margin: 0 var(--pptx-pt-divider-mx);
	background: var(--pptx-pt-divider-color);
}
.pptxv-present-counter {
	min-width: var(--pptx-pt-counter-min);
	padding: 0 6px;
	color: rgb(255 255 255 / 80%);
	font: var(--pptx-pt-font-size) / var(--pptx-pt-line-height) ui-monospace, monospace;
	font-variant-numeric: tabular-nums;
	text-align: center;
	user-select: none;
}
.pptxv-present-timer {
	display: flex;
	align-items: center;
	gap: var(--pptx-pt-timer-gap);
	padding: 0 4px;
	color: rgb(255 255 255 / 60%);
	font: var(--pptx-pt-font-size) / var(--pptx-pt-line-height) ui-monospace, monospace;
	font-variant-numeric: tabular-nums;
	user-select: none;
}
.pptxv-present-timer svg { width: var(--pptx-pt-timer-icon); height: var(--pptx-pt-timer-icon); flex: none; }
.pptxv-present-palette {
	position: absolute;
	/* Shrink-to-fit against the 64px tool+caret pair squeezes the four 36px
	   columns into 50px and makes the swatches overlap, so the popover must size
	   to its own content. */
	width: max-content;
	bottom: 100%;
	left: 50%;
	display: grid;
	grid-template-columns: repeat(var(--pptx-pt-palette-cols), auto);
	gap: var(--pptx-pt-palette-gap);
	margin-bottom: 8px;
	padding: var(--pptx-pt-palette-pad);
	border: 1px solid rgb(255 255 255 / 20%);
	border-radius: 8px;
	background: #262626;
	box-shadow: 0 20px 25px -5px rgb(0 0 0 / 40%);
	transform: translateX(-50%);
}
.pptxv-present-palette[hidden] { display: none; }
.pptxv-present-swatch {
	width: var(--pptx-pt-swatch);
	height: var(--pptx-pt-swatch);
	padding: 0;
	border: 2px solid rgb(255 255 255 / 20%);
	border-radius: 50%;
	cursor: pointer;
	transition: transform 150ms ease;
}
.pptxv-present-swatch:hover { transform: scale(1.1); }
.pptxv-present-swatch.is-selected { border-color: #fff; }
`;
