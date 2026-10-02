/**
 * The desktop slide-show toolbar's positioner (`ui/presentation-toolbar.ts`).
 *
 * The bar itself is the shared `pptx-ui-present-toolbar` element, which carries
 * its own shadow-root styles from the shared metrics. Only the auto-hiding wrapper
 * is styled here, from the `--pptx-pt-*` custom properties `presentToolbarCssVars()`
 * sets on it.
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
`;
