import { buildViewerCss } from './css';

const STYLE_ELEMENT_ID = 'pptx-vanilla-viewer-styles';

/**
 * Inject the viewer stylesheet into a document's `<head>` once (idempotent
 * per document). Called automatically by `createPptxViewer`; hosts using a
 * strict CSP without `style-src 'unsafe-inline'` can instead ship the string
 * from `getViewerCss()` themselves and rely on this being a no-op once a
 * `#pptx-vanilla-viewer-styles` node exists.
 */
export function ensureViewerStyles(doc: Document): void {
	if (doc.getElementById(STYLE_ELEMENT_ID)) {
		return;
	}
	const style = doc.createElement('style');
	style.id = STYLE_ELEMENT_ID;
	style.textContent = buildViewerCss();
	(doc.head ?? doc.documentElement).appendChild(style);
}

/** The complete viewer stylesheet text (for hosts that self-manage CSS). */
export function getViewerCss(): string {
	return buildViewerCss();
}
