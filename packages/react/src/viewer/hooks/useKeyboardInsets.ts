import {
	computeKeyboardInset,
	computeScrollDelta,
	isKeyboardOpen as isOpen,
	readViewportMetrics,
} from 'pptx-viewer-shared';
/**
 * useKeyboardInsets: track the on-screen-keyboard inset on touch devices and
 * keep the focused editable visible when the keyboard opens.
 *
 * On mobile the virtual keyboard shrinks the `VisualViewport` without changing
 * the layout viewport. This hook listens to `visualViewport` resize/scroll,
 * computes how many CSS pixels the keyboard covers via the shared
 * {@link computeKeyboardInset}, and:
 *   - exposes `keyboardInset` / `isKeyboardOpen` so fixed mobile chrome (the
 *     bottom bar) can offset itself above the keyboard, and
 *   - scrolls the active editable (`:focus` input / textarea / contenteditable)
 *     into the area above the keyboard via the shared {@link computeScrollDelta}.
 *
 * Desktop is untouched: without a `VisualViewport` (or with no measurable inset)
 * `keyboardInset` stays 0 and nothing scrolls.
 *
 * @module useKeyboardInsets
 */
import { useEffect, useState } from 'react';

export interface UseKeyboardInsetsResult {
	/** CSS pixels the on-screen keyboard currently covers (0 when closed). */
	keyboardInset: number;
	/** True when the inset is large enough to count as an open keyboard. */
	isKeyboardOpen: boolean;
}

/** Whether a node is a text-entry editable we should keep visible. */
function isEditable(node: Element | null): node is HTMLElement {
	if (!(node instanceof HTMLElement)) {
		return false;
	}
	const tag = node.tagName;
	return tag === 'INPUT' || tag === 'TEXTAREA' || node.isContentEditable;
}

/**
 * Scroll the focused editable into the area above the keyboard, if needed.
 * Uses the shared scroll-delta maths over the element's bounding rect.
 */
function scrollFocusedIntoView(keyboardInset: number): void {
	if (keyboardInset <= 0 || typeof document === 'undefined') {
		return;
	}
	const active = document.activeElement;
	if (!isEditable(active)) {
		return;
	}
	const rect = active.getBoundingClientRect();
	const delta = computeScrollDelta(
		{ top: rect.top, bottom: rect.bottom },
		window.innerHeight,
		keyboardInset,
	);
	if (delta !== 0) {
		window.scrollBy({ top: delta, behavior: 'smooth' });
	}
}

export function useKeyboardInsets(enabled: boolean = true): UseKeyboardInsetsResult {
	const [keyboardInset, setKeyboardInset] = useState(0);

	useEffect(() => {
		if (!enabled || typeof window === 'undefined') {
			return;
		}
		const vv = window.visualViewport;
		if (!vv) {
			return;
		}

		const update = () => {
			const metrics = readViewportMetrics(window);
			const inset = metrics ? computeKeyboardInset(metrics) : 0;
			setKeyboardInset(inset);
			// Defer the scroll so the keyboard animation / layout has settled.
			if (inset > 0) {
				window.requestAnimationFrame(() => scrollFocusedIntoView(inset));
			}
		};

		update();
		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		// A newly-focused field while the keyboard is already open also needs to
		// be scrolled into view (the viewport size does not change between fields).
		const onFocusIn = () => {
			window.requestAnimationFrame(() => {
				const metrics = readViewportMetrics(window);
				const inset = metrics ? computeKeyboardInset(metrics) : 0;
				if (inset > 0) {
					scrollFocusedIntoView(inset);
				}
			});
		};
		document.addEventListener('focusin', onFocusIn);

		return () => {
			vv.removeEventListener('resize', update);
			vv.removeEventListener('scroll', update);
			document.removeEventListener('focusin', onFocusIn);
		};
	}, [enabled]);

	return { keyboardInset, isKeyboardOpen: isOpen(keyboardInset) };
}
