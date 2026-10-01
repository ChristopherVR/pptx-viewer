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

/** A screen point (the click that opened the editor). */
export interface CaretPoint {
	clientX: number;
	clientY: number;
}

/** How long a recorded click stays valid for the editor that opens from it. */
const PENDING_CARET_TTL_MS = 1000;
let pendingCaret: (CaretPoint & { at: number }) | null = null;

/**
 * Remember where the click that opens an inline editor landed. PowerPoint puts
 * the insertion point where you click a selected shape's text -- in a card's
 * title, not after its last word -- so a binding records the click here just
 * before it switches the element into editing, and the editor picks it up on
 * mount ({@link takePendingCaretPoint}). One-shot and short-lived, so a stale
 * click can never move a later editor's caret.
 */
export function setPendingCaretPoint(point: CaretPoint | null): void {
	pendingCaret = point ? { clientX: point.clientX, clientY: point.clientY, at: Date.now() } : null;
}

/** The recorded click, once (see {@link setPendingCaretPoint}); `null` when none or expired. */
export function takePendingCaretPoint(): CaretPoint | null {
	const p = pendingCaret;
	pendingCaret = null;
	return p && Date.now() - p.at <= PENDING_CARET_TTL_MS
		? { clientX: p.clientX, clientY: p.clientY }
		: null;
}

type CaretDocument = Document & {
	caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
	caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

/** The collapsed range at a screen point, with whichever API the browser has. */
function caretRangeAt(doc: Document, x: number, y: number): Range | null {
	const d = doc as CaretDocument;
	if (typeof d.caretPositionFromPoint === 'function') {
		const pos = d.caretPositionFromPoint(x, y);
		if (!pos) {
			return null;
		}
		const range = doc.createRange();
		range.setStart(pos.offsetNode, pos.offset);
		range.collapse(true);
		return range;
	}
	return typeof d.caretRangeFromPoint === 'function' ? d.caretRangeFromPoint(x, y) : null;
}

/**
 * Put the caret at `point` inside `el` (where the user clicked), or at the end
 * when there's no point or it isn't over `el`'s text -- the
 * {@link placeCaretAtEnd} contract.
 */
export function placeCaretAt(el: HTMLElement, point: CaretPoint | null | undefined): void {
	if (point) {
		const range = caretRangeAt(el.ownerDocument, point.clientX, point.clientY);
		const selection = el.ownerDocument.defaultView?.getSelection();
		if (range && selection && el.contains(range.startContainer)) {
			selection.removeAllRanges();
			selection.addRange(range);
			return;
		}
	}
	placeCaretAtEnd(el);
}
