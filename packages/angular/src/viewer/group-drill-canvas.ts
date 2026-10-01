/**
 * group-drill-canvas.ts: the Angular canvas's side of selecting inside a group
 * the way PowerPoint does (shared `render/group-drill` makes every decision;
 * this only feeds it what `SlideCanvasComponent` has at hand and shapes the
 * answers for the template). No Angular dependency, so each rule is unit-testable
 * without mounting the component.
 *
 *   - the first press on a group selects the group; with it selected, a press
 *     selects the member under the pointer; a press on another member of the
 *     entered group moves to it ({@link resolveGroupPressTarget});
 *   - a double-click goes straight to the innermost member
 *     ({@link resolveGroupDoubleClickTarget});
 *   - Escape steps a selected member up to its parent group
 *     ({@link escapeSelectionTarget});
 *   - members are looked up in slide space next to the top-level elements
 *     ({@link withGroupMembers}), and the entered group gets a dashed frame
 *     ({@link enteredGroupBox}).
 *
 * Grouped children render with `pointer-events: none`, so the DOM hit-test
 * always answers with the top-level group; the member under the pointer is
 * found geometrically from the slide-space press point.
 */

import type { PptxElement } from 'pptx-viewer-core';

import {
	drillSelectionForClick,
	drillSelectionForDoubleClick,
	findElementPath,
	isEnterableGroup,
	memberChainAtPoint,
	parentSelection,
	slideSpaceElement,
	slideSpaceMembers,
} from '../internal/shared';
import type { Box } from './drag-resize';

/** A point in slide px (stage coordinates, zoom already divided out). */
export interface SlidePoint {
	x: number;
	y: number;
}

/**
 * The ids under `point` inside the top-level element `pressedId`, innermost
 * first and `pressedId` last; `null` when it isn't an enterable group (rotated,
 * flipped, empty, or not a group at all), so the press keeps today's behaviour.
 */
export function groupDrillChain(
	slideElements: readonly PptxElement[],
	pressedId: string,
	point: SlidePoint | null,
): string[] | null {
	const top = slideElements.find((el) => el.id === pressedId);
	if (!top || !point || !isEnterableGroup(top)) {
		return null;
	}
	return memberChainAtPoint(slideElements, pressedId, point);
}

/**
 * What a (non-additive) press on the top-level `pressedId` selects: the group
 * first, then -- once it's selected -- the member under the pointer, or another
 * member of the entered group. A top-level non-group comes back unchanged.
 */
export function resolveGroupPressTarget(
	slideElements: readonly PptxElement[],
	pressedId: string,
	point: SlidePoint | null,
	selectedIds: readonly string[],
): string {
	const chain = groupDrillChain(slideElements, pressedId, point);
	if (!chain) {
		return pressedId;
	}
	const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
	const selectedPath = selectedId ? findElementPath(slideElements, selectedId) : null;
	return drillSelectionForClick(chain, selectedPath) ?? pressedId;
}

/** What a double-click on the top-level `pressedId` targets: the innermost member under the pointer. */
export function resolveGroupDoubleClickTarget(
	slideElements: readonly PptxElement[],
	pressedId: string,
	point: SlidePoint | null,
): string {
	const chain = groupDrillChain(slideElements, pressedId, point);
	return (chain ? drillSelectionForDoubleClick(chain) : null) ?? pressedId;
}

/**
 * `elements` (the canvas's template + slide layers) plus every member of the
 * slide's enterable groups in slide space, so a member id resolves like a
 * top-level one for the selection chrome, drag, resize and the inline editor.
 * Top-level ids win; the same array comes back when there are no members.
 */
export function withGroupMembers(
	elements: readonly PptxElement[],
	slideElements: readonly PptxElement[],
): readonly PptxElement[] {
	const members = slideSpaceMembers(slideElements);
	if (members.size === 0) {
		return elements;
	}
	const known = new Set(elements.map((el) => el.id));
	const extra = [...members.values()].filter((member) => !known.has(member.id));
	return extra.length > 0 ? [...elements, ...extra] : elements;
}

/**
 * The slide-space box of the group a single selected member sits in (the
 * "entered" group, drawn with a dashed frame), or null when the selection is
 * not exactly one group member.
 */
export function enteredGroupBox(
	slideElements: readonly PptxElement[],
	selectedIds: readonly string[],
): (Box & { id: string }) | null {
	if (selectedIds.length !== 1) {
		return null;
	}
	const parentId = parentSelection(slideElements, selectedIds[0]);
	const group = parentId ? slideSpaceElement(slideElements, parentId) : null;
	return group
		? { id: group.id, x: group.x, y: group.y, width: group.width, height: group.height }
		: null;
}

/**
 * What Escape selects once no inline editor or transient chrome is left: the
 * parent group of a single selected member, or null (clear the selection).
 */
export function escapeSelectionTarget(
	slideElements: readonly PptxElement[] | undefined,
	selectedIds: readonly string[],
): string | null {
	if (!slideElements || selectedIds.length !== 1) {
		return null;
	}
	return parentSelection(slideElements, selectedIds[0]);
}

/** Styles that decide where a textarea's characters land; copied onto the measuring mirror. */
const MIRROR_STYLES = [
	'boxSizing',
	'width',
	'height',
	'paddingTop',
	'paddingRight',
	'paddingBottom',
	'paddingLeft',
	'borderTopWidth',
	'borderRightWidth',
	'borderBottomWidth',
	'borderLeftWidth',
	'borderStyle',
	'fontFamily',
	'fontSize',
	'fontStyle',
	'fontWeight',
	'fontVariant',
	'fontStretch',
	'lineHeight',
	'letterSpacing',
	'wordSpacing',
	'textAlign',
	'textIndent',
	'textTransform',
	'tabSize',
	'whiteSpace',
	'wordBreak',
	'overflowWrap',
	'direction',
] as const;

type CaretRangeDocument = Document & {
	caretRangeFromPoint?: (x: number, y: number) => Range | null;
	caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
};

/**
 * The character offset in `textarea` under a screen point, or null. A textarea
 * exposes no text nodes to `caretPositionFromPoint` / `caretRangeFromPoint`, so
 * the text is laid out once more in an invisible mirror with the textarea's
 * box and font (the usual textarea-caret technique), and the point is read
 * against that.
 */
function textareaOffsetAt(textarea: HTMLTextAreaElement, x: number, y: number): number | null {
	const doc = textarea.ownerDocument as CaretRangeDocument;
	const view = doc.defaultView;
	if (!view) {
		return null;
	}
	const rect = textarea.getBoundingClientRect();
	if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
		return null;
	}
	const computed = view.getComputedStyle(textarea);
	const mirror = doc.createElement('div');
	for (const key of MIRROR_STYLES) {
		mirror.style[key] = computed[key];
	}
	// The stage is drawn scaled (zoom / fit): lay the mirror out at the textarea's
	// own size, then scale it to where the textarea shows on screen.
	const scale = textarea.offsetWidth > 0 ? rect.width / textarea.offsetWidth : 1;
	Object.assign(mirror.style, {
		position: 'fixed',
		left: `${rect.left}px`,
		top: `${rect.top - textarea.scrollTop * scale}px`,
		transform: `scale(${scale})`,
		transformOrigin: '0 0',
		margin: '0',
		overflow: 'hidden',
		whiteSpace: 'pre-wrap',
		opacity: '0',
		zIndex: '2147483647',
		pointerEvents: 'auto',
	});
	// A trailing space keeps a final empty line measurable.
	mirror.textContent = `${textarea.value} `;
	doc.body.appendChild(mirror);
	try {
		const text = mirror.firstChild;
		let node: Node | null = null;
		let offset = 0;
		if (typeof doc.caretPositionFromPoint === 'function') {
			const pos = doc.caretPositionFromPoint(x, y);
			node = pos?.offsetNode ?? null;
			offset = pos?.offset ?? 0;
		} else if (typeof doc.caretRangeFromPoint === 'function') {
			const range = doc.caretRangeFromPoint(x, y);
			node = range?.startContainer ?? null;
			offset = range?.startOffset ?? 0;
		}
		return node === text ? Math.min(offset, textarea.value.length) : null;
	} finally {
		mirror.remove();
	}
}

/**
 * Put a textarea's caret at a screen point (where the click that opened the
 * editor landed), else at the end -- the textarea counterpart of shared
 * `placeCaretAt`.
 */
export function placeTextareaCaretAt(
	textarea: HTMLTextAreaElement,
	point: { clientX: number; clientY: number } | null | undefined,
): void {
	const end = textarea.value.length;
	const at = point ? textareaOffsetAt(textarea, point.clientX, point.clientY) : null;
	const offset = at ?? end;
	textarea.setSelectionRange(offset, offset);
}

/**
 * The offset in `value` (the editor's plain text: paragraphs joined by "\n")
 * of the character under a screen point, read from the element's RENDERED
 * text -- what the user actually clicked. Angular's text editor is a plain
 * textarea at one font size, so its own layout can't tell a click on a 28pt
 * title from one after the body; the rendered node can. DOM-only characters
 * (a bullet glyph) are skipped; `null` when the point isn't on a line of text.
 */
export function renderedTextOffsetAt(
	root: Element,
	value: string,
	x: number,
	y: number,
): number | null {
	const doc = root.ownerDocument;
	const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
	const range = doc.createRange();
	let vi = 0;
	let best: { offset: number; dx: number } | null = null;
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const text = node.textContent ?? '';
		for (let i = 0; i < text.length; i++) {
			// Paragraph breaks exist in `value` only; step over them to stay aligned.
			while (vi < value.length && value[vi] !== text[i] && value[vi] === '\n') {
				vi++;
			}
			if (vi >= value.length || value[vi] !== text[i]) {
				continue;
			}
			range.setStart(node, i);
			range.setEnd(node, i + 1);
			const r = range.getBoundingClientRect();
			if ((r.width > 0 || r.height > 0) && y >= r.top && y <= r.bottom) {
				const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
				if (!best || dx < best.dx) {
					best = { offset: vi + (x > r.left + r.width / 2 ? 1 : 0), dx };
				}
			}
			vi++;
		}
	}
	return best ? best.offset : null;
}
