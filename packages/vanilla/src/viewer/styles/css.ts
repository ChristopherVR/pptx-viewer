import { defaultCssVars } from 'pptx-viewer-shared';

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

/* ── Toolbar ─────────────────────────────────────────────────────────── */
.pptxv-toolbar {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 6px 8px;
	border-bottom: 1px solid var(--pptx-border);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	flex: none;
}
.pptxv-toolbar-spacer { flex: 1; }
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
.pptxv-btn:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: 1px; }
.pptxv-btn svg { width: 16px; height: 16px; display: block; }
.pptxv-counter, .pptxv-zoom-label {
	padding: 0 8px;
	color: var(--pptx-muted-foreground);
	white-space: nowrap;
	font-variant-numeric: tabular-nums;
}

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
.pptxv-para { margin: 0; }

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
.pptxv.pptxv-presenting .pptxv-toolbar,
.pptxv.pptxv-presenting .pptxv-thumbs { display: none; }
.pptxv.pptxv-presenting .pptxv-viewport { background: #000; padding: 0; }
.pptxv.pptxv-presenting .pptxv-stage-wrap { box-shadow: none; }
`;

/** The full stylesheet text (theme-var defaults + chrome rules). */
export function buildViewerCss(): string {
	return `${defaultVarsBlock()}\n${CHROME_CSS}`;
}
