/**
 * Caret placement for the inline text editors.
 *
 * Every binding seeds the contenteditable surface with the element's existing
 * text and then focuses it; without an explicit selection the browser leaves
 * the caret at the START, so typing prepends. The product contract (React,
 * Vue and Angular behaviour, now shared by all five) is caret at the END so
 * typing appends. Framework-agnostic: DOM globals only.
 */

/**
 * Focus behaviour helper: collapse the selection to the very end of `el`'s
 * content. Safe to call right after mounting/seeding a contenteditable.
 */
export function placeCaretAtEnd(el: HTMLElement): void {
	const doc = el.ownerDocument;
	const win = doc.defaultView;
	if (!win) {
		return;
	}
	const selection = win.getSelection();
	if (!selection) {
		return;
	}
	const range = doc.createRange();
	range.selectNodeContents(el);
	range.collapse(false);
	selection.removeAllRanges();
	selection.addRange(range);
}
