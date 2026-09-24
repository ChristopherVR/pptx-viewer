/** Share parsed styles between control instances in the same document. */
const sheetsByDocument = new WeakMap<Document, Map<string, CSSStyleSheet>>();

export function attachControlStyles(root: ShadowRoot, css: string): void {
	const doc = root.host.ownerDocument;
	const Sheet = doc.defaultView?.CSSStyleSheet;
	if (Sheet && 'adoptedStyleSheets' in root && 'replaceSync' in Sheet.prototype) {
		try {
			let sheets = sheetsByDocument.get(doc);
			if (!sheets) {
				sheets = new Map();
				sheetsByDocument.set(doc, sheets);
			}
			let sheet = sheets.get(css);
			if (!sheet) {
				sheet = new Sheet();
				sheet.replaceSync(css);
				sheets.set(css, sheet);
			}
			root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
			return;
		} catch {
			// Test DOMs and older browsers can lack constructable stylesheet support.
		}
	}
	const style = doc.createElement('style');
	style.textContent = css;
	root.append(style);
}
