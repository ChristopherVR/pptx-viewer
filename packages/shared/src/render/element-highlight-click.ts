/**
 * `@highlightClick` (`a:hlinkClick`/`a:hlinkHover`'s "Highlight click" flag in
 * PowerPoint's Action Settings dialog): a brief brightness+outline flash on
 * the shape, independent of whatever navigation the action performs.
 *
 * Before this module the flash existed only in React
 * (`element-interaction-props.ts`), hand-rolled inline; Vue, Angular, Svelte
 * and Vanilla parsed and round-tripped the flag but never rendered it. This is
 * the single decision (which two inline style properties, what values, for
 * how long) every binding's click/hover handler now maps onto its own DOM
 * write.
 *
 * @module render/element-highlight-click
 */
import type { PptxAction, PptxElement, PptxSlide } from 'pptx-viewer-core';

import { flattenSlideElements } from './presentation-action';

/** The two inline style properties the flash toggles. */
export interface HighlightClickStyle {
	filter: string;
	outline: string;
}

/** How long a click flash holds before it auto-clears (React's original value). */
export const HIGHLIGHT_CLICK_FLASH_DURATION_MS = 320;

/** Style applied for the ~320ms click flash. */
export const HIGHLIGHT_CLICK_STYLE: HighlightClickStyle = {
	filter: 'brightness(1.18)',
	outline: '2px solid rgba(59, 130, 246, 0.6)',
};

/** Style applied for the duration of a hover (cleared on pointer-leave). */
export const HIGHLIGHT_HOVER_STYLE: HighlightClickStyle = {
	filter: 'brightness(1.15)',
	outline: '2px solid rgba(59, 130, 246, 0.5)',
};

/** The style that clears either flash: empty values reset to the CSS default. */
export const HIGHLIGHT_CLEAR_STYLE: HighlightClickStyle = { filter: '', outline: '' };

/** What a binding should do on click, or `null` when the action doesn't ask for a flash. */
export interface HighlightClickAction {
	style: HighlightClickStyle;
	clearStyle: HighlightClickStyle;
	durationMs: number;
}

/** What a binding should do on hover enter/leave, or `null` when hover doesn't ask for a flash. */
export interface HighlightHoverAction {
	enterStyle: HighlightClickStyle;
	leaveStyle: HighlightClickStyle;
}

/** The full highlight-click descriptor for one element's click + hover actions. */
export interface ElementHighlightClickDescriptor {
	click: HighlightClickAction | null;
	hover: HighlightHoverAction | null;
}

/** Nothing to flash; shared so the common case (no action, or no highlight flag) allocates once. */
const NO_HIGHLIGHT: ElementHighlightClickDescriptor = Object.freeze({ click: null, hover: null });

/**
 * Decide the highlight-click flash for an element carrying `actionClick`
 * and/or `actionHover`.
 *
 * Only the `highlightClick` flag is read from each action (not the whole
 * `PptxAction`, so a caller resolving hover/click from a differently-shaped
 * lookup - e.g. Vue/Angular/Svelte/Vanilla's delegated stage click, which
 * finds the element by id first - can pass just the two flags it already has).
 */
export function resolveElementHighlightClick(
	actionClick: Pick<PptxAction, 'highlightClick'> | undefined,
	actionHover: Pick<PptxAction, 'highlightClick'> | undefined,
): ElementHighlightClickDescriptor {
	if (!actionClick?.highlightClick && !actionHover?.highlightClick) {
		return NO_HIGHLIGHT;
	}
	return {
		click: actionClick?.highlightClick
			? {
					style: HIGHLIGHT_CLICK_STYLE,
					clearStyle: HIGHLIGHT_CLEAR_STYLE,
					durationMs: HIGHLIGHT_CLICK_FLASH_DURATION_MS,
				}
			: null,
		hover: actionHover?.highlightClick
			? { enterStyle: HIGHLIGHT_HOVER_STYLE, leaveStyle: HIGHLIGHT_CLEAR_STYLE }
			: null,
	};
}

/** Write `style`'s `filter`/`outline` onto `el`'s inline style. */
export function applyHighlightClickStyle(el: HTMLElement, style: HighlightClickStyle): void {
	el.style.filter = style.filter;
	el.style.outline = style.outline;
}

/**
 * The highlight-click descriptor for whichever element on `slide` carries
 * `elementId`, group children included.
 *
 * The four bindings that resolve a presentation click through a single
 * delegated stage listener (Vue, Angular, Svelte, Vanilla; see
 * `presentation-action.ts`'s `findPresentationActionTarget`) only ever learn
 * an element's id from that lookup, not the element object itself, so this is
 * the one extra step they need to reuse {@link resolveElementHighlightClick}
 * instead of re-deriving it. React already has the element object at its
 * per-element handler and can call {@link resolveElementHighlightClick}
 * directly.
 */
export function resolveHighlightClickForElementId(
	slide: PptxSlide | undefined,
	elementId: string | undefined,
): ElementHighlightClickDescriptor {
	if (!slide || !elementId) {
		return NO_HIGHLIGHT;
	}
	const element = flattenSlideElements(slide.elements).find((el) => el.id === elementId);
	return resolveElementHighlightClick(element?.actionClick, element?.actionHover);
}

/** The DOM node to flash, and what to flash it with. */
export interface HighlightClickTarget {
	element: HTMLElement;
	descriptor: ElementHighlightClickDescriptor;
}

/**
 * Walk up from a click/hover DOM target to the nearest ancestor whose slide
 * data carries a highlightClick-triggering action (click OR hover), and
 * resolve what to flash it with.
 *
 * Mirrors `presentation-action.ts`'s `findPresentationActionTarget` walk (the
 * same `data-element-id` ancestor-scan every binding's stage already stamps),
 * but checks BOTH `actionClick` and `actionHover` rather than click alone,
 * since a hover-only flash (`a:hlinkHover/@highlightClick` with no
 * `a:hlinkClick` at all) is legal and must still be found on `mouseenter`.
 * This is the single primitive Vue/Angular/Svelte/Vanilla's delegated
 * stage-level click and hover listeners both call; React already owns its
 * DOM node directly at its per-element handler and calls
 * {@link resolveElementHighlightClick} there instead.
 */
export function findHighlightClickTarget(
	target: unknown,
	slide: PptxSlide | undefined,
): HighlightClickTarget | undefined {
	if (typeof Element === 'undefined' || !(target instanceof Element) || !slide) {
		return undefined;
	}
	const byId = new Map<string, PptxElement>();
	for (const element of flattenSlideElements(slide.elements)) {
		byId.set(element.id, element);
	}
	for (let node: Element | null = target; node !== null; node = node.parentElement) {
		const id = node.getAttribute('data-element-id');
		if (!id) {
			continue;
		}
		const el = byId.get(id);
		if (!el) {
			continue;
		}
		const descriptor = resolveElementHighlightClick(el.actionClick, el.actionHover);
		if (descriptor.click || descriptor.hover) {
			return { element: node as HTMLElement, descriptor };
		}
	}
	return undefined;
}
